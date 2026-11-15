import { PROFESSIONAL_STATUSES, USERNAME_PATTERN } from '@voklance/shared';
import { z } from 'zod';

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      USERNAME_PATTERN,
      'Use 3–30 lowercase letters, numbers, dots, underscores or hyphens; start with a letter.'
    ),
  headline: z.string().trim().min(2, 'Enter a professional headline.').max(120),
  country: z.string().trim().min(2, 'Enter your country.').max(100),
  city: z.string().trim().max(100),
  bio: z.string().trim().max(500)
});
export type ProfileDraft = z.infer<typeof profileSchema>;

export const statusSchema = z.enum(PROFESSIONAL_STATUSES);

export const experienceSchema = z
  .object({
    jobTitle: z.string().trim().min(2, 'Enter a job title.').max(120),
    companyName: z.string().trim().min(2, 'Enter an organization.').max(120),
    employmentType: z
      .string()
      .trim()
      .refine((value) => value === '' || value.length >= 2, 'Use at least 2 characters.')
      .max(60),
    startDate: z.iso.date(),
    endDate: z.union([z.iso.date(), z.literal('')]),
    isCurrent: z.boolean(),
    description: z.string().trim().max(2000)
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'End date must follow start date.'
  })
  .refine((value) => !value.isCurrent || !value.endDate, {
    path: ['endDate'],
    message: 'Current roles cannot have an end date.'
  });
export type ExperienceDraft = z.infer<typeof experienceSchema>;

export const educationSchema = z
  .object({
    institution: z.string().trim().min(2, 'Enter an institution.').max(160),
    degree: z.string().trim().max(120),
    fieldOfStudy: z.string().trim().max(120),
    startDate: z.iso.date(),
    endDate: z.union([z.iso.date(), z.literal('')])
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'End date must follow start date.'
  });
export type EducationDraft = z.infer<typeof educationSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return errors;
}
