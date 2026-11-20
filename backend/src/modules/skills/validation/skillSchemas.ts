import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/i);

export const skillSelectionSchema = z
  .object({
    skillIds: z
      .array(objectIdSchema)
      .max(30)
      .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, {
        message: 'Choose each skill once.'
      })
  })
  .strict();

export const skillCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .transform((value) => value.replace(/\s+/g, ' '))
      .pipe(
        z
          .string()
          .min(1)
          .max(80)
          .regex(/[\p{L}\p{N}]/u)
      )
  })
  .strict();

export type SkillSelectionInput = z.infer<typeof skillSelectionSchema>;
export type SkillCreateInput = z.infer<typeof skillCreateSchema>;
