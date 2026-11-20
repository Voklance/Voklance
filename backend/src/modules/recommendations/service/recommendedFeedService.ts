import type { FeedMode, RecommendedFeedPage, RecommendedPost } from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import Post from '../../posts/model/Post.js';
import { decoratePosts } from '../../posts/service/postService.js';
import Profile from '../../profiles/model/Profile.js';
import User from '../../users/model/User.js';
import RecommendationFeedback from '../model/RecommendationFeedback.js';
import { recommendationContext } from './recommendationContextService.js';

const CANDIDATE_LIMIT = 250;
type Cursor = { asOf: string; offset: number };
function decodeCursor(value?: string): Cursor {
  if (!value) return { asOf: new Date().toISOString(), offset: 0 };
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as Cursor;
    if (
      typeof parsed.asOf === 'string' &&
      !Number.isNaN(Date.parse(parsed.asOf)) &&
      Number.isSafeInteger(parsed.offset) &&
      parsed.offset >= 0 &&
      parsed.offset <= CANDIDATE_LIMIT
    )
      return parsed;
  } catch {
    /* invalid cursor */
  }
  throw new AppError(400, 'INVALID_CURSOR', 'Invalid feed cursor.');
}
function topicMatch(content: string, topics: string[]) {
  const text = content.toLocaleLowerCase();
  return topics.find((topic) => topic.length >= 2 && text.includes(topic));
}
function diversity<T extends { authorId: Types.ObjectId }>(rows: T[]): T[] {
  const remaining = [...rows];
  const output: T[] = [];
  while (remaining.length) {
    let choice = 0;
    if (output.length >= 2 && output[output.length - 1].authorId.equals(output[output.length - 2].authorId)) {
      const previous = output[output.length - 1].authorId.toString();
      const alternative = remaining.findIndex((row) => row.authorId.toString() !== previous);
      if (alternative >= 0) choice = alternative;
    }
    output.push(remaining.splice(choice, 1)[0]);
  }
  return output;
}
export async function recommendedFeed(
  userId: string,
  mode: FeedMode,
  limit: number,
  cursorValue?: string
): Promise<RecommendedFeedPage> {
  const cursor = decodeCursor(cursorValue);
  const asOf = new Date(cursor.asOf);
  const context = await recommendationContext(userId);
  const candidates = await Post.find({
    status: 'PUBLISHED',
    createdAt: { $lte: asOf },
    authorId: { $nin: [...context.excludedUserIds].map((value) => new Types.ObjectId(value)) }
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(CANDIDATE_LIMIT)
    .lean();
  const authorIds = [...new Set(candidates.map((post) => post.authorId.toString()))];
  const [users, profiles, feedback] = await Promise.all([
    User.find({
      _id: { $in: authorIds },
      onboardingStatus: 'COMPLETED',
      $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }]
    })
      .select('_id')
      .lean(),
    Profile.find({ userId: { $in: authorIds }, visibility: 'PUBLIC' })
      .select('userId')
      .lean(),
    RecommendationFeedback.find({
      userId: new Types.ObjectId(userId),
      entityType: 'post',
      action: { $in: ['hidden', 'not_interested'] }
    })
      .select('entityId')
      .lean()
  ]);
  const active = new Set(users.map((row) => row._id.toString()));
  const published = new Set(profiles.map((row) => row.userId.toString()));
  const suppressed = new Set(feedback.map((row) => row.entityId.toString()));
  const eligible = candidates.filter(
    (post) =>
      active.has(post.authorId.toString()) &&
      published.has(post.authorId.toString()) &&
      !suppressed.has(post._id.toString()) &&
      (mode !== 'following' || context.connectionIds.has(post.authorId.toString()))
  );
  const scored = eligible.map((post) => {
    const match = topicMatch(post.content, context.topics);
    const connected = context.connectionIds.has(post.authorId.toString());
    const ageDays = Math.max(0, (asOf.getTime() - post.createdAt.getTime()) / 86_400_000);
    const score = (match ? 30 : 0) + (connected ? 20 : 0) + Math.round(10 / (1 + ageDays / 7));
    const reason = connected
      ? 'Posted by a professional connection'
      : match
        ? `Matches your ${match} interest`
        : 'Recent professional post';
    return { ...post, score, reason };
  });
  const sorted =
    mode === 'for-you'
      ? diversity(
          scored.sort(
            (a, b) =>
              b.score - a.score ||
              b.createdAt.getTime() - a.createdAt.getTime() ||
              b._id.toString().localeCompare(a._id.toString())
          )
        )
      : scored.sort(
          (a, b) =>
            b.createdAt.getTime() - a.createdAt.getTime() || b._id.toString().localeCompare(a._id.toString())
        );
  const page = sorted.slice(cursor.offset, cursor.offset + limit);
  const decorated = await decoratePosts(page, userId);
  const reasons = new Map(page.map((post) => [post._id.toString(), post.reason]));
  const items: RecommendedPost[] = decorated.map((post) => ({
    ...post,
    reason: reasons.get(post.id) ?? 'Recent professional post'
  }));
  const hasMore = cursor.offset + limit < sorted.length;
  return {
    items,
    hasMore,
    nextCursor: hasMore
      ? Buffer.from(JSON.stringify({ asOf: cursor.asOf, offset: cursor.offset + limit })).toString(
          'base64url'
        )
      : null
  };
}
