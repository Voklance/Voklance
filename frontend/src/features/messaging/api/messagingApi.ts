import type {
  ApiSuccess,
  ConversationDto,
  ConversationPage,
  ConversationPreferences,
  MessageDto,
  MessagePage,
  MessageReportReason,
  MessagingPrivacySettings
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';
const data = async <T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> => (await request).data.data;
export const messagingApi = {
  conversations: (search?: string, cursor?: string) =>
    data<ConversationPage>(
      apiClient.get('/conversations', { params: { search, limit: 20, ...(cursor ? { cursor } : {}) } })
    ),
  create: (recipientUsername: string) =>
    data<{ conversation: ConversationDto }>(apiClient.post('/conversations', { recipientUsername })),
  conversation: (id: string) =>
    data<{ conversation: ConversationDto }>(apiClient.get(`/conversations/${id}`)),
  messages: (id: string, cursor?: string) =>
    data<MessagePage>(
      apiClient.get(`/conversations/${id}/messages`, { params: { limit: 20, ...(cursor ? { cursor } : {}) } })
    ),
  send: (id: string, body: string, clientMessageId: string) =>
    data<{ message: MessageDto; created: boolean }>(
      apiClient.post(`/conversations/${id}/messages`, { body, clientMessageId })
    ),
  read: (id: string, messageId: string) =>
    data<{ messageId: string }>(apiClient.post(`/conversations/${id}/read`, { messageId })),
  unreadCount: () => data<{ count: number }>(apiClient.get('/conversations/unread-count')),
  preferences: (id: string, input: Partial<ConversationPreferences>) =>
    data<{ preferences: ConversationPreferences }>(
      apiClient.patch(`/conversations/${id}/preferences`, input)
    ),
  settings: () =>
    data<{ settings: MessagingPrivacySettings }>(apiClient.get('/profiles/me/messaging-settings')),
  saveSettings: (input: Partial<MessagingPrivacySettings>) =>
    data<{ settings: MessagingPrivacySettings }>(apiClient.patch('/profiles/me/messaging-settings', input)),
  block: (userId: string) => data<{ blocked: boolean }>(apiClient.post(`/users/${userId}/block`)),
  unblock: (userId: string) => data<{ blocked: boolean }>(apiClient.delete(`/users/${userId}/block`)),
  blockStatus: (userId: string) => data<{ blocked: boolean }>(apiClient.get(`/users/${userId}/block`)),
  report: (messageId: string, reason: MessageReportReason) =>
    data<{ reportId: string }>(apiClient.post(`/messages/${messageId}/report`, { reason }))
};
