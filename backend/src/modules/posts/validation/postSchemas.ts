import { COMMENT_CONTENT_LIMIT, POST_CONTENT_LIMIT, POST_REACTIONS } from '@voklance/shared';
import { z } from 'zod';

const id = z.string().regex(/^[0-9a-f]{24}$/i);
export const postParams = z.object({ postId: id }).strict();
export const commentParams = z.object({ postId: id, commentId: id }).strict();
export const postBody = z
  .object({
    content: z.string().trim().min(1).max(POST_CONTENT_LIMIT),
    visibility: z.literal('PROFESSIONALS').optional()
  })
  .strict();
export const postPatch = z.object({ content: z.string().trim().min(1).max(POST_CONTENT_LIMIT) }).strict();
export const reactionBody = z
  .object({ reaction: z.enum(POST_REACTIONS).default('like') })
  .strict()
  .default({ reaction: 'like' });
export const commentBody = z
  .object({ content: z.string().trim().min(1).max(COMMENT_CONTENT_LIMIT) })
  .strict();
export const pageQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
    cursor: z.string().min(1).max(256).optional()
  })
  .strict();
export type PageQuery = z.infer<typeof pageQuery>;
