import type {
  ApiSuccess,
  CommunityDetail,
  CommunityInput,
  CommunityMember,
  CommunityMembershipRequest,
  CommunityPage,
  CommunitySummary
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';

async function data<T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return (await request).data.data;
}
export interface CommunityFilters {
  search?: string;
  category?: string;
  visibility?: string;
}
export const communityApi = {
  discover: (filters: CommunityFilters, cursor?: string) =>
    data<CommunityPage<CommunitySummary>>(
      apiClient.get('/communities', { params: { ...filters, limit: 10, ...(cursor ? { cursor } : {}) } })
    ),
  mine: (cursor?: string) =>
    data<CommunityPage<CommunitySummary>>(
      apiClient.get('/users/me/communities', { params: { limit: 10, ...(cursor ? { cursor } : {}) } })
    ),
  detail: (slug: string) => data<{ community: CommunityDetail }>(apiClient.get(`/communities/${slug}`)),
  create: (input: CommunityInput) =>
    data<{ community: CommunityDetail }>(apiClient.post('/communities', input)),
  join: (id: string) => data<{ membershipStatus: string }>(apiClient.post(`/communities/${id}/join`)),
  leave: (id: string) =>
    data<{ membershipStatus: string }>(apiClient.delete(`/communities/${id}/membership`)),
  members: (id: string, cursor?: string) =>
    data<CommunityPage<CommunityMember>>(
      apiClient.get(`/communities/${id}/members`, { params: { limit: 10, ...(cursor ? { cursor } : {}) } })
    ),
  requests: (id: string, cursor?: string) =>
    data<CommunityPage<CommunityMembershipRequest>>(
      apiClient.get(`/communities/${id}/membership-requests`, {
        params: { limit: 10, ...(cursor ? { cursor } : {}) }
      })
    ),
  decide: (id: string, requestId: string, approve: boolean) =>
    data<{ membershipStatus: string }>(
      apiClient.post(`/communities/${id}/membership-requests/${requestId}/${approve ? 'approve' : 'reject'}`)
    ),
  update: (id: string, input: Partial<CommunityInput>) =>
    data<{ community: CommunityDetail }>(apiClient.patch(`/communities/${id}`, input)),
  role: (id: string, userId: string, role: 'ADMIN' | 'MODERATOR' | 'MEMBER') =>
    data<{ role: string }>(apiClient.patch(`/communities/${id}/members/${userId}/role`, { role })),
  remove: (id: string, userId: string) =>
    data<{ membershipStatus: string }>(apiClient.delete(`/communities/${id}/members/${userId}`)),
  transfer: (id: string, newOwnerUserId: string) =>
    data<{ community: CommunityDetail }>(
      apiClient.post(`/communities/${id}/transfer-ownership`, { newOwnerUserId })
    ),
  archive: (id: string) => data<{ community: CommunityDetail }>(apiClient.post(`/communities/${id}/archive`))
};
