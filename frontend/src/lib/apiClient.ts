import { API_V1_PREFIX, type ApiFailure } from '@voklance/shared';
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { clearAuthenticatedCache, getSessionGeneration } from '@/features/auth/cache/authCache';
import { queryClient } from './queryClient';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL?.trim() || API_V1_PREFIX,
  withCredentials: true,
  timeout: 15_000
});

type SessionRequestConfig = InternalAxiosRequestConfig & { sessionGeneration?: number };

apiClient.interceptors.request.use((config) => {
  (config as SessionRequestConfig).sessionGeneration = getSessionGeneration();
  return config;
});

apiClient.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const url = error.config?.url || '';
    const isPublicAuth = /^\/?auth\/(login|signup|logout|verify-email)(?:\?|$)/.test(url);
    const generation = (error.config as SessionRequestConfig | undefined)?.sessionGeneration;
    if (!isPublicAuth && generation === getSessionGeneration()) void clearAuthenticatedCache(queryClient);
  }
  return Promise.reject(error);
});

export function apiErrorMessage(error: unknown) {
  if (axios.isAxiosError<ApiFailure>(error)) {
    return (
      error.response?.data?.error?.message || 'Unable to reach Voklance. Check your connection and try again.'
    );
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
