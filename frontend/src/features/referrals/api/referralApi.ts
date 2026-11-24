import type {
  ApiSuccess,
  ApplicationStatus,
  OfferStatus,
  ReferralApplication,
  ReferralApplicationInput,
  ReferralNeed,
  ReferralOffer,
  ReferralOfferInput,
  ReferralOpportunity,
  ReferralResponsePage,
  ReferralPayload,
  NeedReferralPayload
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';

async function data<T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return (await request).data.data;
}
const listParams = (limit: number, cursor?: string, status?: string) => ({
  limit,
  ...(cursor ? { cursor } : {}),
  ...(status ? { status } : {})
});
export const referralApi = {
  communityOpportunities: (communityId: string, cursor?: string, status?: string) =>
    data<ReferralResponsePage<ReferralOpportunity>>(
      apiClient.get(`/communities/${communityId}/referrals`, { params: listParams(10, cursor, status) })
    ),
  communityNeeds: (communityId: string, cursor?: string, status?: string) =>
    data<ReferralResponsePage<ReferralNeed>>(
      apiClient.get(`/communities/${communityId}/referral-needs`, { params: listParams(10, cursor, status) })
    ),
  opportunity: (id: string) =>
    data<{ opportunity: ReferralOpportunity }>(apiClient.get(`/referrals/opportunities/${id}`)),
  need: (id: string) => data<{ need: ReferralNeed }>(apiClient.get(`/referrals/needs/${id}`)),
  applications: (id: string, cursor?: string) =>
    data<ReferralResponsePage<ReferralApplication>>(
      apiClient.get(`/referrals/opportunities/${id}/applications`, { params: listParams(10, cursor) })
    ),
  offers: (id: string, cursor?: string) =>
    data<ReferralResponsePage<ReferralOffer>>(
      apiClient.get(`/referrals/needs/${id}/offers`, { params: listParams(10, cursor) })
    ),
  apply: (id: string, input: ReferralApplicationInput) =>
    data<{ application: ReferralApplication }>(
      apiClient.post(`/referrals/opportunities/${id}/applications`, input)
    ),
  offer: (id: string, input: ReferralOfferInput) =>
    data<{ offer: ReferralOffer }>(apiClient.post(`/referrals/needs/${id}/offers`, input)),
  applicationStatus: (id: string, status: ApplicationStatus) =>
    data<{ application: ReferralApplication }>(
      apiClient.patch(`/referrals/applications/${id}/status`, { status })
    ),
  offerStatus: (id: string, status: OfferStatus) =>
    data<{ offer: ReferralOffer }>(apiClient.patch(`/referrals/offers/${id}/status`, { status })),
  updateOpportunity: (id: string, details: ReferralPayload) =>
    data<{ opportunity: ReferralOpportunity }>(
      apiClient.patch(`/referrals/opportunities/${id}`, { details })
    ),
  updateNeed: (id: string, details: NeedReferralPayload) =>
    data<{ need: ReferralNeed }>(apiClient.patch(`/referrals/needs/${id}`, { details })),
  closeOpportunity: (id: string) =>
    data<{ opportunity: ReferralOpportunity }>(apiClient.post(`/referrals/opportunities/${id}/close`, {})),
  closeNeed: (id: string) => data<{ need: ReferralNeed }>(apiClient.post(`/referrals/needs/${id}/close`, {})),
  fulfillNeed: (id: string) =>
    data<{ need: ReferralNeed }>(apiClient.post(`/referrals/needs/${id}/fulfill`, {}))
};
