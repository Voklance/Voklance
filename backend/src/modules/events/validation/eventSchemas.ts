import { z } from 'zod';
import { plainText, safeUrl } from '@voklance/shared';

const id = z.string().regex(/^[0-9a-f]{24}$/i);
export const eventParams = z.object({ eventId: id }).strict();
export const communityEventParams = z.object({ communityId: id }).strict();
export const eventListQuery = z
  .object({
    communityId: id.optional(),
    type: z.enum(['event', 'meetup']).optional(),
    category: z.string().trim().max(80).optional(),
    locationType: z.enum(['online', 'in_person', 'hybrid']).optional(),
    upcoming: z.enum(['true', 'false']).default('true'),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    cursor: z.string().min(1).max(256).optional(),
    mine: z.enum(['organized', 'participating']).optional()
  })
  .strict();
export type EventListQuery = z.infer<typeof eventListQuery>;
export const attendeeQuery = z
  .object({
    response: z.enum(['going', 'interested']).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(100).optional()
  })
  .strict();
export type AttendeeQuery = z.infer<typeof attendeeQuery>;
export const rsvpBody = z.object({ response: z.enum(['going', 'interested', 'not_going']) }).strict();
const editable = z
  .object({
    title: plainText(3, 160).optional(),
    description: plainText(10, 2000).optional(),
    category: plainText(2, 80).nullable().optional(),
    startAt: z.iso.datetime({ offset: true }).optional(),
    endAt: z.iso.datetime({ offset: true }).optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
    locationType: z.enum(['online', 'in_person', 'hybrid']).optional(),
    venueName: plainText(3, 200)
      .refine((value) => !/https?:\/\//i.test(value), 'Use a venue description, not a meeting link.')
      .nullable()
      .optional(),
    onlineUrl: safeUrl.nullable().optional(),
    capacity: z.number().int().min(1).max(10000).nullable().optional(),
    registrationOpen: z.boolean().optional()
  })
  .strict();
export const eventPatchBody = editable.refine((value) => Object.keys(value).length > 0);
export type EventPatch = z.infer<typeof eventPatchBody>;
