import { randomBytes } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import type {
  CommunityDetail,
  CommunityMember,
  CommunityMembershipRequest,
  CommunityPage,
  CommunityRole,
  CommunitySummary,
  PostAuthor
} from '@voklance/shared';
import { AppError } from '../../../common/AppError.js';
import Profile from '../../profiles/model/Profile.js';
import User from '../../users/model/User.js';
import Community, { type CommunityRecord } from '../model/Community.js';
import CommunityMembership, {
  type CommunityMembershipRecord
} from '../../memberships/model/CommunityMembership.js';
import { canManageRole, canRemove, permissionsFor, type CommunityAction } from './communityPermissions.js';
import type {
  CommunityCreate,
  CommunityDiscover,
  CommunityPageQuery,
  CommunityUpdate
} from '../validation/communitySchemas.js';

type CommunityDoc = CommunityRecord & { _id: Types.ObjectId };
type MembershipDoc = CommunityMembershipRecord & { _id: Types.ObjectId };
type CursorRecord = { createdAt: Date; _id: Types.ObjectId };
const missing = () => new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found.');
const forbidden = () => new AppError(403, 'COMMUNITY_FORBIDDEN', 'You cannot perform this community action.');
const id = (value: Types.ObjectId | string) => value.toString();
const objectId = (value: string) => new Types.ObjectId(value);

function cursorOf(record: CursorRecord) {
  return Buffer.from(`${record.createdAt.getTime()}:${id(record._id)}`).toString('base64url');
}
function parseCursor(value?: string) {
  if (!value) return null;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(value)) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  const raw = Buffer.from(value, 'base64url').toString('utf8');
  const match = /^(\d{13}):([0-9a-f]{24})$/.exec(raw);
  if (!match || Buffer.from(raw).toString('base64url') !== value)
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  const date = new Date(Number(match[1]));
  if (!Number.isFinite(date.getTime())) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  return { createdAt: date, _id: objectId(match[2]) };
}
function olderThan(cursor: ReturnType<typeof parseCursor>) {
  return cursor
    ? {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }
        ]
      }
    : {};
}
function page<T>(
  records: { createdAt: Date; _id: Types.ObjectId }[],
  limit: number,
  mapped: T[]
): CommunityPage<T> {
  const hasMore = records.length > limit;
  return { items: mapped, hasMore, nextCursor: hasMore ? cursorOf(records[limit - 1]) : null };
}
function slugFor(name: string) {
  const base = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72)
    .replace(/-$/g, '');
  return base || `community-${randomBytes(4).toString('hex')}`;
}
function duplicateKey(error: unknown) {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 11000;
}
async function transactionsAvailable() {
  const hello = await mongoose.connection.db?.admin().command({ hello: 1 });
  return Boolean(hello?.setName || hello?.msg === 'isdbgrid');
}

