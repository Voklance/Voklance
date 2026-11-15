import type { ApiSuccess, AuthUser } from '@voklance/shared';
import axios from 'axios';
import { apiClient } from '@/lib/apiClient';

interface UserPayload {
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}
export interface SignupInput extends LoginInput {
  name: string;
}

export const authApi = {
  async currentUser(): Promise<AuthUser | null> {
    try {
      const response = await apiClient.get<ApiSuccess<UserPayload>>('/auth/me');
      return response.data.data.user;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) return null;
      throw error;
    }
  },
  async login(input: LoginInput) {
    const response = await apiClient.post<ApiSuccess<UserPayload>>('/auth/login', input);
    return response.data.data.user;
  },
  async signup(input: SignupInput) {
    const response = await apiClient.post<ApiSuccess<UserPayload & { verificationEmailSent: boolean }>>(
      '/auth/signup',
      input
    );
    return response.data.data;
  },
  async logout() {
    await apiClient.post('/auth/logout');
  }
};
