import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/apiClient';
import { communityApi } from './communityApi';

vi.mock('@/lib/apiClient', () => ({ apiClient: { get: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockResolvedValue({
    data: { success: true, data: { items: [], nextCursor: null, hasMore: false }, message: 'ok' }
  });
});
describe('community API cursors', () => {
  it('omits an empty first-page cursor and sends a real continuation cursor', async () => {
    await communityApi.discover({ category: 'software-development' }, '');
    expect(apiClient.get).toHaveBeenCalledWith('/communities', {
      params: { category: 'software-development', limit: 10 }
    });
    await communityApi.mine('next-page');
    expect(apiClient.get).toHaveBeenCalledWith('/users/me/communities', {
      params: { limit: 10, cursor: 'next-page' }
    });
  });
});
