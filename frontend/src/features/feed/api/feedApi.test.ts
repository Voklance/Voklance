import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/apiClient';
import { feedApi } from './feedApi';

vi.mock('@/lib/apiClient', () => ({ apiClient: { get: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockResolvedValue({
    data: { success: true, data: { items: [], nextCursor: null, hasMore: false }, message: 'ok' }
  });
});
describe('feed API cursors', () => {
  it('omits empty first-page cursors and sends continuation cursors', async () => {
    await feedApi.feed('');
    expect(apiClient.get).toHaveBeenCalledWith('/posts', { params: { limit: 10 } });
    await feedApi.saved('next-page');
    expect(apiClient.get).toHaveBeenCalledWith('/users/me/bookmarks', {
      params: { limit: 10, cursor: 'next-page' }
    });
  });
});
