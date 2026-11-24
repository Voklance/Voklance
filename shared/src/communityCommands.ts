import { z } from 'zod';
import { RESOURCE_CATEGORIES } from './resources.js';

export const COMMAND_IDS = ['referral', 'needreferral', 'event', 'meetup', 'discussion', 'resource'] as const;
export type CommandId = (typeof COMMAND_IDS)[number];
export const COMMAND_LABELS: Record<CommandId, string> = {
  referral: 'Referral opportunity',
  needreferral: 'Referral request',
  event: 'Professional event',
  meetup: 'Professional meetup',
  discussion: 'Discussion',
  resource: 'Share resource'
};
export const COMMAND_ERROR_CODES = [
  'COMMAND_UNKNOWN',
  'COMMAND_DISABLED',
  'COMMAND_FORBIDDEN',
  'COMMAND_VERSION_UNSUPPORTED',
  'COMMAND_PAYLOAD_INVALID',
  'ACTIVITY_NOT_FOUND'
] as const;
export type CommandErrorCode = (typeof COMMAND_ERROR_CODES)[number];

export const plainText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !/<\/?[a-z][^>]*>/i.test(value), 'HTML markup is not allowed.');
export const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .superRefine((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      context.addIssue({ code: 'custom', message: 'Enter a valid HTTPS URL.' });
      return;
    }
    if (url.protocol !== 'https:' || url.username || url.password)
      context.addIssue({ code: 'custom', message: 'Use an HTTPS URL without credentials.' });
  });
const dateTime = z.iso.datetime({ offset: true });
const locationType = z.enum(['online', 'in_person', 'hybrid']);
const location = plainText(3, 200);
const locationFields = z
  .object({ locationType, locationOrUrl: location, onlineUrl: safeUrl.optional() })
  .refine((value) => value.locationType !== 'online' || safeUrl.safeParse(value.locationOrUrl).success, {
    path: ['locationOrUrl'],
    message: 'Online activities need an HTTPS location URL.'
  })
  .refine(
    (value) => !/^https?:\/\//i.test(value.locationOrUrl) || safeUrl.safeParse(value.locationOrUrl).success,
    { path: ['locationOrUrl'], message: 'Location links must use HTTPS.' }
  )
  .refine((value) => value.locationType === 'online' || !/https?:\/\//i.test(value.locationOrUrl), {
    path: ['locationOrUrl'],
    message: 'Use a venue description here; put the private meeting link in the online link field.'
  })
  .refine((value) => value.locationType !== 'hybrid' || !!value.onlineUrl, {
    path: ['onlineUrl'],
    message: 'Hybrid activities need an HTTPS online link.'
  });

export const referralPayloadSchema = z
  .object({
    jobTitle: plainText(3, 120),
    company: plainText(2, 120),
    location: location,
    workMode: z.enum(['remote', 'hybrid', 'onsite']),
    jobUrl: safeUrl,
    description: plainText(10, 2000),
    experienceMin: z.number().int().min(0).max(60).optional(),
    experienceMax: z.number().int().min(0).max(60).optional(),
    requiredSkills: z.array(plainText(2, 40)).max(12).optional(),
    expiresAt: dateTime.optional()
  })
  .strict()
  .refine(
    (value) =>
      value.experienceMin === undefined ||
      value.experienceMax === undefined ||
      value.experienceMin <= value.experienceMax,
    { path: ['experienceMax'], message: 'Maximum experience must be at least the minimum.' }
  );
export const needReferralPayloadSchema = z
  .object({
    jobTitle: plainText(3, 120),
    company: plainText(2, 120),
    jobUrl: safeUrl.optional(),
    experienceLevel: z.enum(['entry', 'mid', 'senior']),
    skills: z.array(plainText(2, 40)).max(12).optional(),
    message: plainText(10, 2000)
  })
  .strict();
