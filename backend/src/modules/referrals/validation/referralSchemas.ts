import {
  referralApplicationSchema,
  referralOfferSchema,
  referralPayloadSchema,
  needReferralPayloadSchema,
  applicationStatuses,
  offerStatuses
} from '@voklance/shared';
import { z } from 'zod';

const id = z.string().regex(/^[0-9a-f]{24}$/i);
export const communityIdParams = z.object({ communityId: id }).strict();
export const opportunityParams = z.object({ opportunityId: id }).strict();
export const needParams = z.object({ needId: id }).strict();
export const applicationParams = z.object({ applicationId: id }).strict();
export const offerParams = z.object({ offerId: id }).strict();
export const referralPageQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
    cursor: z.string().min(1).max(256).optional(),
    status: z.enum(['OPEN', 'CLOSED', 'EXPIRED', 'FULFILLED']).optional()
  })
  .strict();
export const responsePageQuery = referralPageQuery.omit({ status: true });
export const opportunityUpdateBody = z.object({ details: referralPayloadSchema }).strict();
export const needUpdateBody = z.object({ details: needReferralPayloadSchema }).strict();
export const applicationBody = referralApplicationSchema;
export const offerBody = referralOfferSchema;
export const applicationStatusBody = z.object({ status: z.enum(applicationStatuses) }).strict();
export const offerStatusBody = z.object({ status: z.enum(offerStatuses) }).strict();
export type ReferralPageQuery = z.infer<typeof referralPageQuery>;
export type ResponsePageQuery = z.infer<typeof responsePageQuery>;
