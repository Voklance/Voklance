import type { CommentPage, FeedComment, FeedPage, FeedPost, PostAuthor } from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import Profile from '../../profiles/model/Profile.js';
import User from '../../users/model/User.js';
import Post, { type PostRecord } from '../model/Post.js';
import PostLike from '../model/PostLike.js';
import PostBookmark from '../model/PostBookmark.js';
import PostComment, { type PostCommentRecord } from '../model/PostComment.js';
import type { PageQuery } from '../validation/postSchemas.js';

type IdRecord = { _id: Types.ObjectId };
const unavailable = () => new AppError(404, 'POST_NOT_FOUND', 'Post not found.');
const commentUnavailable = () => new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found.');
const idKey = (value: Types.ObjectId | string) => value.toString();

function encodeCursor(record: { createdAt: Date; _id: Types.ObjectId }) {
  return Buffer.from(`${record.createdAt.getTime()}:${record._id.toString()}`).toString('base64url');
}
function decodeCursor(value: string | undefined) {
  if (!value) return null;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(value)) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  const raw = Buffer.from(value, 'base64url').toString('utf8');
  const match = /^(\d{13}):([0-9a-f]{24})$/.exec(raw);
  if (!match || Buffer.from(raw).toString('base64url') !== value)
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  const createdAt = new Date(Number(match[1]));
  if (!Number.isFinite(createdAt.getTime())) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  return { createdAt, _id: new Types.ObjectId(match[2]) };
}
function beforeCursor(cursor: ReturnType<typeof decodeCursor>) {
  return cursor
    ? {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }
        ]
      }
    : {};
}
async function publicAuthors(authorIds: Types.ObjectId[]) {
  const ids = [...new Set(authorIds.map(idKey))];
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids }, accountStatus: { $in: ['ACTIVE', null] }, onboardingStatus: 'COMPLETED' })
      .select('name')
      .lean(),
    Profile.find({ userId: { $in: ids } })
      .select('userId username fullName headline visibility')
      .lean()
  ]);
  const profilesByUser = new Map(profiles.map((profile) => [idKey(profile.userId), profile]));
  return new Map(
    users.map((user) => {
      const profile = profilesByUser.get(idKey(user._id));
      const publishedProfile = profile?.visibility === 'PUBLIC' ? profile : null;
      const author: PostAuthor = {
        name: publishedProfile?.fullName ?? user.name,
        username: publishedProfile?.username ?? null,
        headline: publishedProfile?.headline ?? null
      };
      return [idKey(user._id), author];
    })
  );
}

export async function requirePublishedPost(postId: string) {
  const post = await Post.findOne({ _id: postId, status: 'PUBLISHED' }).lean();
  if (!post) throw unavailable();
  const authors = await publicAuthors([post.authorId]);
  if (!authors.has(idKey(post.authorId))) throw unavailable();
  return post;
}

async function decoratePosts(posts: (PostRecord & IdRecord)[], viewerId: string): Promise<FeedPost[]> {
  if (!posts.length) return [];
  const ids = posts.map((post) => post._id);
  const [authors, likes, comments, myLikes, myBookmarks] = await Promise.all([
    publicAuthors(posts.map((post) => post.authorId)),
    PostLike.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { postId: { $in: ids } } },
      { $group: { _id: '$postId', count: { $sum: 1 } } }
    ]),
    PostComment.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { postId: { $in: ids }, deletedAt: null } },
      { $group: { _id: '$postId', count: { $sum: 1 } } }
    ]),
    PostLike.find({ postId: { $in: ids }, userId: viewerId })
      .select('postId')
      .lean(),
    PostBookmark.find({ postId: { $in: ids }, userId: viewerId })
      .select('postId')
      .lean()
  ]);
  const likeCounts = new Map(likes.map((item) => [idKey(item._id), item.count]));
  const commentCounts = new Map(comments.map((item) => [idKey(item._id), item.count]));
  const liked = new Set(myLikes.map((item) => idKey(item.postId)));
  const bookmarked = new Set(myBookmarks.map((item) => idKey(item.postId)));
  return posts.flatMap((post) => {
    const author = authors.get(idKey(post.authorId));
    if (!author) return [];
    return [
      {
        id: idKey(post._id),
        content: post.content,
        author,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        likeCount: likeCounts.get(idKey(post._id)) ?? 0,
        commentCount: commentCounts.get(idKey(post._id)) ?? 0,
        likedByMe: liked.has(idKey(post._id)),
        bookmarkedByMe: bookmarked.has(idKey(post._id)),
        ownedByMe: idKey(post.authorId) === viewerId
      }
    ];
  });
}

export async function listFeed(viewerId: string, page: PageQuery): Promise<FeedPage> {
  const cursor = decodeCursor(page.cursor);
  const records = await Post.aggregate<PostRecord & IdRecord>([
    { $match: { status: 'PUBLISHED', ...beforeCursor(cursor) } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'authorId',
        foreignField: '_id',
        pipeline: [
          { $match: { accountStatus: { $in: ['ACTIVE', null] }, onboardingStatus: 'COMPLETED' } },
          { $project: { _id: 1 } }
        ],
        as: 'availableAuthor'
      }
    },
    { $match: { 'availableAuthor.0': { $exists: true } } },
    { $limit: page.limit + 1 },
    { $project: { availableAuthor: 0 } }
  ]);
  const visible = records.slice(0, page.limit);
  const hasMore = records.length > page.limit;
  return {
    items: await decoratePosts(visible, viewerId),
    hasMore,
    nextCursor: hasMore ? encodeCursor(visible[visible.length - 1]) : null
  };
}

