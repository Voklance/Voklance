import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/i);
export const idParamSchema = z.object({ id: objectIdSchema }).strict();
export type IdParam = z.infer<typeof idParamSchema>;

export const catalogQuerySchema = z
  .object({
    search: z.string().trim().max(80).optional(),
    category: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict();

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
