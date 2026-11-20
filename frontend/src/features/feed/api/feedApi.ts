import type { ApiSuccess, CommentPage, FeedComment, FeedPage, FeedPost } from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';

async function data<T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return (await request).data.data;
}
export const feedApi = {
  post: (id: string) => data<{ post: FeedPost }>(apiClient.get(`/posts/${encodeURIComponent(id)}`)),
  feed: (cursor?: string) =>
    data<FeedPage>(apiClient.get('/posts', { params: { limit: 10, ...(cursor ? { cursor } : {}) } })),
  saved: (cursor?: string) =>
    data<FeedPage>(
      apiClient.get('/users/me/bookmarks', { params: { limit: 10, ...(cursor ? { cursor } : {}) } })
    ),
  create: (content: string) =>
    data<{ post: FeedPost }>(apiClient.post('/posts', { content, visibility: 'PROFESSIONALS' })),
  edit: (id: string, content: string) =>
    data<{ post: FeedPost }>(apiClient.patch(`/posts/${id}`, { content })),
  remove: (id: string) => data<Record<string, never>>(apiClient.delete(`/posts/${id}`)),
  like: (id: string, desired: boolean) =>
    data<{ likedByMe: boolean; likeCount: number }>(
      desired ? apiClient.put(`/posts/${id}/like`) : apiClient.delete(`/posts/${id}/like`)
    ),
  bookmark: (id: string, desired: boolean) =>
    data<{ bookmarkedByMe: boolean }>(
      desired ? apiClient.put(`/posts/${id}/bookmark`) : apiClient.delete(`/posts/${id}/bookmark`)
    ),
  comments: (postId: string, cursor?: string) =>
    data<CommentPage>(
      apiClient.get(`/posts/${postId}/comments`, { params: { limit: 10, ...(cursor ? { cursor } : {}) } })
    ),
  addComment: (postId: string, content: string) =>
    data<{ comment: FeedComment }>(apiClient.post(`/posts/${postId}/comments`, { content })),
  editComment: (postId: string, commentId: string, content: string) =>
    data<{ comment: FeedComment }>(apiClient.patch(`/posts/${postId}/comments/${commentId}`, { content })),
  removeComment: (postId: string, commentId: string) =>
    data<Record<string, never>>(apiClient.delete(`/posts/${postId}/comments/${commentId}`))
};
