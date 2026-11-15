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

export type OnboardingProgressInput = z.infer<typeof onboardingProgressSchema>;
