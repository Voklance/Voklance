import type { MessageReportReason } from '@voklance/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { sendFailure, sendSuccess } from '../../../common/apiResponse.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { authenticatedUser, requireAuth } from '../../../middleware/requireAuth.js';
import { requireCompletedOnboarding } from '../../../middleware/requireCompletedOnboarding.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateParams } from '../../../middleware/validateParams.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import {
  blockStatus,
  blockUser,
  createConversation,
  getConversation,
  listConversations,
  resolveConversationRecipient,
  unblockUser,
  unreadCounts,
  updatePreferences
} from '../service/conversationService.js';
import { listMessages, readMessage, reportMessage, sendMessage } from '../service/messageService.js';
import {
  conversationParams,
  conversationsQuery,
  createConversationBody,
  messageParams,
  messagesQuery,
  preferencesBody,
  readBody,
  reportBody,
  sendBody,
  userParams,
  type ConversationsQuery,
  type MessagesQuery
} from '../validation/messagingSchemas.js';

const guard = [
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
];
const writeLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 60,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many messaging actions. Please try again later.')
});
const user = (request: Parameters<typeof authenticatedUser>[0]) => authenticatedUser(request).id;
const conv = (request: { validatedParams?: unknown }) =>
  (request.validatedParams as { conversationId: string }).conversationId;

export const conversationRoutes = Router();
conversationRoutes.use(...guard);
conversationRoutes.post('/', writeLimit, validateBody(createConversationBody), async (request, response) => {
  const recipientId = await resolveConversationRecipient(
    request.body as { recipientId?: string; recipientUsername?: string }
  );
  sendSuccess(
    response,
    { conversation: await createConversation(user(request), recipientId) },
    'Conversation ready',
    201
  );
});
conversationRoutes.get('/', validateQuery(conversationsQuery), async (request, response) =>
  sendSuccess(
    response,
    await listConversations(user(request), request.validatedQuery as ConversationsQuery),
    'Conversations loaded'
  )
);
conversationRoutes.get('/unread-count', async (request, response) =>
  sendSuccess(response, { count: (await unreadCounts(user(request))).count }, 'Unread count loaded')
);
conversationRoutes.get('/:conversationId', validateParams(conversationParams), async (request, response) =>
  sendSuccess(
    response,
    { conversation: await getConversation(user(request), conv(request)) },
    'Conversation loaded'
  )
);
conversationRoutes.get(
  '/:conversationId/messages',
  validateParams(conversationParams),
  validateQuery(messagesQuery),
  async (request, response) => {
    const query = request.validatedQuery as MessagesQuery;
    sendSuccess(
      response,
      await listMessages(user(request), conv(request), query.limit, query.cursor),
      'Messages loaded'
    );
  }
);
conversationRoutes.post(
  '/:conversationId/messages',
  writeLimit,
  validateParams(conversationParams),
  validateBody(sendBody),
  async (request, response) => {
    const input = request.body as { body: string; clientMessageId: string };
    const result = await sendMessage(user(request), conv(request), input.body, input.clientMessageId);
    sendSuccess(response, result, 'Message saved', result.created ? 201 : 200);
  }
);
conversationRoutes.post(
  '/:conversationId/read',
  writeLimit,
  validateParams(conversationParams),
  validateBody(readBody),
  async (request, response) =>
    sendSuccess(
      response,
      await readMessage(user(request), conv(request), (request.body as { messageId: string }).messageId),
      'Read position updated'
    )
);
conversationRoutes.patch(
  '/:conversationId/preferences',
  writeLimit,
  validateParams(conversationParams),
  validateBody(preferencesBody),
  async (request, response) =>
    sendSuccess(
      response,
      {
        preferences: await updatePreferences(
          user(request),
          conv(request),
          request.body as { muted?: boolean; archived?: boolean }
        )
      },
      'Conversation preferences saved'
    )
);

export const userBlockRoutes = Router();
userBlockRoutes.use(...guard);
userBlockRoutes.get('/:userId/block', validateParams(userParams), async (request, response) =>
  sendSuccess(
    response,
    await blockStatus(user(request), (request.validatedParams as { userId: string }).userId),
    'Block status loaded'
  )
);
userBlockRoutes.post('/:userId/block', writeLimit, validateParams(userParams), async (request, response) =>
  sendSuccess(
    response,
    await blockUser(user(request), (request.validatedParams as { userId: string }).userId),
    'User blocked'
  )
);
userBlockRoutes.delete('/:userId/block', writeLimit, validateParams(userParams), async (request, response) =>
  sendSuccess(
    response,
    await unblockUser(user(request), (request.validatedParams as { userId: string }).userId),
    'User unblocked'
  )
);

export const messageReportRoutes = Router();
messageReportRoutes.use(...guard);
messageReportRoutes.post(
  '/:messageId/report',
  writeLimit,
  validateParams(messageParams),
  validateBody(reportBody),
  async (request, response) =>
    sendSuccess(
      response,
      await reportMessage(
        user(request),
        (request.validatedParams as { messageId: string }).messageId,
        (request.body as { reason: MessageReportReason }).reason
      ),
      'Message reported',
      201
    )
);
