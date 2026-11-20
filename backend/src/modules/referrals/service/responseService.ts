import type {
  ApplicationStatus,
  OfferStatus,
  ReferralApplication,
  ReferralApplicationInput,
  ReferralOffer,
  ReferralOfferInput,
  ReferralResponsePage,
  MyReferralResponse
} from '@voklance/shared';
import { safeAuthorsFor } from '../../commands/service/commandService.js';
import CommunityActivity from '../../commands/model/CommunityActivity.js';
import ReferralApplicationModel, { type ReferralApplicationRecord } from '../model/ReferralApplication.js';
import ReferralOfferModel, { type ReferralOfferRecord } from '../model/ReferralOffer.js';
import { queueNotification } from '../../notifications/service/notificationOutbox.js';
import type { ResponsePageQuery } from '../validation/referralSchemas.js';
import { effectiveStatus } from './referralService.js';
import {
  before,
  conflict,
  forbidden,
  id,
  missing,
  page,
  parseCursor,
  referralActivity,
  referralDtos
} from './referralUtils.js';
import type { Types } from 'mongoose';

type ApplicationDoc = ReferralApplicationRecord & { _id: Types.ObjectId };
type OfferDoc = ReferralOfferRecord & { _id: Types.ObjectId };
const duplicate = (error: unknown) =>
  !!error && typeof error === 'object' && 'code' in error && error.code === 11000;

export async function applicationDtos(
  records: ApplicationDoc[],
  _viewerId: string
): Promise<ReferralApplication[]> {
  const authors = await safeAuthorsFor(records.map((record) => record.applicantId));
  return records.map((record) => ({
    id: id(record._id),
    opportunityId: id(record.opportunityId),
    applicant: authors.get(id(record.applicantId)) ?? {
      name: 'Unavailable member',
      username: null,
      headline: null
    },
    introduction: record.introduction,
    relevantSkills: record.relevantSkills,
    portfolioUrl: record.portfolioUrl ?? null,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  }));
}
export async function offerDtos(records: OfferDoc[], _viewerId: string): Promise<ReferralOffer[]> {
  const authors = await safeAuthorsFor(records.map((record) => record.offeredBy));
  return records.map((record) => ({
    id: id(record._id),
    needId: id(record.needId),
    helper: authors.get(id(record.offeredBy)) ?? {
      name: 'Unavailable member',
      username: null,
      headline: null
    },
    introduction: record.introduction,
    offerDetails: record.offerDetails,
    employerRelationship: record.employerRelationship ?? null,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  }));
}

export async function applyForReferral(
  opportunityId: string,
  applicantId: string,
  input: ReferralApplicationInput
) {
  const { record } = await referralActivity(opportunityId, 'referral', applicantId, true);
  if (id(record.authorId) === applicantId) throw forbidden();
  if (effectiveStatus(record) !== 'OPEN') throw conflict('This opportunity is not accepting requests.');
  try {
    const application = await ReferralApplicationModel.create({
      opportunityId,
      applicantId,
      ...input,
      status: 'REQUESTED'
    });
    await queueNotification({
      recipientId: id(record.authorId),
      actorId: applicantId,
      type: 'REFERRAL_REQUEST_RECEIVED',
      entityType: 'referral',
      entityId: opportunityId,
      deduplicationKey: `referral:application:${id(application._id)}:received`
    });
    return (await applicationDtos([application], applicantId))[0];
  } catch (error) {
    if (duplicate(error)) throw conflict('You already requested this referral.');
    throw error;
  }
}
export async function offerReferral(needId: string, offeredBy: string, input: ReferralOfferInput) {
  const { record } = await referralActivity(needId, 'needreferral', offeredBy, true);
  if (id(record.authorId) === offeredBy) throw forbidden();
  if (effectiveStatus(record) !== 'OPEN') throw conflict('This request is not accepting offers.');
  try {
    const offer = await ReferralOfferModel.create({ needId, offeredBy, ...input, status: 'OFFERED' });
    await queueNotification({
      recipientId: id(record.authorId),
      actorId: offeredBy,
      type: 'REFERRAL_RESPONSE_RECEIVED',
      entityType: 'referral',
      entityId: needId,
      deduplicationKey: `referral:offer:${id(offer._id)}:received`
    });
    return (await offerDtos([offer], offeredBy))[0];
  } catch (error) {
    if (duplicate(error)) throw conflict('You already offered a referral.');
    throw error;
  }
}

