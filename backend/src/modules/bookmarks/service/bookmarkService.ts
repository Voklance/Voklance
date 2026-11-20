import type {
  BookmarkCollectionDto,
  BookmarkCollectionPage,
  BookmarkType,
  SavedItem,
  SavedItemPage
} from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import CommunityActivity from '../../commands/model/CommunityActivity.js';
import ProfessionalEvent from '../../events/model/ProfessionalEvent.js';
import { eventDetail } from '../../events/service/eventService.js';
import UserBlock from '../../messaging/model/UserBlock.js';
import Post from '../../posts/model/Post.js';
import { requirePublishedPost } from '../../posts/service/postService.js';
import { getReferral } from '../../referrals/service/referralService.js';
import CommunityResource from '../../resources/model/CommunityResource.js';
import { resourceDetail } from '../../resources/service/resourceService.js';
import { visibleCommunities } from '../../search/service/searchService.js';
import User from '../../users/model/User.js';
import Bookmark from '../model/Bookmark.js';
import BookmarkCollection from '../model/BookmarkCollection.js';
import BookmarkCollectionItem from '../model/BookmarkCollectionItem.js';
import { migrateLegacyPostBookmarks } from './legacyBookmarkMigration.js';

const oid = (value: string) => new Types.ObjectId(value);
const id = (value: Types.ObjectId) => value.toString();
const CAP = 250;
const unavailable = () => new AppError(404, 'BOOKMARK_TARGET_UNAVAILABLE', 'This item is unavailable.');
const duplicate = (error: unknown) =>
  !!error && typeof error === 'object' && 'code' in error && error.code === 11000;
