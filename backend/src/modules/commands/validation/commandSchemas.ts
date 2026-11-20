import { COMMAND_IDS } from '@voklance/shared';
import { z } from 'zod';

const id = z.string().regex(/^[0-9a-f]{24}$/i);
export const communityParams = z.object({ communityId: id }).strict();
export const activityParams = z.object({ communityId: id, activityId: id }).strict();
export const submissionBody = z
  .object({
    command: z.string().regex(/^[a-z]{1,30}$/),
    payloadVersion: z.number().int(),
    idempotencyKey: z.uuid().optional(),
    payload: z.unknown()
  })
  .strict();
export const activityQuery = z
  .object({
    command: z.enum(COMMAND_IDS).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    cursor: z.string().min(1).max(256).optional()
  })
  .strict();
export type ActivityQuery = z.infer<typeof activityQuery>;
export type SubmissionInput = z.infer<typeof submissionBody>;
