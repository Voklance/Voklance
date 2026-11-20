import { z } from 'zod';
import { usernameSchema } from '../../profiles/validation/profileSchemas.js';

export const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
export const requestBody = z
  .object({ recipientId: objectId.optional(), recipientUsername: usernameSchema.optional() })
  .strict()
  .refine((value) => Number(!!value.recipientId) + Number(!!value.recipientUsername) === 1);
export const requestParams = z.object({ requestId: objectId }).strict();
export const connectionParams = z.object({ connectionId: objectId }).strict();
export const statusParams = z.object({ userId: objectId }).strict();
export const usernameParams = z.object({ username: usernameSchema }).strict();
export const pageQuery = z
  .object({
    search: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(30).default(12),
    cursor: z.string().min(1).max(512).optional()
  })
  .strict();
export const discoveryQuery = pageQuery.extend({
  skill: z.string().trim().max(80).optional(),
  location: z.string().trim().max(100).optional()
});
export const networkSettingsBody = z
  .object({
    profileDiscoverable: z.boolean().optional(),
    allowConnectionRequests: z.boolean().optional(),
    connectionListVisibility: z.enum(['private', 'connections']).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export type PageQuery = z.infer<typeof pageQuery>;
export type DiscoveryQuery = z.infer<typeof discoveryQuery>;
