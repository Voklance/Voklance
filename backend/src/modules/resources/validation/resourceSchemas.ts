import { z } from 'zod';
import { RESOURCE_CATEGORIES, plainText } from '@voklance/shared';

const id = z.string().regex(/^[0-9a-f]{24}$/i);
export const resourceParams = z.object({ resourceId: id }).strict();
export const reportParams = z.object({ reportId: id }).strict();
export const communityParams = z.object({ communityId: id }).strict();
export const uploadQuery = z.object({ communityId: id }).strict();
export const resourceQuery = z
  .object({
    search: z.string().trim().min(2).max(100).optional(),
    category: z.enum(RESOURCE_CATEGORIES).optional(),
    tag: z
      .string()
      .trim()
      .min(2)
      .max(30)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    cursor: z.string().min(1).max(100).optional()
  })
  .strict();
export type ResourceQuery = z.infer<typeof resourceQuery>;
export const patchBody = z
  .object({
    title: plainText(3, 160).optional(),
    description: plainText(10, 2000).optional(),
    category: z.enum(RESOURCE_CATEGORIES).optional(),
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
      .optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export type ResourcePatch = z.infer<typeof patchBody>;
export const reportBody = z
  .object({
    reason: z.enum(['spam', 'misleading', 'copyright', 'inappropriate', 'malicious', 'other']),
    description: plainText(10, 1000).optional()
  })
  .strict();
export type ReportInput = z.infer<typeof reportBody>;
export const reportQuery = z
  .object({
    status: z.enum(['pending', 'reviewed', 'dismissed']).default('pending'),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(100).optional()
  })
  .strict();
export type ReportQuery = z.infer<typeof reportQuery>;
export const reviewBody = z.object({ decision: z.enum(['hide', 'dismiss']) }).strict();
