import type { MessageDto, MessagePage, MessageReportReason } from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import { publishMessageRead, publishMessageSaved } from '../../../realtime/messagingHub.js';
import Conversation from '../model/Conversation.js';
import ConversationParticipantState from '../model/ConversationParticipantState.js';
import Message, { type MessageRecord } from '../model/Message.js';
import MessageReport from '../model/MessageReport.js';
import Profile from '../../profiles/model/Profile.js';
import { queueNotification } from '../../notifications/service/notificationOutbox.js';
import { assertConversation, hex, oid } from './messagingPermissions.js';

type StoredMessage = MessageRecord & { _id: Types.ObjectId };
export function toMessage(record: StoredMessage): MessageDto {
  return {
    id: hex(record._id),
    conversationId: hex(record.conversationId),
    senderId: hex(record.senderId),
    body: record.body,
    clientMessageId: record.clientMessageId,
    createdAt: record.createdAt.toISOString()
  };
}
export async function listMessages(
  userId: string,
  conversationId: string,
  limit: number,
  cursor?: string
): Promise<MessagePage> {
  await assertConversation(userId, conversationId);
  const records = await Message.find({
    conversationId: oid(conversationId),
    ...(cursor ? { _id: { $lt: oid(cursor) } } : {})
  })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = records.length > limit;
  const page = records.slice(0, limit);
  return {
    items: page.reverse().map(toMessage),
    hasMore,
    nextCursor: hasMore && page.length ? hex(page[0]._id) : null
  };
}
export async function sendMessage(
  userId: string,
  conversationId: string,
  body: string,
  clientMessageId: string,
  originSocketId?: string
) {
  const { otherId } = await assertConversation(userId, conversationId);
  const old = await Message.findOne({ senderId: oid(userId), clientMessageId }).lean();
  if (old) {
    if (hex(old.conversationId) !== conversationId || old.body !== body)
      throw new AppError(409, 'MESSAGE_ID_CONFLICT', 'Message identifier already used.');
    const state = await ConversationParticipantState.findOne({
      conversationId: oid(conversationId),
      userId: oid(otherId)
    })
      .select('muted')
      .lean();
    if (!state?.muted)
      await queueNotification({
        recipientId: otherId,
        actorId: userId,
        type: 'MESSAGE_RECEIVED',
        entityType: 'conversation',
        entityId: conversationId,
        deduplicationKey: `message:${hex(old._id)}`
      });
    return { message: toMessage(old), created: false };
  }
  let message: StoredMessage;
  try {
    message = await Message.create({
      conversationId: oid(conversationId),
      senderId: oid(userId),
      body,
      clientMessageId
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      const duplicate = await Message.findOne({ senderId: oid(userId), clientMessageId }).lean();
      if (duplicate && hex(duplicate.conversationId) === conversationId && duplicate.body === body)
        return { message: toMessage(duplicate), created: false };
      throw new AppError(409, 'MESSAGE_ID_CONFLICT', 'Message identifier already used.');
    }
    throw error;
  }
  await Conversation.updateOne(
    {
      _id: oid(conversationId),
      $or: [
        { lastMessageAt: { $lt: message.createdAt } },
        { lastMessageAt: message.createdAt, lastMessageId: { $lt: message._id } },
        { lastMessageAt: null }
      ]
    },
    { $set: { lastMessageId: message._id, lastMessageAt: message.createdAt, activityAt: message.createdAt } }
  );
  await ConversationParticipantState.updateOne(
    { conversationId: oid(conversationId), userId: oid(otherId) },
    { $set: { archived: false }, $setOnInsert: { muted: false } },
    { upsert: true }
  );
  const recipientState = await ConversationParticipantState.findOne({
    conversationId: oid(conversationId),
    userId: oid(otherId)
  })
    .select('muted')
    .lean();
  const result = toMessage(message);
  try {
    await assertConversation(userId, conversationId);
    await publishMessageSaved(result, userId, otherId, recipientState?.muted === true, originSocketId);
    if (!recipientState?.muted)
      await queueNotification({
        recipientId: otherId,
        actorId: userId,
        type: 'MESSAGE_RECEIVED',
        entityType: 'conversation',
        entityId: conversationId,
        deduplicationKey: `message:${result.id}`
      });
  } catch (error) {
    if (!(error instanceof AppError && error.code === 'CONVERSATION_UNAVAILABLE')) throw error;
  }
  return { message: result, created: true };
}
export async function readMessage(userId: string, conversationId: string, messageId: string) {
  const { otherId } = await assertConversation(userId, conversationId);
  const message = await Message.findOne({
    _id: oid(messageId),
    conversationId: oid(conversationId),
    senderId: oid(otherId)
  })
    .select('_id')
    .lean();
  if (!message) throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message unavailable.');
  const readAt = new Date();
  const updated = await ConversationParticipantState.findOneAndUpdate(
    {
      conversationId: oid(conversationId),
      userId: oid(userId),
      $or: [
        { lastReadMessageId: null },
        { lastReadMessageId: { $exists: false } },
        { lastReadMessageId: { $lt: message._id } }
      ]
    },
    { $set: { lastReadMessageId: message._id, lastReadAt: readAt } },
    { new: true }
  );
  if (!updated) {
    const state = await ConversationParticipantState.findOne({
      conversationId: oid(conversationId),
      userId: oid(userId)
    })
      .select('lastReadMessageId')
      .lean();
    return { messageId: state?.lastReadMessageId ? hex(state.lastReadMessageId) : messageId, changed: false };
  }
  const profile = await Profile.findOne({ userId: oid(userId) })
    .select('showReadReceipts')
    .lean();
  await publishMessageRead(
    conversationId,
    userId,
    otherId,
    messageId,
    readAt.toISOString(),
    profile?.showReadReceipts === true
  );
  return { messageId, changed: true };
}
export async function reportMessage(userId: string, messageId: string, reason: MessageReportReason) {
  const message = await Message.findById(messageId).select('conversationId').lean();
  if (!message) throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message unavailable.');
  const conversation = await Conversation.findOne({
    _id: message.conversationId,
    $or: [{ participantAId: oid(userId) }, { participantBId: oid(userId) }]
  })
    .select('_id')
    .lean();
  if (!conversation) throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message unavailable.');
  try {
    const report = await MessageReport.create({
      messageId: message._id,
      conversationId: message.conversationId,
      reporterId: oid(userId),
      reason,
      status: 'pending'
    });
    return { reportId: hex(report._id) };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000)
      throw new AppError(409, 'MESSAGE_ALREADY_REPORTED', 'Message already reported.');
    throw error;
  }
}
