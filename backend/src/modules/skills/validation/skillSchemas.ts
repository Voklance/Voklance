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

export type SkillSelectionInput = z.infer<typeof skillSelectionSchema>;
