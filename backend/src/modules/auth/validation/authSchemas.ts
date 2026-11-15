import { z } from 'zod';

export const signupSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(128)
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128)
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
