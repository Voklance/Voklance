import type {
  ApiSuccess,
  CommunityResourceDTO,
  ResourceCategory,
  ResourcePage,
  ResourceReportDTO,
  ResourceReportPage
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';

type Filters = {
  search?: string;
  category?: ResourceCategory;
  tag?: string;
  cursor?: string;
  limit?: number;
};
type Capabilities = {
  uploadAvailable: boolean;
  publicationAvailable: boolean;
  scanningAvailable: boolean;
  previewAvailable: boolean;
  maxFileBytes: number;
  maxFilesPerResource: number;
};
const data = async <T>(promise: Promise<{ data: ApiSuccess<T> }>) => (await promise).data.data;
export const resourceApi = {
  capabilities: () => data<Capabilities>(apiClient.get('/resources/capabilities')),
  community: (communityId: string, filters: Filters) =>
    data<ResourcePage>(apiClient.get(`/communities/${communityId}/resources`, { params: filters })),
  mine: (filters: Filters) => data<ResourcePage>(apiClient.get('/resources/mine', { params: filters })),
  detail: (resourceId: string) =>
    data<{ resource: CommunityResourceDTO }>(apiClient.get(`/resources/${resourceId}`)),
  edit: (resourceId: string, body: Record<string, unknown>) =>
    data<{ resource: CommunityResourceDTO }>(apiClient.patch(`/resources/${resourceId}`, body)),
  remove: (resourceId: string) => data<Record<string, never>>(apiClient.delete(`/resources/${resourceId}`)),
  report: (resourceId: string, reason: string, description?: string) =>
    data<{ report: ResourceReportDTO }>(
      apiClient.post(`/resources/${resourceId}/report`, { reason, ...(description ? { description } : {}) })
    ),
  reports: (communityId: string, cursor?: string) =>
    data<ResourceReportPage>(
      apiClient.get(`/communities/${communityId}/resource-reports`, { params: { cursor } })
    ),
  review: (reportId: string, decision: 'hide' | 'dismiss') =>
    data<{ report: ResourceReportDTO }>(apiClient.patch(`/resources/reports/${reportId}`, { decision }))
};
export type { Filters as ResourceFilters };
