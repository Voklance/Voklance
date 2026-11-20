import { z } from 'zod';
const date = z.iso.date();
const url = z
  .url()
  .max(2048)
  .refine((value) => {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  }, 'Use an HTTPS URL without credentials.');
const optionalUrl = url.nullable().optional();
const optionalDate = date.nullable().optional();
const certificationFields = z
  .object({
    name: z.string().trim().min(2).max(160),
    issuingOrganization: z.string().trim().min(2).max(160),
    issueDate: date,
    expirationDate: optionalDate,
    credentialId: z.string().trim().max(160).nullable().optional(),
    credentialUrl: optionalUrl
  })
  .strict();
export const certificationBody = certificationFields.refine(
  (value) => !value.expirationDate || value.expirationDate >= value.issueDate,
  'Expiration date must follow issue date.'
);
const projectFields = z
  .object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(10).max(2000),
    role: z.string().trim().max(120).default(''),
    technologies: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
    projectUrl: optionalUrl,
    repositoryUrl: optionalUrl,
    startDate: optionalDate,
    endDate: optionalDate,
    isOngoing: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    displayOrder: z.number().int().min(0).max(1000).default(0)
  })
  .strict();
export const projectBody = projectFields
  .refine((value) => !value.endDate || !!value.startDate, 'Start date is required when end date is set.')
  .refine(
    (value) => !value.endDate || !value.startDate || value.endDate >= value.startDate,
    'End date must follow start date.'
  )
  .refine((value) => !value.isOngoing || !value.endDate, 'Ongoing projects cannot have an end date.')
  .refine(
    (value) =>
      new Set(value.technologies.map((item) => item.toLowerCase())).size === value.technologies.length,
    'Technologies must be unique.'
  );
export const idParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
export const certificationPatch = certificationFields
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const projectPatch = projectFields
  .partial()
  .extend({
    role: z.string().trim().max(120).optional(),
    technologies: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    isOngoing: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(1000).optional()
  })
  .refine((value) => Object.keys(value).length > 0);
