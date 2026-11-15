import { z } from 'zod';

const dateSchema = z.iso.date();

const experienceFields = z.object({
  jobTitle: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(120),
  employmentType: z.string().trim().min(2).max(60).optional(),
  startDate: dateSchema,
  endDate: dateSchema.nullable().optional(),
  isCurrent: z.boolean(),
  description: z.string().trim().max(2000).optional()
});

export const experienceSchema = experienceFields
  .strict()
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    message: 'End date must follow start date.',
    path: ['endDate']
  })
  .refine((value) => !value.isCurrent || !value.endDate, {
    message: 'A current role cannot have an end date.',
    path: ['endDate']
  });

export const experiencePatchSchema = experienceFields
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one experience field.');

const educationFields = z.object({
  institution: z.string().trim().min(2).max(160),
  degree: z.string().trim().max(120).optional(),
  fieldOfStudy: z.string().trim().max(120).optional(),
  startDate: dateSchema,
  endDate: dateSchema.nullable().optional()
});

export const educationSchema = educationFields
  .strict()
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    message: 'End date must follow start date.',
    path: ['endDate']
  });

export const educationPatchSchema = educationFields
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one education field.');

export type ExperienceInput = z.infer<typeof experienceSchema>;
export type ExperiencePatchInput = z.infer<typeof experiencePatchSchema>;
export type EducationInput = z.infer<typeof educationSchema>;
export type EducationPatchInput = z.infer<typeof educationPatchSchema>;
