import { z } from 'zod';

export const onboardingStepSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6)
]);

// Progress input only controls navigation. Completion is derived from persisted records.
export const onboardingProgressSchema = z.object({ currentStep: onboardingStepSchema }).strict();
export const onboardingCompleteSchema = z.object({}).strict().optional();
export const onboardingIdentitySchema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name.').max(80),
    lastName: z.string().trim().min(1, 'Enter your last name.').max(80),
    headline: z.string().trim().max(120).optional().default('')
  })
  .strict()
  .refine((value) => `${value.firstName} ${value.lastName}`.length <= 80, {
    path: ['lastName'],
    message: 'First and last name together must be 80 characters or fewer.'
  });

export type OnboardingProgressInput = z.infer<typeof onboardingProgressSchema>;
export type OnboardingIdentityInput = z.infer<typeof onboardingIdentitySchema>;
