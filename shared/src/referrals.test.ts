import { describe, expect, it } from 'vitest';
import { referralApplicationSchema, referralOfferSchema } from './referrals.js';

describe('private referral response contracts', () => {
  it('validates a structured application and rejects extra fields and unsafe links', () => {
    const input = {
      introduction: 'I have relevant engineering experience.',
      relevantSkills: ['React'],
      portfolioUrl: 'https://example.com/profile'
    };
    expect(referralApplicationSchema.safeParse(input).success).toBe(true);
    expect(referralApplicationSchema.safeParse({ ...input, applicantId: 'a'.repeat(24) }).success).toBe(
      false
    );
    expect(
      referralApplicationSchema.safeParse({ ...input, portfolioUrl: 'javascript:alert(1)' }).success
    ).toBe(false);
    expect(
      referralApplicationSchema.safeParse({ ...input, introduction: '<script>alert(1)</script>' }).success
    ).toBe(false);
  });
  it('validates structured offers without accepting arbitrary status or employer verification claims', () => {
    const input = {
      introduction: 'I can help with this referral request.',
      offerDetails: 'I can submit a referral through our employee portal.'
    };
    expect(referralOfferSchema.safeParse(input).success).toBe(true);
    expect(referralOfferSchema.safeParse({ ...input, status: 'SUBMITTED' }).success).toBe(false);
    expect(referralOfferSchema.safeParse({ ...input, employerVerified: true }).success).toBe(false);
  });
});