async function activeCounts(communityIds: Types.ObjectId[]) {
  if (!communityIds.length) return new Map<string, number>();
  const rows = await CommunityMembership.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { communityId: { $in: communityIds }, status: 'ACTIVE' } },
    { $group: { _id: '$communityId', count: { $sum: 1 } } }
  ]);
  return new Map(rows.map((row) => [id(row._id), row.count]));
}
async function viewerMemberships(communityIds: Types.ObjectId[], viewerId: string) {
  if (!communityIds.length || !viewerId) return new Map<string, MembershipDoc>();
  const records = await CommunityMembership.find({
    communityId: { $in: communityIds },
    userId: viewerId
  }).lean();
  return new Map(records.map((record) => [id(record.communityId), record]));
}
function summary(record: CommunityDoc, count: number, membership?: MembershipDoc): CommunitySummary {
  const active = membership?.status === 'ACTIVE';
  const privatePreview = record.visibility === 'PRIVATE' && !active;
  return {
    id: id(record._id),
    slug: record.slug,
    name: record.name,
    description: privatePreview ? null : record.description,
    category: record.category,
    tags: privatePreview ? [] : record.tags,
    visibility: record.visibility,
    status: record.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    memberCount: count,
    membershipStatus: membership?.status ?? null,
    myRole: active ? membership.role : null,
    createdAt: record.createdAt.toISOString()
  };
}
async function decorate(records: CommunityDoc[], viewerId: string) {
  const ids = records.map((record) => record._id);
  const [counts, memberships] = await Promise.all([activeCounts(ids), viewerMemberships(ids, viewerId)]);
  return records.map((record) =>
    summary(record, counts.get(id(record._id)) ?? 0, memberships.get(id(record._id)))
  );
}
async function safePeople(userIds: Types.ObjectId[]) {
  const ids = [...new Set(userIds.map(id))];
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids }, accountStatus: { $in: ['ACTIVE', null] } })
      .select('name')
      .lean(),
    Profile.find({ userId: { $in: ids }, visibility: 'PUBLIC' })
      .select('userId username fullName headline')
      .lean()
  ]);
  const byProfile = new Map(profiles.map((item) => [id(item.userId), item]));
  return new Map(
    users.map((user) => {
      const profile = byProfile.get(id(user._id));
      const person: PostAuthor = {
        name: profile?.fullName ?? user.name,
        username: profile?.username ?? null,
        headline: profile?.headline ?? null
      };
      return [id(user._id), person];
    })
  );
}
async function memberDTOs(records: MembershipDoc[]): Promise<CommunityMember[]> {
  const people = await safePeople(records.map((record) => record.userId));
  return records.flatMap((record) => {
    const person = people.get(id(record.userId));
    return person
      ? [
          {
            userId: id(record.userId),
            ...person,
            role: record.role,
            joinedAt: (record.joinedAt ?? record.createdAt).toISOString()
          }
        ]
      : [];
  });
}
async function communityById(communityId: string) {
  const record = await Community.findById(communityId).lean();
  if (!record || record.status === 'CREATING') throw missing();
  return record;
}
export async function resolveCommunityAccess(communityId: string, userId: string) {
  const community = await communityById(communityId);
  const membership = await CommunityMembership.findOne({ communityId, userId, status: 'ACTIVE' }).lean();
  const effectiveRole =
    membership && id(community.ownerId) === userId
      ? 'OWNER'
      : membership?.role === 'OWNER'
        ? null
        : (membership?.role ?? null);
  return { community, role: effectiveRole as CommunityRole | null, active: !!membership };
}
async function actorFor(communityId: string, userId: string, action: CommunityAction) {
  const access = await resolveCommunityAccess(communityId, userId);
  if (!permissionsFor(access.role, access.active, access.community.status === 'ARCHIVED')[action])
    throw forbidden();
  return { community: access.community, role: access.role as CommunityRole };
}

export async function createCommunity(userId: string, input: CommunityCreate): Promise<CommunityDetail> {
  const base = slugFor(input.name);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt ? `${base}-${randomBytes(3).toString('hex')}` : base;
    try {
      if (await transactionsAvailable()) {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const [community] = await Community.create(
              [{ ...input, slug, ownerId: userId, status: 'ACTIVE' }],
              { session }
            );
            await CommunityMembership.create(
              [{ communityId: community._id, userId, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() }],
              { session }
            );
          });
        } finally {
          await session.endSession();
        }
      } else {
        // Standalone MongoDB cannot transact. The staging state keeps incomplete creations invisible.
        const community = await Community.create({ ...input, slug, ownerId: userId, status: 'CREATING' });
        try {
          await CommunityMembership.create({
            communityId: community._id,
            userId,
            role: 'OWNER',
            status: 'ACTIVE',
            joinedAt: new Date()
          });
          const activated = await Community.updateOne(
            { _id: community._id, status: 'CREATING' },
            { $set: { status: 'ACTIVE' } }
          );
          if (activated.modifiedCount !== 1)
            throw new AppError(409, 'COMMUNITY_CONFLICT', 'Community creation changed. Please retry.');
        } catch (error) {
          await CommunityMembership.deleteOne({ communityId: community._id, userId });
          await Community.deleteOne({ _id: community._id, status: 'CREATING' });
          throw error;
        }
      }
      return getCommunity(slug, userId);
    } catch (error) {
      if (duplicateKey(error) && attempt < 4) continue;
      throw error;
    }
  }
  throw new AppError(409, 'COMMUNITY_SLUG_TAKEN', 'Could not create a unique community address.');
}