export const eventPayloadSchema = locationFields
  .safeExtend({
    title: plainText(3, 160),
    description: plainText(10, 2000),
    startAt: dateTime,
    endAt: dateTime.optional(),
    timezone: z.string().max(100).optional(),
    category: plainText(2, 80).optional(),
    capacity: z.number().int().min(1).max(10000).optional(),
    registrationOpen: z.boolean().optional()
  })
  .strict()
  .refine((value) => !value.endAt || Date.parse(value.endAt) > Date.parse(value.startAt), {
    path: ['endAt'],
    message: 'End time must be after start time.'
  });
export const meetupPayloadSchema = locationFields
  .safeExtend({
    title: plainText(3, 160),
    description: plainText(10, 2000),
    scheduledAt: dateTime,
    capacity: z.number().int().min(1).max(10000).optional(),
    timezone: z.string().max(100).optional()
  })
  .strict();
const resourceFields = z.object({
  title: plainText(3, 160),
  description: plainText(10, 2000),
  category: z.enum(RESOURCE_CATEGORIES),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(2)
        .max(30)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    )
    .max(8)
    .default([])
});
export const resourcePayloadSchema = z.union([
  resourceFields.extend({ fileId: z.string().regex(/^[0-9a-f]{24}$/i) }).strict(),
  resourceFields.extend({ url: safeUrl }).strict()
]);
export const discussionPayloadSchema = z
  .object({
    title: plainText(3, 160),
    body: plainText(10, 4000)
  })
  .strict();
export const commandPayloadSchemas = {
  referral: referralPayloadSchema,
  needreferral: needReferralPayloadSchema,
  event: eventPayloadSchema,
  meetup: meetupPayloadSchema,
  discussion: discussionPayloadSchema,
  resource: resourcePayloadSchema
} as const;

export type ReferralPayload = z.infer<typeof referralPayloadSchema>;
export type NeedReferralPayload = z.infer<typeof needReferralPayloadSchema>;
export type EventPayload = z.infer<typeof eventPayloadSchema>;
export type MeetupPayload = z.infer<typeof meetupPayloadSchema>;
export type ResourcePayload = z.infer<typeof resourcePayloadSchema>;
export type DiscussionPayload = z.infer<typeof discussionPayloadSchema>;
export type CommandPayload =
  ReferralPayload | NeedReferralPayload | EventPayload | MeetupPayload | DiscussionPayload | ResourcePayload;
export type CommandSubmission =
  | { command: 'referral'; payloadVersion: 1; payload: ReferralPayload }
  | { command: 'needreferral'; payloadVersion: 1; payload: NeedReferralPayload }
  | { command: 'event'; payloadVersion: 1; payload: EventPayload; idempotencyKey?: string }
  | { command: 'meetup'; payloadVersion: 1; payload: MeetupPayload; idempotencyKey?: string }
  | { command: 'discussion'; payloadVersion: 1; payload: DiscussionPayload }
  | { command: 'resource'; payloadVersion: 1; payload: ResourcePayload; idempotencyKey?: string };

export interface CommandMetadata {
  id: CommandId;
  command: `/${CommandId}`;
  label: string;
  description: string;
  iconId: string;
  category: 'career' | 'events' | 'knowledge';
  enabled: boolean;
  payloadVersion: 1;
  displayType: CommandId;
}

interface ActivityBase {
  id: string;
  communityId: string;
  author: { name: string; username: string | null; headline: string | null };
  commandLabel: string;
  payloadVersion: 1;
  createdAt: string;
  ownedByMe: boolean;
  canDelete: boolean;
  referralStatus?: 'OPEN' | 'CLOSED' | 'EXPIRED' | 'FULFILLED';
  eventStatus?: 'scheduled' | 'cancelled' | 'completed';
  eventId?: string;
  resourceId?: string;
}
export type CommunityActivity = ActivityBase &
  (
    | { command: 'referral'; payload: ReferralPayload }
    | { command: 'needreferral'; payload: NeedReferralPayload }
    | { command: 'event'; payload: EventPayload }
    | { command: 'meetup'; payload: MeetupPayload }
    | { command: 'discussion'; payload: DiscussionPayload }
    | { command: 'resource'; payload: ResourcePayload }
  );
export interface ActivityPage {
  items: CommunityActivity[];
  nextCursor: string | null;
  hasMore: boolean;
}
