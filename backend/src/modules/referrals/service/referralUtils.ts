import { Types } from 'mongoose';
import type {
  ReferralOpportunity, ReferralNeed, ReferralCommunity, ReferralResponsePage
} from '@voklance/shared';
import { AppError } from '../../../common/AppError.js';
import { activityDtos } from '../../commands/service/commandService.js';
import CommunityActivity, { type CommunityActivityRecord } from '../../commands/model/CommunityActivity.js';
import Community from '../../communities/model/Community.js';
import CommunityMembership from '../../memberships/model/CommunityMembership.js';
import { resolveCommunityAccess } from '../../communities/service/communityService.js';

export type ActivityDoc = CommunityActivityRecord & { _id: Types.ObjectId };
export const objectId = (value: string) => new Types.ObjectId(value);
export const id = (value: Types.ObjectId | string) => value.toString();
export const missing = () => new AppError(404, 'REFERRAL_NOT_FOUND', 'Referral not found.');
export const forbidden = () => new AppError(403, 'REFERRAL_FORBIDDEN', 'You cannot access this referral.');
export const conflict = (message: string) => new AppError(409, 'REFERRAL_CONFLICT', message);

export function cursorOf(record: { createdAt: Date; _id: Types.ObjectId }) {
  return Buffer.from(`${record.createdAt.getTime()}:${id(record._id)}`).toString('base64url');
}
export function parseCursor(value?: string) {
  if (!value) return null;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(value)) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  const raw = Buffer.from(value, 'base64url').toString('utf8');
  const match = /^(\d{13}):([0-9a-f]{24})$/.exec(raw);
  if (!match || Buffer.from(raw).toString('base64url') !== value) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  return { createdAt: new Date(Number(match[1])), _id: objectId(match[2]) };
}
export function before(cursor: ReturnType<typeof parseCursor>) {
  return cursor ? { $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }] } : {};
}
export function page<T>(records: { createdAt: Date; _id: Types.ObjectId }[], limit: number, items: T[]): ReferralResponsePage<T> {
  const hasMore = records.length > limit;
  return { items, hasMore, nextCursor: hasMore ? cursorOf(records[limit - 1]) : null };
}

export async function referralActivity(activityId: string, type: 'referral' | 'needreferral', viewerId: string, write = false) {
  const record = await CommunityActivity.findOne({ _id: activityId, commandType: type, status: 'ACTIVE' }).lean();
  if (!record) throw missing();
  const access = await resolveCommunityAccess(id(record.communityId), viewerId);
  if (access.community.visibility === 'PRIVATE' && !access.active) throw forbidden();
  if (write && (!access.active || access.community.status !== 'ACTIVE')) throw forbidden();
  return { record: record as ActivityDoc, access };
}
export function communityRef(record: { _id: Types.ObjectId; slug: string; name: string }): ReferralCommunity {
  return { id: id(record._id), slug: record.slug, name: record.name };
}
export async function referralDtos(records: ActivityDoc[], viewerId: string, enforcePrivate = false): Promise<(ReferralOpportunity | ReferralNeed)[]> {
  const [activities, communities, memberships] = await Promise.all([
    activityDtos(records, viewerId, false),
    Community.find({ _id: { $in: records.map((record) => record.communityId) } }).select('slug name visibility').lean(),
    enforcePrivate ? CommunityMembership.find({ communityId: { $in: records.map((record) => record.communityId) }, userId: viewerId, status: 'ACTIVE' }).select('communityId').lean() : Promise.resolve([])
  ]);
  const byRecord = new Map(records.map((record) => [id(record._id), record]));
  const byCommunity = new Map(communities.map((community) => [id(community._id), community]));
  const memberOf = new Set(memberships.map((membership) => id(membership.communityId)));
  const result: (ReferralOpportunity | ReferralNeed)[] = [];
  for (const activity of activities) {
    const record = byRecord.get(activity.id);
    const community = byCommunity.get(activity.communityId);
    if (!record || !community || (enforcePrivate && community.visibility === 'PRIVATE' && !memberOf.has(activity.communityId))) continue;
    const base = { id: activity.id, community: communityRef(community), author: activity.author,
      createdAt: activity.createdAt, updatedAt: record.updatedAt.toISOString(), ownedByMe: activity.ownedByMe };
    if (activity.command === 'referral') result.push({ ...base, details: activity.payload,
      status: (activity.referralStatus ?? 'OPEN') as ReferralOpportunity['status'], myApplication: null });
    if (activity.command === 'needreferral') result.push({ ...base, details: activity.payload,
      status: (activity.referralStatus ?? 'OPEN') as ReferralNeed['status'], myOffer: null });
  }
  return result;
}
