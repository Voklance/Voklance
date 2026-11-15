// @vitest-environment jsdom
import type { AuthUser } from '@voklance/shared';
import type { InternalAxiosRequestConfig } from 'axios';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { currentUserKey, prepareAuthenticatedCache } from '@/features/auth/cache/authCache';
import { apiClient } from './apiClient';
import { queryClient } from './queryClient';

const account: AuthUser = {
  id: 'a'.repeat(24),
  name: 'Sam Engineer',
  email: 'sam@example.test',
  accountStatus: 'ACTIVE',
  onboardingStatus: 'COMPLETED',
  emailVerifiedAt: null,
  emailVerificationRequired: false
};

function unauthorized(config: InternalAxiosRequestConfig) {
  return Object.assign(new Error('Unauthorized'), {
    isAxiosError: true,
    config,
    response: {
      status: 401,
      data: { success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired.' } }
    }
  });
}

afterEach(() => queryClient.clear());

describe('API session response handling', () => {
  it('clears account and private data after a protected 401', async () => {
    queryClient.setQueryData(currentUserKey, account);
    queryClient.setQueryData(['onboarding', 'progress'], { private: true });
    await expect(
      apiClient.get('/profiles/me', {
        adapter: async (config) => {
          throw unauthorized(config);
        }
      })
    ).rejects.toBeTruthy();
    await waitFor(() => expect(queryClient.getQueryData(currentUserKey)).toBeNull());
    expect(queryClient.getQueryData(['onboarding', 'progress'])).toBeUndefined();
  });

  it('keeps account state on invalid login credentials or a network failure', async () => {
    queryClient.setQueryData(currentUserKey, account);
    await expect(
      apiClient.post(
        '/auth/login',
        {},
        {
          adapter: async (config) => {
            throw unauthorized(config);
          }
        }
      )
    ).rejects.toBeTruthy();
    await expect(
      apiClient.get('/profiles/me', {
        adapter: async () => {
          throw new Error('Network unavailable');
        }
      })
    ).rejects.toBeTruthy();
    expect(queryClient.getQueryData(currentUserKey)).toEqual(account);
  });

  it('clears private data when the authoritative current-user lookup expires', async () => {
    queryClient.setQueryData(currentUserKey, account);
    queryClient.setQueryData(['onboarding', 'progress'], { private: true });
    await expect(
      apiClient.get('/auth/me', {
        adapter: async (config) => {
          throw unauthorized(config);
        }
      })
    ).rejects.toBeTruthy();
    await waitFor(() => expect(queryClient.getQueryData(currentUserKey)).toBeNull());
    expect(queryClient.getQueryData(['onboarding', 'progress'])).toBeUndefined();
  });

  it('ignores a delayed 401 from a previous account after switching sessions', async () => {
    queryClient.setQueryData(currentUserKey, account);
    let rejectOld: ((error: unknown) => void) | undefined;
    let oldConfig: InternalAxiosRequestConfig | undefined;
    const oldRequest = apiClient.get('/profiles/me', {
      adapter: (config) => {
        oldConfig = config;
        return new Promise((_resolve, reject) => {
          rejectOld = reject;
        });
      }
    });
    await waitFor(() => expect(rejectOld).toBeDefined());
    await prepareAuthenticatedCache(queryClient);
    const next = { ...account, id: 'b'.repeat(24) };
    queryClient.setQueryData(currentUserKey, next);
    rejectOld?.(unauthorized(oldConfig!));
    await expect(oldRequest).rejects.toBeTruthy();
    expect(queryClient.getQueryData(currentUserKey)).toEqual(next);
  });
});