export async function discoverCommunities(
  viewerId: string,
  query: CommunityDiscover
): Promise<CommunityPage<CommunitySummary>> {
  const cursor = parseCursor(query.cursor);
  const filter: Record<string, unknown> = { status: 'ACTIVE', ...olderThan(cursor) };
  if (query.category) filter.category = query.category;
  if (query.visibility) filter.visibility = query.visibility;
  if (query.search) {
    const pattern = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$and = [{ $or: [{ name: pattern }, { tags: pattern, visibility: 'PUBLIC' }] }];
  }
  const records = await Community.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .lean();
  return page(records, query.limit, await decorate(records.slice(0, query.limit), viewerId));
}

export async function myCommunities(
  userId: string,
  query: CommunityPageQuery
): Promise<CommunityPage<CommunitySummary>> {
  const cursor = parseCursor(query.cursor);
  const records = await CommunityMembership.aggregate<MembershipDoc & { community: CommunityDoc }>([
    { $match: { userId: objectId(userId), status: 'ACTIVE', ...olderThan(cursor) } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $lookup: {
        from: Community.collection.name,
        localField: 'communityId',
        foreignField: '_id',
        pipeline: [{ $match: { status: { $in: ['ACTIVE', 'ARCHIVED'] } } }],
        as: 'community'
      }
    },
    { $unwind: '$community' },
    { $limit: query.limit + 1 }
  ]);
  return page(
    records,
    query.limit,
    await decorate(
      records.slice(0, query.limit).map((item) => item.community),
      userId
    )
  );
}

export async function getCommunity(slug: string, viewerId: string): Promise<CommunityDetail> {
  const record = await Community.findOne({ slug, status: { $in: ['ACTIVE', 'ARCHIVED'] } }).lean();
  if (!record) throw missing();
  const [base] = await decorate([record], viewerId);
  const active = base.membershipStatus === 'ACTIVE';
  const privatePreview = record.visibility === 'PRIVATE' && !active;
  const [owner] = privatePreview
    ? [null]
    : [(await safePeople([record.ownerId])).get(id(record.ownerId)) ?? null];
  return {
    ...base,
    rules: privatePreview ? null : record.rules,
    owner,
    permissions: permissionsFor(base.myRole, active, record.status === 'ARCHIVED')
  };
}

export async function joinCommunity(communityId: string, userId: string) {
  const community = await communityById(communityId);
  if (community.status !== 'ACTIVE')
    throw new AppError(409, 'COMMUNITY_ARCHIVED', 'Archived communities cannot be joined.');
  const desired: 'ACTIVE' | 'PENDING' = community.visibility === 'PUBLIC' ? 'ACTIVE' : 'PENDING';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await CommunityMembership.findOne({ communityId, userId }).lean();
    if (current?.status === 'ACTIVE' || (current?.status === 'PENDING' && desired === 'PENDING'))
      return { membershipStatus: current.status, role: current.status === 'ACTIVE' ? current.role : null };
    const change = { status: desired, role: 'MEMBER', joinedAt: desired === 'ACTIVE' ? new Date() : null };
    if (current) {
      const updated = await CommunityMembership.findOneAndUpdate(
        { _id: current._id, status: current.status },
        { $set: change },
        { new: true, runValidators: true }
      );
      if (updated)
        return { membershipStatus: updated.status, role: updated.status === 'ACTIVE' ? updated.role : null };
    } else {
      try {
        const created = await CommunityMembership.create({ communityId, userId, ...change });
        return { membershipStatus: created.status, role: created.status === 'ACTIVE' ? created.role : null };
      } catch (error) {
        if (!duplicateKey(error)) throw error;
      }
    }
  }
  throw new AppError(409, 'MEMBERSHIP_CONFLICT', 'Membership changed. Please retry.');
}

