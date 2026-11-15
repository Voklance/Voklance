import { COMMUNITY_CATEGORIES } from '@voklance/shared';
import { z } from 'zod';

const id = z.string().regex(/^[0-9a-f]{24}$/i);
export const communityIdParams = z.object({ communityId: id }).strict();
export const communitySlugParams = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100)
  })
  .strict();
export const memberParams = z.object({ communityId: id, userId: id }).strict();
export const requestParams = z.object({ communityId: id, requestId: id }).strict();
const name = z.string().trim().min(3).max(80);
const description = z.string().trim().min(10).max(1000);
const tags = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9 -]{0,29}$/)
  )
  .max(8)
  .refine((items) => new Set(items).size === items.length);
const rules = z.string().trim().max(3000);
const visibility = z.enum(['PUBLIC', 'PRIVATE']);
export const createCommunityBody = z
  .object({
    name,
    description,
    category: z.enum(COMMUNITY_CATEGORIES),
    tags: tags.default([]),
    visibility: visibility.default('PUBLIC'),
    rules: rules.default('')
  })
  .strict();
export const updateCommunityBody = z
  .object({
    name: name.optional(),
    description: description.optional(),
    category: z.enum(COMMUNITY_CATEGORIES).optional(),
    tags: tags.optional(),
    visibility: visibility.optional(),
    rules: rules.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export const roleBody = z.object({ role: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']) }).strict();
export const transferBody = z.object({ newOwnerUserId: id }).strict();
export const discoverQuery = z
  .object({
    search: z.string().trim().min(1).max(80).optional(),
    category: z.enum(COMMUNITY_CATEGORIES).optional(),
    visibility: visibility.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    cursor: z.string().min(1).max(256).optional()
  })
  .strict();
export const pageQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
    cursor: z.string().min(1).max(256).optional()
  })
  .strict();
export type CommunityCreate = z.infer<typeof createCommunityBody>;
export type CommunityUpdate = z.infer<typeof updateCommunityBody>;
export type CommunityDiscover = z.infer<typeof discoverQuery>;
export type CommunityPageQuery = z.infer<typeof pageQuery>;
