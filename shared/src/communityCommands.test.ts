import { describe, expect, it } from 'vitest';
import {
  eventPayloadSchema,
  meetupPayloadSchema,
  needReferralPayloadSchema,
  referralPayloadSchema
} from './communityCommands.js';

describe('community command payload contracts', () => {
  it('normalizes a valid referral and rejects unknown fields, markup, and unsafe links', () => {
    const payload = {
      jobTitle: ' Engineer ',
      company: 'Example Co',
      location: 'Remote',
      workMode: 'remote',
      jobUrl: 'https://example.com/jobs/1',
      description: 'A professional role is open.'
    };
    expect(referralPayloadSchema.parse(payload).jobTitle).toBe('Engineer');
    expect(referralPayloadSchema.safeParse({ ...payload, authorId: 'a'.repeat(24) }).success).toBe(false);
    expect(
      referralPayloadSchema.safeParse({ ...payload, description: '<script>alert(1)</script>' }).success
    ).toBe(false);
    expect(referralPayloadSchema.safeParse({ ...payload, jobUrl: 'javascript:alert(1)' }).success).toBe(
      false
    );
    expect(
      referralPayloadSchema.safeParse({ ...payload, jobUrl: 'https://user:secret@example.com/job' }).success
    ).toBe(false);
  });

  it('validates referral requests and rejects extra payload properties', () => {
    const payload = {
      jobTitle: 'Engineer',
      company: 'Example Co',
      experienceLevel: 'mid',
      message: 'Please refer me for this role.'
    };
    expect(needReferralPayloadSchema.safeParse(payload).success).toBe(true);
    expect(needReferralPayloadSchema.safeParse({ ...payload, chat: 'hello' }).success).toBe(false);
    expect(needReferralPayloadSchema.safeParse({ ...payload, experienceLevel: 'unknown' }).success).toBe(
      false
    );
  });

  it('requires valid event dates and an HTTPS online location', () => {
    const payload = {
      title: 'Design forum',
      description: 'A professional design forum.',
      startAt: '2026-12-01T10:00:00.000Z',
      endAt: '2026-12-01T11:00:00.000Z',
      locationType: 'online',
      locationOrUrl: 'https://example.com/event'
    };
    expect(eventPayloadSchema.safeParse(payload).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ ...payload, endAt: '2026-12-01T09:00:00.000Z' }).success).toBe(
      false
    );
    expect(
      eventPayloadSchema.safeParse({ ...payload, locationOrUrl: 'http://example.com/event' }).success
    ).toBe(false);
    expect(eventPayloadSchema.safeParse({ ...payload, startAt: 'tomorrow' }).success).toBe(false);
  });

  it('bounds meetup capacity and rejects unknown fields', () => {
    const payload = {
      title: 'Engineering meetup',
      description: 'Local engineering discussion.',
      scheduledAt: '2026-12-01T10:00:00.000Z',
      locationType: 'in_person',
      locationOrUrl: 'Community hall',
      capacity: 25
    };
    expect(meetupPayloadSchema.safeParse(payload).success).toBe(true);
    expect(meetupPayloadSchema.safeParse({ ...payload, capacity: 0 }).success).toBe(false);
    expect(meetupPayloadSchema.safeParse({ ...payload, capacity: 10001 }).success).toBe(false);
    expect(meetupPayloadSchema.safeParse({ ...payload, rsvp: true }).success).toBe(false);
  });
  it('accepts optional referral experience and skills while preserving old payloads', () => {
    const base = { jobTitle: 'Engineer', company: 'Example Co', location: 'Remote', workMode: 'remote', jobUrl: 'https://example.com/job', description: 'A professional engineering role.' };
    expect(referralPayloadSchema.safeParse(base).success).toBe(true);
    expect(referralPayloadSchema.safeParse({ ...base, experienceMin: 2, experienceMax: 4, requiredSkills: ['React'] }).success).toBe(true);
    expect(referralPayloadSchema.safeParse({ ...base, experienceMin: 5, experienceMax: 2 }).success).toBe(false);
    expect(referralPayloadSchema.safeParse({ ...base, requiredSkills: Array(13).fill('React') }).success).toBe(false);
  });
});
