import type { NotificationDto } from '@voklance/shared';
export interface NotificationPublisher {
  created(recipientId: string, notification: NotificationDto): Promise<void>;
  updated(recipientId: string, notificationId: string, readAt: string): Promise<void>;
  count(recipientId: string): Promise<void>;
}
let publisher: NotificationPublisher | null = null;
export function setNotificationPublisher(value: NotificationPublisher | null) {
  publisher = value;
}
export async function publishNotificationCreated(recipientId: string, notification: NotificationDto) {
  await publisher?.created(recipientId, notification);
}
export async function publishNotificationUpdated(
  recipientId: string,
  notificationId: string,
  readAt: string
) {
  await publisher?.updated(recipientId, notificationId, readAt);
}
export async function publishNotificationCount(recipientId: string) {
  await publisher?.count(recipientId);
}