export async function listApplications(
  opportunityId: string,
  viewerId: string,
  query: ResponsePageQuery
): Promise<ReferralResponsePage<ReferralApplication>> {
  const { record } = await referralActivity(opportunityId, 'referral', viewerId);
  if (id(record.authorId) !== viewerId) throw forbidden();
  const records = (await ReferralApplicationModel.find({
    opportunityId,
    ...before(parseCursor(query.cursor))
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .lean()) as ApplicationDoc[];
  return page(records, query.limit, await applicationDtos(records.slice(0, query.limit), viewerId));
}
export async function listOffers(
  needId: string,
  viewerId: string,
  query: ResponsePageQuery
): Promise<ReferralResponsePage<ReferralOffer>> {
  const { record } = await referralActivity(needId, 'needreferral', viewerId);
  if (id(record.authorId) !== viewerId) throw forbidden();
  const records = (await ReferralOfferModel.find({ needId, ...before(parseCursor(query.cursor)) })
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .lean()) as OfferDoc[];
  return page(records, query.limit, await offerDtos(records.slice(0, query.limit), viewerId));
}

function applicationTransition(
  current: ApplicationStatus,
  next: ApplicationStatus,
  owner: boolean,
  applicant: boolean
) {
  if (current === 'REQUESTED' && owner && (next === 'ACCEPTED' || next === 'DECLINED')) return true;
  if ((current === 'REQUESTED' || current === 'ACCEPTED') && applicant && next === 'WITHDRAWN') return true;
  if (current === 'ACCEPTED' && owner && next === 'SUBMITTED') return true;
  return current === 'SUBMITTED' && owner && next === 'COMPLETED';
}
function offerTransition(current: OfferStatus, next: OfferStatus, owner: boolean, helper: boolean) {
  if (current === 'OFFERED' && owner && (next === 'ACCEPTED' || next === 'DECLINED')) return true;
  if (current === 'OFFERED' && helper && next === 'WITHDRAWN') return true;
  if (current === 'ACCEPTED' && helper && next === 'SUBMITTED') return true;
  return current === 'SUBMITTED' && helper && next === 'COMPLETED';
}

export async function updateApplicationStatus(
  applicationId: string,
  viewerId: string,
  next: ApplicationStatus
) {
  const application = await ReferralApplicationModel.findById(applicationId).lean();
  if (!application) throw missing();
  const { record } = await referralActivity(id(application.opportunityId), 'referral', viewerId, true);
  if (
    !applicationTransition(
      application.status,
      next,
      id(record.authorId) === viewerId,
      id(application.applicantId) === viewerId
    )
  )
    throw forbidden();
  const updated = await ReferralApplicationModel.findOneAndUpdate(
    { _id: applicationId, status: application.status },
    { $set: { status: next } },
    { new: true }
  ).lean();
  if (!updated) throw conflict('Application status changed. Refresh and try again.');
  await queueNotification({
    recipientId: viewerId === id(updated.applicantId) ? id(record.authorId) : id(updated.applicantId),
    actorId: viewerId,
    type: 'REFERRAL_STATUS_UPDATED',
    entityType: 'referral',
    entityId: id(updated.opportunityId),
    deduplicationKey: `referral:application:${applicationId}:status:${next}`
  });
  return (await applicationDtos([updated], viewerId))[0];
}
export async function updateOfferStatus(offerId: string, viewerId: string, next: OfferStatus) {
  const offer = await ReferralOfferModel.findById(offerId).lean();
  if (!offer) throw missing();
  const { record } = await referralActivity(id(offer.needId), 'needreferral', viewerId, true);
  if (
    !offerTransition(offer.status, next, id(record.authorId) === viewerId, id(offer.offeredBy) === viewerId)
  )
    throw forbidden();
  const updated = await ReferralOfferModel.findOneAndUpdate(
    { _id: offerId, status: offer.status },
    { $set: { status: next } },
    { new: true }
  ).lean();
  if (!updated) throw conflict('Offer status changed. Refresh and try again.');
  await queueNotification({
    recipientId: viewerId === id(updated.offeredBy) ? id(record.authorId) : id(updated.offeredBy),
    actorId: viewerId,
    type: 'REFERRAL_STATUS_UPDATED',
    entityType: 'referral',
    entityId: id(updated.needId),
    deduplicationKey: `referral:offer:${offerId}:status:${next}`
  });
  return (await offerDtos([updated], viewerId))[0];
}

export async function myApplications(
  viewerId: string,
  query: ResponsePageQuery
): Promise<ReferralResponsePage<MyReferralResponse<ReferralApplication>>> {
  const records = (await ReferralApplicationModel.find({
    applicantId: viewerId,
    ...before(parseCursor(query.cursor))
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .lean()) as ApplicationDoc[];
  const visible = records.slice(0, query.limit);
  const targets = await CommunityActivity.find({
    _id: { $in: visible.map((record) => record.opportunityId) },
    status: 'ACTIVE'
  }).lean();
  const targetDtos = new Map(
    (await referralDtos(targets as ((typeof targets)[0] & { _id: Types.ObjectId })[], viewerId, true)).map(
      (target) => [target.id, target]
    )
  );
  const responses = await applicationDtos(visible, viewerId);
  return page(
    records,
    query.limit,
    responses.map((response) => ({ response, target: targetDtos.get(response.opportunityId) ?? null }))
  );
}
export async function myOffers(
  viewerId: string,
  query: ResponsePageQuery
): Promise<ReferralResponsePage<MyReferralResponse<ReferralOffer>>> {
  const records = (await ReferralOfferModel.find({
    offeredBy: viewerId,
    ...before(parseCursor(query.cursor))
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .lean()) as OfferDoc[];
  const visible = records.slice(0, query.limit);
  const targets = await CommunityActivity.find({
    _id: { $in: visible.map((record) => record.needId) },
    status: 'ACTIVE'
  }).lean();
  const targetDtos = new Map(
    (await referralDtos(targets as ((typeof targets)[0] & { _id: Types.ObjectId })[], viewerId, true)).map(
      (target) => [target.id, target]
    )
  );
  const responses = await offerDtos(visible, viewerId);
  return page(
    records,
    query.limit,
    responses.map((response) => ({ response, target: targetDtos.get(response.needId) ?? null }))
  );
}