export async function leaveCommunity(communityId: string, userId: string) {
  const community = await communityById(communityId);
  if (id(community.ownerId) === userId)
    throw new AppError(409, 'OWNER_TRANSFER_REQUIRED', 'Transfer ownership before leaving.');
  const changed = await CommunityMembership.findOneAndUpdate(
    { communityId, userId, status: { $in: ['ACTIVE', 'PENDING'] } },
    { $set: { status: 'REMOVED', role: 'MEMBER', joinedAt: null } },
    { new: true }
  );
  if (!changed) throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'Active membership or request not found.');
  return { membershipStatus: 'REMOVED' as const };
}

export async function members(
  communityId: string,
  userId: string,
  query: CommunityPageQuery
): Promise<CommunityPage<CommunityMember>> {
  await actorFor(communityId, userId, 'viewMembers');
  const cursor = parseCursor(query.cursor);
  const records = await CommunityMembership.aggregate<MembershipDoc>([
    { $match: { communityId: objectId(communityId), status: 'ACTIVE', ...olderThan(cursor) } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'userId',
        foreignField: '_id',
        pipeline: [{ $match: { accountStatus: { $in: ['ACTIVE', null] } } }, { $project: { _id: 1 } }],
        as: 'availableUser'
      }
    },
    { $match: { 'availableUser.0': { $exists: true } } },
    { $limit: query.limit + 1 },
    { $project: { availableUser: 0 } }
  ]);
  return page(records, query.limit, await memberDTOs(records.slice(0, query.limit)));
}

export async function requests(
  communityId: string,
  userId: string,
  query: CommunityPageQuery
): Promise<CommunityPage<CommunityMembershipRequest>> {
  await actorFor(communityId, userId, 'reviewRequests');
  const cursor = parseCursor(query.cursor);
  const records = await CommunityMembership.aggregate<MembershipDoc>([
    { $match: { communityId: objectId(communityId), status: 'PENDING', ...olderThan(cursor) } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'userId',
        foreignField: '_id',
        pipeline: [{ $match: { accountStatus: { $in: ['ACTIVE', null] } } }, { $project: { _id: 1 } }],
        as: 'availableUser'
      }
    },
    { $match: { 'availableUser.0': { $exists: true } } },
    { $limit: query.limit + 1 },
    { $project: { availableUser: 0 } }
  ]);
  const visible = records.slice(0, query.limit);
  const people = await memberDTOs(visible);
  const byId = new Map(people.map((person) => [person.userId, person]));
  return page(
    records,
    query.limit,
    visible.flatMap((record) => {
      const member = byId.get(id(record.userId));
      return member ? [{ id: id(record._id), member, createdAt: record.createdAt.toISOString() }] : [];
    })
  );
}

export async function decideRequest(
  communityId: string,
  requestId: string,
  actorId: string,
  approve: boolean
) {
  await actorFor(communityId, actorId, 'reviewRequests');
  const pending = await CommunityMembership.findOne({ _id: requestId, communityId, status: 'PENDING' })
    .select('userId')
    .lean();
  if (!pending) throw new AppError(409, 'REQUEST_NOT_PENDING', 'Membership request is no longer pending.');
  const applicant = await User.exists({
    _id: pending.userId,
    accountStatus: { $in: ['ACTIVE', null] },
    onboardingStatus: 'COMPLETED'
  });
  if (!applicant)
    throw new AppError(409, 'APPLICANT_UNAVAILABLE', 'The applicant is not available for membership.');
  const record = await CommunityMembership.findOneAndUpdate(
    { _id: requestId, communityId, status: 'PENDING' },
    { $set: { status: approve ? 'ACTIVE' : 'REJECTED', joinedAt: approve ? new Date() : null } },
    { new: true }
  );
  if (!record) throw new AppError(409, 'REQUEST_NOT_PENDING', 'Membership request is no longer pending.');
  return { membershipStatus: record.status };
}

export async function updateCommunity(communityId: string, userId: string, input: CommunityUpdate) {
  const { community, role } = await actorFor(communityId, userId, 'editDetails');
  if (role !== 'OWNER' && input.visibility) throw forbidden();
  const updated = await Community.findOneAndUpdate(
    { _id: community._id, status: 'ACTIVE' },
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!updated) throw missing();
  return getCommunity(updated.slug, userId);
}

