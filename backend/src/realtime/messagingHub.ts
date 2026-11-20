import type { MessageDto } from '@voklance/shared';
export interface MessagingPublisher {
  saved(
    message: MessageDto,
    senderId: string,
    recipientId: string,
    recipientMuted: boolean,
    originSocketId?: string
  ): Promise<void>;
  read(
    conversationId: string,
    readerId: string,
    senderId: string,
    messageId: string,
    readAt: string,
    publishReceipt: boolean
  ): Promise<void>;
  accessChanged(a: string, b: string): Promise<void>;
  privacyChanged(userId: string): Promise<void>;
}
let publisher: MessagingPublisher | null = null;
export function setMessagingPublisher(value: MessagingPublisher | null) {
  publisher = value;
}
export async function publishMessageSaved(
  message: MessageDto,
  senderId: string,
  recipientId: string,
  recipientMuted: boolean,
  originSocketId?: string
) {
  await publisher?.saved(message, senderId, recipientId, recipientMuted, originSocketId);
}
export async function publishMessageRead(
  conversationId: string,
  readerId: string,
  senderId: string,
  messageId: string,
  readAt: string,
  publishReceipt: boolean
) {
  await publisher?.read(conversationId, readerId, senderId, messageId, readAt, publishReceipt);
}
export async function publishAccessChanged(a: string, b: string) {
  await publisher?.accessChanged(a, b);
}
export async function publishPrivacyChanged(userId: string) {
  await publisher?.privacyChanged(userId);
}
