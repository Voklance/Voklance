import { z } from 'zod';
import { plainText, safeUrl, type NeedReferralPayload, type ReferralPayload } from './communityCommands.js';

export const applicationStatuses = [
  'REQUESTED',
  'ACCEPTED',
  'DECLINED',
  'SUBMITTED',
  'COMPLETED',
  'WITHDRAWN'
] as const;
export const offerStatuses = [
  'OFFERED',
  'ACCEPTED',
  'DECLINED',
  'SUBMITTED',
  'COMPLETED',
  'WITHDRAWN'
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];
export type OfferStatus = (typeof offerStatuses)[number];
export type OpportunityStatus = 'OPEN' | 'CLOSED' | 'EXPIRED';
export type ReferralNeedStatus = 'OPEN' | 'CLOSED' | 'FULFILLED';

export const referralApplicationSchema = z
  .object({
    introduction: plainText(20, 1000),
    relevantSkills: z.array(plainText(2, 40)).max(12),
    portfolioUrl: safeUrl.optional()
  })
  .strict();
export const referralOfferSchema = z
  .object({
    introduction: plainText(20, 1000),
    offerDetails: plainText(20, 1000),
    employerRelationship: plainText(3, 250).optional()
  })
  .strict();
export const referralStatusSchema = z
  .object({ status: z.enum([...applicationStatuses, ...offerStatuses]) })
  .strict();

export type ReferralApplicationInput = z.infer<typeof referralApplicationSchema>;
export type ReferralOfferInput = z.infer<typeof referralOfferSchema>;
export interface ReferralPerson {
  name: string;
  username: string | null;
  headline: string | null;
}
export interface ReferralCommunity {
  id: string;
  slug: string;
  name: string;
}
export interface ReferralOpportunity {
  id: string;
  community: ReferralCommunity;
  author: ReferralPerson;
  details: ReferralPayload;
  status: OpportunityStatus;
  createdAt: string;
  updatedAt: string;
  ownedByMe: boolean;
  myApplication: ReferralApplication | null;
}
export interface ReferralNeed {
  id: string;
  community: ReferralCommunity;
  author: ReferralPerson;
  details: NeedReferralPayload;
  status: ReferralNeedStatus;
  createdAt: string;
  updatedAt: string;
  ownedByMe: boolean;
  myOffer: ReferralOffer | null;
}
export interface ReferralApplication {
  id: string;
  opportunityId: string;
  applicant: ReferralPerson;
  introduction: string;
  relevantSkills: string[];
  portfolioUrl: string | null;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
}
export interface ReferralOffer {
  id: string;
  needId: string;
  helper: ReferralPerson;
  introduction: string;
  offerDetails: string;
  employerRelationship: string | null;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
}
export interface ReferralResponsePage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
export interface MyReferralResponse<T> {
  response: T;
  target: ReferralOpportunity | ReferralNeed | null;
}
