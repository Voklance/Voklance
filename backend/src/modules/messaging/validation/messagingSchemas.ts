import { MESSAGE_LIMIT, MESSAGE_REPORT_REASONS } from '@voklance/shared';
import { z } from 'zod';
import { usernameSchema } from '../../profiles/validation/profileSchemas.js';
export const id = z.string().regex(/^[0-9a-f]{24}$/i);
export const conversationParams = z.object({ conversationId: id }).strict();
export const messageParams = z.object({ messageId: id }).strict();
export const userParams = z.object({ userId: id }).strict();
export const createConversationBody = z
  .object({ recipientId: id.optional(), recipientUsername: usernameSchema.optional() })
  .strict()
  .refine((value) => Number(!!value.recipientId) + Number(!!value.recipientUsername) === 1);
export const sendBody = z
  .object({ clientMessageId: z.uuid(), body: z.string().trim().min(1).max(MESSAGE_LIMIT) })
  .strict();
export const socketSend = sendBody.extend({ conversationId: id });
export const readBody = z.object({ messageId: id }).strict();
export const socketRead = readBody.extend({ conversationId: id });
export const conversationIdPayload = z.object({ conversationId: id }).strict();
export const presencePayload = z.object({ userId: id }).strict();
export const preferencesBody = z
  .object({ muted: z.boolean().optional(), archived: z.boolean().optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export const privacyBody = z
  .object({
    allowDirectMessages: z.boolean().optional(),
    showReadReceipts: z.boolean().optional(),
    showOnlineStatus: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export const reportBody = z.object({ reason: z.enum(MESSAGE_REPORT_REASONS) }).strict();
export const messagesQuery = z
  .object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: id.optional() })
  .strict();
export const conversationsQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(512).optional(),
    search: z.string().trim().max(100).optional(),
    includeArchived: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional()
  })
  .strict();
export type MessagesQuery = z.infer<typeof messagesQuery>;
export type ConversationsQuery = z.infer<typeof conversationsQuery>;
