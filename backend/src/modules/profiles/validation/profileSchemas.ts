import {
  PROFESSIONAL_STATUSES,
  PROFILE_VISIBILITIES,
  PROFILE_SECTION_IDS,
  USERNAME_PATTERN
} from '@voklance/shared';
import { z } from 'zod';

export const usernameSchema = z.string().trim().toLowerCase().regex(USERNAME_PATTERN);

const secureUrl = z
  .url()
  .max(2048)
  .transform((value) => new URL(value).toString())
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }, 'Use a secure HTTPS URL without embedded credentials.');

const githubUrl = secureUrl.refine((value) => {
  const url = new URL(value);
  return ['github.com', 'www.github.com'].includes(url.hostname) && url.pathname !== '/';
}, 'Enter a GitHub profile URL.');

const profileFields = z.object({
  username: usernameSchema,
  fullName: z.string().trim().min(2).max(80),
  headline: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(100),
  city: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(500).optional(),
  githubUrl: githubUrl.nullable().optional(),
  portfolioUrl: secureUrl.nullable().optional(),
  websiteUrl: secureUrl.nullable().optional(),
  visibility: z.enum(PROFILE_VISIBILITIES).optional()
});

export const basicProfileSchema = profileFields.strict();

export const professionalStatusSchema = z.enum(PROFESSIONAL_STATUSES);

export const profilePatchSchema = profileFields
  .partial()
  .extend({
    professionalStatus: professionalStatusSchema.optional(),
    sectionOrder: z
      .array(z.enum(PROFILE_SECTION_IDS))
      .length(PROFILE_SECTION_IDS.length)
      .refine((items) => new Set(items).size === PROFILE_SECTION_IDS.length)
      .optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one profile field.');

export const usernameQuerySchema = z.object({ username: usernameSchema }).strict();
export const publicUsernameParamsSchema = z.object({ username: usernameSchema }).strict();

export type BasicProfileInput = z.infer<typeof basicProfileSchema>;
export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type UsernameQuery = z.infer<typeof usernameQuerySchema>;