async function assertTarget(userId: string, type: BookmarkType, entityId: string) {
  try {
    if (type === 'post') {
      const post = await requirePublishedPost(entityId);
      if (
        await UserBlock.exists({
          $or: [
            { blockerId: oid(userId), blockedId: post.authorId },
            { blockerId: post.authorId, blockedId: oid(userId) }
          ]
        })
      )
        throw unavailable();
    } else if (type === 'event') {
      const event = await eventDetail(entityId, userId);
      if (event.status === 'cancelled') throw unavailable();
    } else if (type === 'resource') {
      const resource = await resourceDetail(entityId, userId);
      if (resource.status !== 'published') throw unavailable();
    } else {
      const referral = await getReferral(entityId, userId, 'referral');
      if (referral.status !== 'OPEN') throw unavailable();
    }
  } catch {
    throw unavailable();
  }
}
export async function saveBookmark(userId: string, entityType: BookmarkType, entityId: string) {
  await assertTarget(userId, entityType, entityId);
  if (entityType === 'post') await migrateLegacyPostBookmarks(userId);
  try {
    const record = await Bookmark.findOneAndUpdate(
      { userId: oid(userId), entityType, entityId: oid(entityId) },
      { $setOnInsert: { userId: oid(userId), entityType, entityId: oid(entityId) } },
      { new: true, upsert: true }
    );
    return { id: id(record!._id), entityType, entityId, savedAt: record!.createdAt.toISOString() };
  } catch (error) {
    if (!duplicate(error)) throw error;
    const record = await Bookmark.findOne({ userId: oid(userId), entityType, entityId: oid(entityId) });
    if (!record) throw error;
    return { id: id(record._id), entityType, entityId, savedAt: record.createdAt.toISOString() };
  }
}
export async function removeBookmark(userId: string, bookmarkId: string) {
  const record = await Bookmark.findOneAndDelete({ _id: oid(bookmarkId), userId: oid(userId) });
  if (record) await BookmarkCollectionItem.deleteMany({ userId: oid(userId), bookmarkId: record._id });
  return { removed: !!record };
}
export async function removeBookmarkByEntity(userId: string, type: BookmarkType, entityId: string) {
  await migrateLegacyPostBookmarks(userId);
  const record = await Bookmark.findOne({ userId: oid(userId), entityType: type, entityId: oid(entityId) });
  return record ? removeBookmark(userId, id(record._id)) : { removed: false };
}
export async function bookmarkStatus(
  userId: string,
  entities: { entityType: BookmarkType; entityId: string }[]
) {
  if (!entities.length) return { items: [] };
  await migrateLegacyPostBookmarks(userId);
  const records = await Bookmark.find({
    userId: oid(userId),
    $or: entities.map((entity) => ({ entityType: entity.entityType, entityId: oid(entity.entityId) }))
  })
    .select('_id entityType entityId')
    .lean();
  return {
    items: records.map((row) => ({ id: id(row._id), entityType: row.entityType, entityId: id(row.entityId) }))
  };
}
type StoredBookmark = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  entityType: BookmarkType;
  entityId: Types.ObjectId;
  createdAt: Date;
};
async function hydrate(userId: string, rows: StoredBookmark[]): Promise<SavedItem[]> {
  const ids = (type: BookmarkType) =>
    rows.filter((row) => row.entityType === type).map((row) => row.entityId);
  const [posts, events, resources, referrals, blocks, collectionItems] = await Promise.all([
    Post.find({ _id: { $in: ids('post') }, status: 'PUBLISHED' })
      .select('authorId content createdAt')
      .lean(),
    ProfessionalEvent.find({ _id: { $in: ids('event') }, status: { $ne: 'cancelled' } })
      .select('communityId organizerId title description startAt locationType createdAt')
      .lean(),
    CommunityResource.find({ _id: { $in: ids('resource') }, status: 'published' })
      .select('communityId createdBy title description category createdAt')
      .lean(),
    CommunityActivity.find({ _id: { $in: ids('referral') }, commandType: 'referral', status: 'ACTIVE' })
      .select('communityId authorId payload referralStatus createdAt')
      .lean(),
    UserBlock.find({ $or: [{ blockerId: oid(userId) }, { blockedId: oid(userId) }] })
      .select('blockerId blockedId')
      .lean(),
    BookmarkCollectionItem.find({ userId: oid(userId), bookmarkId: { $in: rows.map((row) => row._id) } })
      .select('bookmarkId collectionId')
      .lean()
  ]);
  const excluded = new Set(
    blocks.map((row) => (id(row.blockerId) === userId ? id(row.blockedId) : id(row.blockerId)))
  );
  const authors = [
    ...new Set([
      ...posts.map((row) => id(row.authorId)),
      ...events.map((row) => id(row.organizerId)),
      ...resources.map((row) => id(row.createdBy)),
      ...referrals.map((row) => id(row.authorId))
    ])
  ];
  const active = await User.find({
    _id: { $in: authors },
    onboardingStatus: 'COMPLETED',
    $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }]
  })
    .select('_id name')
    .lean();
  const allowedAuthors = new Set(active.map((row) => id(row._id)).filter((value) => !excluded.has(value)));
  const authorNames = new Map(active.map((row) => [id(row._id), row.name]));
  const visible = await visibleCommunities(
    [
      ...new Set([
        ...events.map((row) => id(row.communityId)),
        ...resources.map((row) => id(row.communityId)),
        ...referrals.map((row) => id(row.communityId))
      ])
    ],
    userId
  );
  const postMap = new Map(
    posts.filter((row) => allowedAuthors.has(id(row.authorId))).map((row) => [id(row._id), row])
  );
  const eventMap = new Map(
    events
      .filter((row) => allowedAuthors.has(id(row.organizerId)) && visible.has(id(row.communityId)))
      .map((row) => [id(row._id), row])
  );
  const resourceMap = new Map(
    resources
      .filter((row) => allowedAuthors.has(id(row.createdBy)) && visible.has(id(row.communityId)))
      .map((row) => [id(row._id), row])
  );
  const referralMap = new Map(
    referrals
      .filter((row) => allowedAuthors.has(id(row.authorId)) && visible.has(id(row.communityId)))
      .map((row) => [id(row._id), row])
  );
  const membership = new Map<string, string[]>();
  for (const row of collectionItems)
    membership.set(id(row.bookmarkId), [...(membership.get(id(row.bookmarkId)) ?? []), id(row.collectionId)]);
  return rows.map((row) => {
    const base = {
      id: id(row._id),
      entityType: row.entityType,
      entityId: id(row.entityId),
      savedAt: row.createdAt.toISOString(),
      collectionIds: membership.get(id(row._id)) ?? []
    };
    let content: Pick<SavedItem, 'title' | 'description' | 'href' | 'metadata'> | null = null;
    if (row.entityType === 'post') {
      const post = postMap.get(id(row.entityId));
      if (post)
        content = {
          title: post.content.slice(0, 90),
          description: post.content.slice(0, 220),
          href: `/app/posts/${id(post._id)}`,
          metadata: {
            publishedAt: post.createdAt.toISOString(),
            author: authorNames.get(id(post.authorId)) ?? ''
          }
        };
    } else if (row.entityType === 'event') {
      const event = eventMap.get(id(row.entityId));
      if (event)
        content = {
          title: event.title,
          description: event.description.slice(0, 220),
          href: `/app/events/${id(event._id)}`,
          metadata: {
            publishedAt: event.createdAt.toISOString(),
            organizer: authorNames.get(id(event.organizerId)) ?? '',
            startsAt: event.startAt.toISOString(),
            location: event.locationType
          }
        };
    } else if (row.entityType === 'resource') {
      const resource = resourceMap.get(id(row.entityId));
      if (resource)
        content = {
          title: resource.title,
          description: resource.description.slice(0, 220),
          href: `/app/resources/${id(resource._id)}`,
          metadata: {
            publishedAt: resource.createdAt.toISOString(),
            category: resource.category,
            uploader: authorNames.get(id(resource.createdBy)) ?? ''
          }
        };
    } else {
      const referral = referralMap.get(id(row.entityId));
      const payload = referral?.payload as {
        jobTitle?: string;
        description?: string;
        company?: string;
        expiresAt?: string;
      } | null;
      if (
        referral &&
        payload?.jobTitle &&
        referral.referralStatus === 'OPEN' &&
        (!payload.expiresAt || new Date(payload.expiresAt) > new Date())
      )
        content = {
          title: payload.jobTitle,
          description: (payload.description ?? '').slice(0, 220),
          href: `/app/referrals/opportunities/${id(referral._id)}`,
          metadata: {
            publishedAt: referral.createdAt.toISOString(),
            company: payload.company ?? '',
            author: authorNames.get(id(referral.authorId)) ?? ''
          }
        };
    }
    return content
      ? { ...base, available: true, ...content }
      : { ...base, available: false, title: null, description: null, href: null, metadata: {} };
  });
}
export async function listSavedItems(
  userId: string,
  query: {
    type?: BookmarkType;
    collectionId?: string;
    search?: string;
    sort: 'recent' | 'oldest' | 'published';
    cursor?: string;
    limit: number;
  }
): Promise<SavedItemPage> {
  await migrateLegacyPostBookmarks(userId);
  let offset = 0;
  if (query.cursor) {
    offset = Number(Buffer.from(query.cursor, 'base64url').toString());
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > CAP)
      throw new AppError(400, 'INVALID_CURSOR', 'Invalid saved-item cursor.');
  }
  let collectionBookmarkIds: Types.ObjectId[] | undefined;
  if (query.collectionId) {
    const collection = await BookmarkCollection.findOne({ _id: oid(query.collectionId), userId: oid(userId) })
      .select('_id')
      .lean();
    if (!collection) throw new AppError(404, 'COLLECTION_NOT_FOUND', 'Collection unavailable.');
    const items = await BookmarkCollectionItem.find({ collectionId: collection._id, userId: oid(userId) })
      .select('bookmarkId')
      .limit(CAP)
      .lean();
    collectionBookmarkIds = items.map((row) => row.bookmarkId);
  }
  const records = await Bookmark.find({
    userId: oid(userId),
    ...(query.type ? { entityType: query.type } : {}),
    ...(collectionBookmarkIds ? { _id: { $in: collectionBookmarkIds } } : {})
  })
    .sort(query.sort === 'oldest' ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 })
    .limit(CAP)
    .lean();
  let items = await hydrate(userId, records);
  if (query.search) {
    const term = query.search.toLocaleLowerCase();
    items = items.filter(
      (item) =>
        item.available && `${item.title ?? ''} ${item.description ?? ''}`.toLocaleLowerCase().includes(term)
    );
  }
  if (query.sort === 'published')
    items.sort(
      (a, b) =>
        String(b.metadata.publishedAt ?? b.savedAt).localeCompare(
          String(a.metadata.publishedAt ?? a.savedAt)
        ) || b.id.localeCompare(a.id)
    );
  const page = items.slice(offset, offset + query.limit);
  const hasMore = offset + query.limit < items.length;
  return {
    items: page,
    hasMore,
    nextCursor: hasMore ? Buffer.from(String(offset + query.limit)).toString('base64url') : null
  };
}
export async function createCollection(userId: string, name: string, description: string) {
  const nameKey = name.trim().toLocaleLowerCase();
  try {
    const row = await BookmarkCollection.create({
      userId: oid(userId),
      name: name.trim(),
      nameKey,
      description
    });
    return collectionDto(row, 0);
  } catch (error) {
    if (duplicate(error)) throw new AppError(409, 'COLLECTION_EXISTS', 'A collection with this name exists.');
    throw error;
  }
}
function collectionDto(
  row: { _id: Types.ObjectId; name: string; description: string; createdAt: Date; updatedAt: Date },
  itemCount: number
): BookmarkCollectionDto {
  return {
    id: id(row._id),
    name: row.name,
    description: row.description,
    itemCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
export async function listCollections(
  userId: string,
  limit: number,
  cursor?: string
): Promise<BookmarkCollectionPage> {
  const before = cursor ? oid(cursor) : undefined;
  const rows = await BookmarkCollection.find({
    userId: oid(userId),
    ...(before ? { _id: { $lt: before } } : {})
  })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const visible = rows.slice(0, limit);
  const counts = await BookmarkCollectionItem.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { userId: oid(userId), collectionId: { $in: visible.map((row) => row._id) } } },
    { $group: { _id: '$collectionId', count: { $sum: 1 } } }
  ]);
  const byId = new Map(counts.map((row) => [id(row._id), row.count]));
  return {
    items: visible.map((row) => collectionDto(row, byId.get(id(row._id)) ?? 0)),
    hasMore: rows.length > limit,
    nextCursor: rows.length > limit ? id(visible[visible.length - 1]._id) : null
  };
}
export async function updateCollection(
  userId: string,
  collectionId: string,
  input: { name?: string; description?: string }
) {
  const changed = { ...input, ...(input.name ? { nameKey: input.name.trim().toLocaleLowerCase() } : {}) };
  try {
    const row = await BookmarkCollection.findOneAndUpdate(
      { _id: oid(collectionId), userId: oid(userId) },
      { $set: changed },
      { new: true, runValidators: true }
    );
    if (!row) throw new AppError(404, 'COLLECTION_NOT_FOUND', 'Collection unavailable.');
    return collectionDto(
      row,
      await BookmarkCollectionItem.countDocuments({ collectionId: row._id, userId: oid(userId) })
    );
  } catch (error) {
    if (duplicate(error)) throw new AppError(409, 'COLLECTION_EXISTS', 'A collection with this name exists.');
    throw error;
  }
}
export async function deleteCollection(userId: string, collectionId: string) {
  const row = await BookmarkCollection.findOneAndDelete({ _id: oid(collectionId), userId: oid(userId) });
  if (!row) throw new AppError(404, 'COLLECTION_NOT_FOUND', 'Collection unavailable.');
  await BookmarkCollectionItem.deleteMany({ collectionId: row._id, userId: oid(userId) });
  return { deleted: true };
}
export async function addCollectionItem(userId: string, collectionId: string, bookmarkId: string) {
  const [collection, bookmark] = await Promise.all([
    BookmarkCollection.exists({ _id: oid(collectionId), userId: oid(userId) }),
    Bookmark.exists({ _id: oid(bookmarkId), userId: oid(userId) })
  ]);
  if (!collection || !bookmark)
    throw new AppError(404, 'BOOKMARK_NOT_FOUND', 'Collection or bookmark unavailable.');
  try {
    await BookmarkCollectionItem.updateOne(
      { collectionId: oid(collectionId), bookmarkId: oid(bookmarkId) },
      { $setOnInsert: { userId: oid(userId), collectionId: oid(collectionId), bookmarkId: oid(bookmarkId) } },
      { upsert: true }
    );
  } catch (error) {
    if (!duplicate(error)) throw error;
  }
  return { added: true };
}
export async function removeCollectionItem(userId: string, collectionId: string, bookmarkId: string) {
  const collection = await BookmarkCollection.exists({ _id: oid(collectionId), userId: oid(userId) });
  if (!collection) throw new AppError(404, 'COLLECTION_NOT_FOUND', 'Collection unavailable.');
  await BookmarkCollectionItem.deleteOne({
    userId: oid(userId),
    collectionId: oid(collectionId),
    bookmarkId: oid(bookmarkId)
  });
  return { removed: true };
}