export async function createPost(userId: string, content: string) {
  const record = await Post.create({ authorId: userId, content, status: 'PUBLISHED' });
  return (await decoratePosts([record], userId))[0];
}
export async function editPost(userId: string, postId: string, content: string) {
  const record = await Post.findOneAndUpdate(
    { _id: postId, authorId: userId, status: 'PUBLISHED' },
    { $set: { content } },
    { new: true, runValidators: true }
  );
  if (!record) throw unavailable();
  return (await decoratePosts([record], userId))[0];
}
export async function deletePost(userId: string, postId: string) {
  const record = await Post.findOneAndUpdate(
    { _id: postId, authorId: userId, status: 'PUBLISHED' },
    { $set: { status: 'DELETED', content: '' } },
    { new: true, runValidators: false }
  );
  if (!record) throw unavailable();
}
export async function toggleLike(userId: string, postId: string, desired: boolean) {
  await requirePublishedPost(postId);
  if (desired) {
    try {
      await PostLike.updateOne({ postId, userId }, { $setOnInsert: { postId, userId } }, { upsert: true });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  } else await PostLike.deleteOne({ postId, userId });
  return { likedByMe: desired, likeCount: await PostLike.countDocuments({ postId }) };
}
export async function toggleBookmark(userId: string, postId: string, desired: boolean) {
  await requirePublishedPost(postId);
  if (desired) {
    try {
      await PostBookmark.updateOne(
        { postId, userId },
        { $setOnInsert: { postId, userId } },
        { upsert: true }
      );
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  } else await PostBookmark.deleteOne({ postId, userId });
  return { bookmarkedByMe: desired };
}

function isDuplicateKey(error: unknown) {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 11000;
}
export async function listBookmarks(userId: string, page: PageQuery): Promise<FeedPage> {
  const cursor = decodeCursor(page.cursor);
  const records = await PostBookmark.aggregate<{
    _id: Types.ObjectId;
    createdAt: Date;
    post: PostRecord & IdRecord;
  }>([
    { $match: { userId: new Types.ObjectId(userId), ...beforeCursor(cursor) } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $lookup: {
        from: Post.collection.name,
        localField: 'postId',
        foreignField: '_id',
        pipeline: [{ $match: { status: 'PUBLISHED' } }],
        as: 'post'
      }
    },
    { $unwind: '$post' },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'post.authorId',
        foreignField: '_id',
        pipeline: [
          { $match: { accountStatus: { $in: ['ACTIVE', null] }, onboardingStatus: 'COMPLETED' } },
          { $project: { _id: 1 } }
        ],
        as: 'availableAuthor'
      }
    },
    { $match: { 'availableAuthor.0': { $exists: true } } },
    { $limit: page.limit + 1 },
    { $project: { createdAt: 1, post: 1 } }
  ]);
  const visible = records.slice(0, page.limit);
  const hasMore = records.length > page.limit;
  return {
    items: await decoratePosts(
      visible.map((item) => item.post),
      userId
    ),
    hasMore,
    nextCursor: hasMore ? encodeCursor(visible[visible.length - 1]) : null
  };
}

async function decorateComments(
  records: (PostCommentRecord & IdRecord)[],
  viewerId: string
): Promise<FeedComment[]> {
  const authors = await publicAuthors(records.map((item) => item.authorId));
  return records.flatMap((record) => {
    const author = authors.get(idKey(record.authorId));
    if (!author) return [];
    return [
      {
        id: idKey(record._id),
        postId: idKey(record.postId),
        content: record.content,
        author,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        ownedByMe: idKey(record.authorId) === viewerId
      }
    ];
  });
}
export async function listComments(userId: string, postId: string, page: PageQuery): Promise<CommentPage> {
  await requirePublishedPost(postId);
  const cursor = decodeCursor(page.cursor);
  const records = await PostComment.find({ postId, deletedAt: null, ...beforeCursor(cursor) })
    .sort({ createdAt: -1, _id: -1 })
    .limit(page.limit + 1)
    .lean();
  const hasMore = records.length > page.limit;
  const visible = records.slice(0, page.limit);
  return {
    items: await decorateComments(visible, userId),
    hasMore,
    nextCursor: hasMore ? encodeCursor(visible[visible.length - 1]) : null
  };
}
export async function createComment(userId: string, postId: string, content: string) {
  await requirePublishedPost(postId);
  const record = await PostComment.create({ postId, authorId: userId, content });
  return (await decorateComments([record], userId))[0];
}
export async function editComment(userId: string, postId: string, commentId: string, content: string) {
  await requirePublishedPost(postId);
  const record = await PostComment.findOneAndUpdate(
    { _id: commentId, postId, authorId: userId, deletedAt: null },
    { $set: { content } },
    { new: true, runValidators: true }
  );
  if (!record) throw commentUnavailable();
  return (await decorateComments([record], userId))[0];
}
export async function deleteComment(userId: string, postId: string, commentId: string) {
  await requirePublishedPost(postId);
  const record = await PostComment.findOneAndUpdate(
    { _id: commentId, postId, authorId: userId, deletedAt: null },
    { $set: { deletedAt: new Date(), content: '' } },
    { new: true, runValidators: false }
  );
  if (!record) throw commentUnavailable();
}
