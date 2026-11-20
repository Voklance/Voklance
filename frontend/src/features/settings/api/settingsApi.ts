import type { ApiSuccess } from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';
const data = async <T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> => (await request).data.data;
export interface AccountInfo {
  name: string;
  email: string;
  createdAt: string;
  publicProfileUrl: string | null;
  emailChangeAvailable: boolean;
}
export interface SessionInfo {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  device: string;
}
export interface PrivacySettings {
  visibility: 'PUBLIC' | 'PRIVATE';
  profileDiscoverable: boolean;
  allowConnectionRequests: boolean;
  connectionListVisibility: 'private' | 'connections';
  allowDirectMessages: boolean;
  showReadReceipts: boolean;
  showOnlineStatus: boolean;
}
export interface BlockedMember {
  userId: string;
  name: string;
  username: string | null;
  blockedAt: string;
}
export const settingsApi = {
  account: () => data<AccountInfo>(apiClient.get('/settings/account')),
  updateAccount: (name: string) => data<AccountInfo>(apiClient.patch('/settings/account', { name })),
  requestEmailChange: (currentPassword: string, newEmail: string) =>
    data<{ requested: boolean }>(
      apiClient.post('/settings/account/email-change', { currentPassword, newEmail })
    ),
  confirmEmailChange: (token: string) =>
    data<{ signedOut: boolean }>(apiClient.post('/settings/account/email-change/confirm', { token })),
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    data<{ signedOut: boolean }>(
      apiClient.post('/settings/security/change-password', { currentPassword, newPassword, confirmPassword })
    ),
  sessions: () => data<{ items: SessionInfo[] }>(apiClient.get('/settings/security/sessions')),
  revokeSession: (id: string) =>
    data<{ signedOut: boolean }>(apiClient.delete(`/settings/security/sessions/${id}`)),
  logoutOthers: (currentPassword: string) =>
    data<{ revoked: boolean }>(apiClient.post('/settings/security/logout-others', { currentPassword })),
  logoutAll: (currentPassword: string) =>
    data<{ signedOut: boolean }>(apiClient.post('/settings/security/logout-all', { currentPassword })),
  privacy: () => data<{ settings: PrivacySettings }>(apiClient.get('/settings/privacy')),
  updatePrivacy: (settings: Partial<PrivacySettings>) =>
    data<{ settings: PrivacySettings }>(apiClient.patch('/settings/privacy', settings)),
  blocked: () => data<{ items: BlockedMember[] }>(apiClient.get('/settings/blocked-users')),
  unblock: (userId: string) => data<unknown>(apiClient.delete(`/users/${userId}/block`)),
  deactivate: (currentPassword: string) =>
    data<{ signedOut: boolean }>(
      apiClient.post('/settings/account/deactivate', { currentPassword, confirmation: 'DEACTIVATE' })
    ),
  exportData: async (currentPassword: string) =>
    (await apiClient.post<Blob>('/settings/data/export', { currentPassword }, { responseType: 'blob' })).data,
  forgotPassword: (email: string) =>
    data<{ requested: boolean }>(apiClient.post('/auth/forgot-password', { email })),
  resetPassword: (token: string, newPassword: string, confirmPassword: string) =>
    data<{ reset: boolean }>(apiClient.post('/auth/reset-password', { token, newPassword, confirmPassword })),
  reactivate: (email: string, password: string) =>
    data<{ user: unknown }>(apiClient.post('/auth/reactivate', { email, password }))
};
