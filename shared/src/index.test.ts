import { describe, expect, it } from 'vitest';
import {
  API_V1_PREFIX,
  ACCOUNT_STATUSES,
  ONBOARDING_STATUSES,
  PROFESSIONAL_STATUSES,
  USERNAME_PATTERN,
  type ApiSuccess,
  type HealthData,
  type OnboardingSnapshot
} from './index.js';

describe('shared package', () => {
  it('exports the API prefix and response contract', () => {
    const response: ApiSuccess<HealthData> = {
      success: true,
      data: {
        status: 'ok',
        service: 'Voklance API',
        database: 'disconnected',
        timestamp: '2026-01-01T00:00:00.000Z'
      },
      message: 'Service healthy'
    };
    expect(API_V1_PREFIX).toBe('/api/v1');
    expect(response.data.service).toBe('Voklance API');
  });

  it('exports browser-safe onboarding contracts', () => {
    const snapshot: OnboardingSnapshot = {
      status: 'NOT_STARTED',
      currentStep: 1,
      completedSteps: [],
      profile: null,
      skills: [],
      interests: [],
      experiences: [],
      education: []
    };
    expect(ACCOUNT_STATUSES).toContain('ACTIVE');
    expect(ONBOARDING_STATUSES).toContain(snapshot.status);
    expect(PROFESSIONAL_STATUSES).toContain('STUDENT');
    expect(USERNAME_PATTERN.test('ada.dev')).toBe(true);
    expect(USERNAME_PATTERN.test('Invalid Name')).toBe(false);
  });
});