export async function updateMemberRole(
  communityId: string,
  actorId: string,
  targetId: string,
  next: 'ADMIN' | 'MODERATOR' | 'MEMBER'
) {
  const { role } = await actorFor(communityId, actorId, 'manageRoles');
  const target = await CommunityMembership.findOne({
    communityId,
    userId: targetId,
    status: 'ACTIVE'
  }).lean();
  if (!target || !canManageRole(role, target.role, next)) throw forbidden();
  const updated = await CommunityMembership.findOneAndUpdate(
    { _id: target._id, status: 'ACTIVE', role: target.role },
    { $set: { role: next } },
    { new: true }
  );
  if (!updated) throw new AppError(409, 'MEMBERSHIP_CONFLICT', 'Membership changed. Please retry.');
  return { role: updated.role };
}

export async function removeMember(communityId: string, actorId: string, targetId: string) {
  const { role } = await actorFor(communityId, actorId, 'removeMembers');
  const target = await CommunityMembership.findOne({
    communityId,
    userId: targetId,
    status: 'ACTIVE'
  }).lean();
  if (!target || !canRemove(role, target.role)) throw forbidden();
  const updated = await CommunityMembership.findOneAndUpdate(
    { _id: target._id, status: 'ACTIVE', role: target.role },
    { $set: { status: 'REMOVED', role: 'MEMBER', joinedAt: null } },
    { new: true }
  );
  if (!updated) throw new AppError(409, 'MEMBERSHIP_CONFLICT', 'Membership changed. Please retry.');
  return { membershipStatus: 'REMOVED' as const };
}

export async function transferOwnership(communityId: string, ownerId: string, newOwnerId: string) {
  const { community } = await actorFor(communityId, ownerId, 'transferOwnership');
  if (ownerId === newOwnerId) throw new AppError(400, 'VALIDATION_ERROR', 'Choose another active member.');
  if (!(await transactionsAvailable()))
    throw new AppError(503, 'REPLICA_SET_REQUIRED', 'Ownership transfer requires a MongoDB replica set.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const target = await CommunityMembership.findOne({
        communityId,
        userId: newOwnerId,
        status: 'ACTIVE'
      }).session(session);
      if (!target) throw new AppError(409, 'TARGET_NOT_MEMBER', 'New owner must be an active member.');
      const changed = await Community.findOneAndUpdate(
        { _id: community._id, ownerId, status: 'ACTIVE' },
        { $set: { ownerId: newOwnerId } },
        { session, new: true }
      );
      if (!changed) throw new AppError(409, 'OWNERSHIP_CONFLICT', 'Ownership changed. Please retry.');
      const oldRole = await CommunityMembership.updateOne(
        { communityId, userId: ownerId, role: 'OWNER', status: 'ACTIVE' },
        { $set: { role: 'ADMIN' } },
        { session }
      );
      if (oldRole.modifiedCount !== 1)
        throw new AppError(409, 'OWNERSHIP_CONFLICT', 'Owner membership changed.');
      const newRole = await CommunityMembership.updateOne(
        { _id: target._id, status: 'ACTIVE', role: target.role },
        { $set: { role: 'OWNER' } },
        { session }
      );
      if (newRole.modifiedCount !== 1)
        throw new AppError(409, 'OWNERSHIP_CONFLICT', 'New owner membership changed.');
    });
  } finally {
    await session.endSession();
  }
  return getCommunity(community.slug, ownerId);
}

export async function archiveCommunity(communityId: string, ownerId: string) {
  const { community } = await actorFor(communityId, ownerId, 'archive');
  const changed = await Community.updateOne(
    { _id: community._id, ownerId, status: 'ACTIVE' },
    { $set: { status: 'ARCHIVED' } }
  );
  if (changed.modifiedCount !== 1)
    throw new AppError(409, 'COMMUNITY_CONFLICT', 'Community changed. Please retry.');
  return getCommunity(community.slug, ownerId);
}
