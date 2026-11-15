import type { ApiSuccess } from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';

export const emailVerificationApi = {
  async verify(token: string) {
    const response = await apiClient.post<ApiSuccess<{ verified: true }>>('/auth/verify-email', { token });
    return response.data.data;
  },
  async resend() {
    const response = await apiClient.post<ApiSuccess<{ sent: true }>>('/auth/resend-verification');
    return response.data.data;
  }
};
