import type {
  ApiSuccess,
  NotificationCategory,
  NotificationDto,
  NotificationPage,
  NotificationPreferences
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';
const data = async <T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> => (await request).data.data;
export const notificationApi = {
  list: (category?: NotificationCategory, unreadOnly = false, cursor?: string) =>
    data<NotificationPage>(
      apiClient.get('/notifications', {
        params: {
          category,
          unreadOnly: unreadOnly ? 'true' : 'false',
          limit: 20,
          ...(cursor ? { cursor } : {})
        }
      })
    ),
  unread: () => data<{ unreadCount: number }>(apiClient.get('/notifications/unread-count')),
  read: (id: string) => data<{ notification: NotificationDto }>(apiClient.patch(`/notifications/${id}/read`)),
  readAll: (category?: NotificationCategory) =>
    data<{ affectedCount: number; unreadCount: number }>(
      apiClient.patch('/notifications/read-all', category ? { category } : {})
    ),
  preferences: () =>
    data<{ preferences: NotificationPreferences }>(apiClient.get('/notifications/preferences')),
  savePreferences: (preferences: Partial<NotificationPreferences>) =>
    data<{ preferences: NotificationPreferences }>(
      apiClient.patch('/notifications/preferences', { preferences })
    )
};
