import type {
  NeedReferralPayload, ReferralPayload, ReferralOpportunity, ReferralNeed,
  ReferralResponsePage
} from '@voklance/shared';
import { AppError } from '../../../common/AppError.js';
import CommunityActivity from '../../commands/model/CommunityActivity.js';
import { resolveCommunityAccess } from '../../communities/service/communityService.js';
import User from '../../users/model/User.js';
import ReferralApplication from '../model/ReferralApplication.js';
import ReferralOffer from '../model/ReferralOffer.js';
import type { ReferralPageQuery, ResponsePageQuery } from '../validation/referralSchemas.js';
import {
  before, conflict, forbidden, id, missing, objectId, page, parseCursor,
  referralActivity, referralDtos, type ActivityDoc
} from './referralUtils.js';

type Kind = 'referral' | 'needreferral';
export function effectiveStatus(record: ActivityDoc) {
  if (record.referralStatus === 'CLOSED' || record.referralStatus === 'FULFILLED') return record.referralStatus;
  if (record.commandType === 'referral' && record.payload && 'expiresAt' in record.payload &&
    typeof record.payload.expiresAt === 'string' && Date.parse(record.payload.expiresAt) <= Date.now()) return 'EXPIRED';
  return 'OPEN';
}
function statusMatch(kind: Kind, status?: ReferralPageQuery['status']) {
  if (!status) return {};
  if (status === 'CLOSED') return { referralStatus: 'CLOSED' };
  if (status === 'FULFILLED') return kind === 'needreferral' ? { referralStatus: 'FULFILLED' } : { _id: { $exists: false } };
  if (kind === 'needreferral') return status === 'OPEN' ? { referralStatus: { $in: ['OPEN', null] } } : { _id: { $exists: false } };
  const expiry = { $dateFromString: { dateString: '$payload.expiresAt', onError: null, onNull: null } };
  if (status === 'EXPIRED') return { referralStatus: { $in: ['OPEN', null] }, $expr: { $and: [{ $ne: [expiry, null] }, { $lte: [expiry, new Date()] }] } };
  return { referralStatus: { $in: ['OPEN', null] }, $expr: { $or: [{ $eq: [expiry, null] }, { $gt: [expiry, new Date()] }] } };
}

export async function listCommunityReferrals(communityId: string, viewerId: string, kind: Kind, query: ReferralPageQuery): Promise<ReferralResponsePage<ReferralOpportunity | ReferralNeed>> {
  const access = await resolveCommunityAccess(communityId, viewerId);
  if (access.community.visibility === 'PRIVATE' && !access.active) throw forbidden();
  const cursor = parseCursor(query.cursor);
  const records = await CommunityActivity.aggregate<ActivityDoc>([
    { $match: { communityId: objectId(communityId), commandType: kind, status: 'ACTIVE', ...statusMatch(kind, query.status), ...before(cursor) } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $lookup: { from: User.collection.name, localField: 'authorId', foreignField: '_id',
      pipeline: [{ $match: { accountStatus: { $in: ['ACTIVE', null] }, onboardingStatus: 'COMPLETED' } }, { $project: { _id: 1 } }], as: 'availableAuthor' } },
    { $match: { 'availableAuthor.0': { $exists: true } } },
    { $limit: query.limit + 1 }, { $project: { availableAuthor: 0 } }
  ]);
  return page(records, query.limit, await referralDtos(records.slice(0, query.limit), viewerId, true));
}

export async function getReferral(idValue: string, viewerId: string, kind: Kind): Promise<ReferralOpportunity | ReferralNeed> {
  const { record } = await referralActivity(idValue, kind, viewerId);
  const [dto] = await referralDtos([record], viewerId);
  if (!dto) throw missing();
  if (kind === 'referral' && dto && 'myApplication' in dto) {
    const application = await ReferralApplication.findOne({ opportunityId: idValue, applicantId: viewerId }).lean();
    if (application) {
      const { applicationDtos } = await import('./responseService.js');
      dto.myApplication = (await applicationDtos([application], viewerId))[0] ?? null;
    }
  }
  if (kind === 'needreferral' && dto && 'myOffer' in dto) {
    const offer = await ReferralOffer.findOne({ needId: idValue, offeredBy: viewerId }).lean();
    if (offer) {
      const { offerDtos } = await import('./responseService.js');
      dto.myOffer = (await offerDtos([offer], viewerId))[0] ?? null;
    }
  }
  return dto;
}

export async function updateReferral(idValue: string, viewerId: string, kind: Kind, details: ReferralPayload | NeedReferralPayload) {
  const { record } = await referralActivity(idValue, kind, viewerId, true);
  if (id(record.authorId) !== viewerId) throw forbidden();
  if (effectiveStatus(record) !== 'OPEN') throw conflict('Only open referrals can be edited.');
  if (kind === 'referral' && 'expiresAt' in details && details.expiresAt && Date.parse(details.expiresAt) <= Date.now())
    throw new AppError(400, 'VALIDATION_ERROR', 'Expiration must be in the future.');
  const updated = await CommunityActivity.findOneAndUpdate(
    { _id: idValue, commandType: kind, authorId: viewerId, status: 'ACTIVE', referralStatus: { $in: ['OPEN', null] } },
    { $set: { payload: details } }, { new: true, runValidators: false }
  ).lean();
  if (!updated) throw conflict('Referral status changed. Refresh and try again.');
  return getReferral(idValue, viewerId, kind);
}

export async function closeReferral(idValue: string, viewerId: string, kind: Kind) {
  const { record } = await referralActivity(idValue, kind, viewerId, true);
  if (id(record.authorId) !== viewerId) throw forbidden();
  if (effectiveStatus(record) === 'CLOSED') throw conflict('Referral is already closed.');
  const updated = await CommunityActivity.findOneAndUpdate(
    { _id: idValue, commandType: kind, authorId: viewerId, status: 'ACTIVE', referralStatus: { $in: ['OPEN', null] } },
    { $set: { referralStatus: 'CLOSED' } }, { new: true }
  ).lean();
  if (!updated) throw conflict('Referral status changed. Refresh and try again.');
  return getReferral(idValue, viewerId, kind);
}

export async function fulfillNeed(idValue: string, viewerId: string) {
  const { record } = await referralActivity(idValue, 'needreferral', viewerId, true);
  if (id(record.authorId) !== viewerId) throw forbidden();
  if (effectiveStatus(record) !== 'OPEN') throw conflict('This request is no longer open.');
  const progress = await ReferralOffer.exists({ needId: idValue, status: { $in: ['SUBMITTED', 'COMPLETED'] } });
  if (!progress) throw conflict('A helper must confirm a submitted referral first.');
  const updated = await CommunityActivity.findOneAndUpdate(
    { _id: idValue, commandType: 'needreferral', authorId: viewerId, status: 'ACTIVE', referralStatus: { $in: ['OPEN', null] } },
    { $set: { referralStatus: 'FULFILLED' } }, { new: true }
  ).lean();
  if (!updated) throw conflict('Referral status changed. Refresh and try again.');
  return getReferral(idValue, viewerId, 'needreferral');
}

export async function myPublished(viewerId: string, kind: Kind, query: ResponsePageQuery) {
  const records = await CommunityActivity.find({ authorId: viewerId, commandType: kind, status: 'ACTIVE', ...before(parseCursor(query.cursor)) })
    .sort({ createdAt: -1, _id: -1 }).limit(query.limit + 1).lean() as ActivityDoc[];
  return page(records, query.limit, await referralDtos(records.slice(0, query.limit), viewerId));
}
