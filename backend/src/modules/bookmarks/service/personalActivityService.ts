import type { ActivityItem, ActivityType, PersonalActivityPage } from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import CommunityActivity from '../../commands/model/CommunityActivity.js';
import Connection from '../../connections/model/Connection.js';
import EventRegistration from '../../events/model/EventRegistration.js';
import CommunityMembership from '../../memberships/model/CommunityMembership.js';
import Post from '../../posts/model/Post.js';
import PostComment from '../../posts/model/PostComment.js';
import PostLike from '../../posts/model/PostLike.js';
import CommunityResource from '../../resources/model/CommunityResource.js';

type Query = { type?: ActivityType; cursor?: string; limit: number };
const CAP = 250;
const id = (value: Types.ObjectId) => value.toString();
export async function personalActivity(userId: string, query: Query): Promise<PersonalActivityPage> {
  const offset = query.cursor ? Number(Buffer.from(query.cursor, 'base64url').toString()) : 0;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > CAP)
    throw new AppError(400, 'INVALID_CURSOR', 'Invalid activity cursor.');
  const oid = new Types.ObjectId(userId);
  const wanted = (type: ActivityType) => !query.type || query.type === type;
  const [posts, comments, likes, connections, memberships, events, resources, referrals] = await Promise.all([
    wanted('post')
      ? Post.find({ authorId: oid, status: 'PUBLISHED' })
          .sort({ createdAt: -1 })
          .limit(CAP)
          .select('_id createdAt')
          .lean()
      : [],
    wanted('comment')
      ? PostComment.find({ authorId: oid, deletedAt: { $exists: false } })
          .sort({ createdAt: -1 })
          .limit(CAP)
          .select('_id createdAt')
          .lean()
      : [],
    wanted('like')
      ? PostLike.find({ userId: oid }).sort({ createdAt: -1 }).limit(CAP).select('_id createdAt').lean()
      : [],
    wanted('connection')
      ? Connection.find({ requesterId: oid })
          .sort({ requestedAt: -1 })
          .limit(CAP)
          .select('_id requestedAt')
          .lean()
      : [],
    wanted('membership')
      ? CommunityMembership.find({ userId: oid, status: 'ACTIVE', joinedAt: { $ne: null } })
          .sort({ joinedAt: -1 })
          .limit(CAP)
          .select('_id joinedAt')
          .lean()
      : [],
    wanted('event')
      ? EventRegistration.find({ userId: oid, status: 'registered' })
          .sort({ registeredAt: -1 })
          .limit(CAP)
          .select('_id registeredAt')
          .lean()
      : [],
    wanted('resource')
      ? CommunityResource.find({ createdBy: oid, status: 'published' })
          .sort({ createdAt: -1 })
          .limit(CAP)
          .select('_id createdAt')
          .lean()
      : [],
    wanted('referral')
      ? CommunityActivity.find({
          authorId: oid,
          commandType: { $in: ['referral', 'needreferral'] },
          status: 'ACTIVE'
        })
          .sort({ createdAt: -1 })
          .limit(CAP)
          .select('_id createdAt')
          .lean()
      : []
  ]);
  const items: ActivityItem[] = [
    ...posts.map((row) => ({
      id: `post:${id(row._id)}`,
      type: 'post' as const,
      action: 'published',
      createdAt: row.createdAt.toISOString(),
      href: `/app/posts/${id(row._id)}`,
      title: 'You published a post.'
    })),
    ...comments.map((row) => ({
      id: `comment:${id(row._id)}`,
      type: 'comment' as const,
      action: 'commented',
      createdAt: row.createdAt.toISOString(),
      href: null,
      title: 'You commented on a post.'
    })),
    ...likes.map((row) => ({
      id: `like:${id(row._id)}`,
      type: 'like' as const,
      action: 'liked',
      createdAt: row.createdAt.toISOString(),
      href: null,
      title: 'You liked a post.'
    })),
    ...connections.map((row) => ({
      id: `connection:${id(row._id)}`,
      type: 'connection' as const,
      action: 'requested',
      createdAt: row.requestedAt.toISOString(),
      href: null,
      title: 'You sent a connection request.'
    })),
    ...memberships.map((row) => ({
      id: `membership:${id(row._id)}`,
      type: 'membership' as const,
      action: 'joined',
      createdAt: row.joinedAt!.toISOString(),
      href: null,
      title: 'You joined a community.'
    })),
    ...events.map((row) => ({
      id: `event:${id(row._id)}`,
      type: 'event' as const,
      action: 'registered',
      createdAt: row.registeredAt.toISOString(),
      href: null,
      title: 'You registered for an event.'
    })),
    ...resources.map((row) => ({
      id: `resource:${id(row._id)}`,
      type: 'resource' as const,
      action: 'shared',
      createdAt: row.createdAt.toISOString(),
      href: `/app/resources/${id(row._id)}`,
      title: 'You shared a resource.'
    })),
    ...referrals.map((row) => ({
      id: `referral:${id(row._id)}`,
      type: 'referral' as const,
      action: 'published',
      createdAt: row.createdAt.toISOString(),
      href: null,
      title: 'You published a referral request or opportunity.'
    }))
  ];
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const slice = items.slice(offset, offset + query.limit);
  const hasMore = offset + query.limit < items.length;
  return {
    items: slice,
    hasMore,
    nextCursor: hasMore ? Buffer.from(String(offset + query.limit)).toString('base64url') : null
  };
}
