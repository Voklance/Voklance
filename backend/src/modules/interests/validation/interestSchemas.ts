import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/i);

export const interestSelectionSchema = z
  .object({
    interestIds: z
      .array(objectIdSchema)
      .max(30)
      .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, {
        message: 'Choose each interest once.'
      })
  })
  .strict();

export type InterestSelectionInput = z.infer<typeof interestSelectionSchema>;
