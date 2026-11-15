import { z } from 'zod';

export const verifyEmailSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
