import type {
  ApiSuccess,
  ConnectionDto,
  ConnectionsPage,
  NetworkCounts,
  NetworkPage,
  NetworkSettings,
  ProfessionalSummary,
  RelativeConnectionStatus
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';

async function data<T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return (await request).data.data;
}
export interface DiscoveryFilters {
  search?: string;
  skill?: string;
  location?: string;
}
export const connectionApi = {
  professionals: (filters: DiscoveryFilters, cursor?: string) =>
    data<NetworkPage<ProfessionalSummary>>(
      apiClient.get('/professionals', { params: { ...filters, limit: 12, ...(cursor ? { cursor } : {}) } })
    ),
  mine: (search?: string, cursor?: string) =>
    data<ConnectionsPage>(
      apiClient.get('/connections/me', { params: { search, limit: 12, ...(cursor ? { cursor } : {}) } })
    ),
  visible: (username: string, cursor?: string) =>
    data<NetworkPage<ProfessionalSummary>>(
      apiClient.get(`/connections/users/${encodeURIComponent(username)}`, {
        params: { limit: 12, ...(cursor ? { cursor } : {}) }
      })
    ),
  requests: (direction: 'incoming' | 'sent', cursor?: string) =>
    data<NetworkPage<ConnectionDto>>(
      apiClient.get(`/connections/requests/${direction}`, {
        params: { limit: 12, ...(cursor ? { cursor } : {}) }
      })
    ),
  counts: () => data<{ counts: NetworkCounts }>(apiClient.get('/connections/counts')),
  status: (userId: string) =>
    data<{ status: RelativeConnectionStatus; requestId: string | null }>(
      apiClient.get(`/connections/status/${userId}`)
    ),
  statusByUsername: (username: string) =>
    data<{
      status: RelativeConnectionStatus;
      requestId: string | null;
      connectionCount: number | null;
      isSelf: boolean;
    }>(apiClient.get(`/connections/status/by-username/${encodeURIComponent(username)}`)),
  send: (recipient: { recipientId?: string; recipientUsername?: string }) =>
    data<{ connection: ConnectionDto }>(apiClient.post('/connections/requests', recipient)),
  accept: (id: string) =>
    data<{ connection: ConnectionDto }>(apiClient.post(`/connections/requests/${id}/accept`)),
  decline: (id: string) =>
    data<{ connection: ConnectionDto }>(apiClient.post(`/connections/requests/${id}/decline`)),
  cancel: (id: string) =>
    data<{ connection: ConnectionDto }>(apiClient.delete(`/connections/requests/${id}`)),
  remove: (id: string) => data<{ connection: ConnectionDto }>(apiClient.delete(`/connections/${id}`)),
  settings: () => data<{ settings: NetworkSettings }>(apiClient.get('/profiles/me/network-settings')),
  saveSettings: (input: Partial<NetworkSettings>) =>
    data<{ settings: NetworkSettings }>(apiClient.patch('/profiles/me/network-settings', input))
};
