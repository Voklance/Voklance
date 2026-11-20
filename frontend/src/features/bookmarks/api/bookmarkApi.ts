import type {
  ActivityType,
  ApiSuccess,
  BookmarkCollectionPage,
  BookmarkType,
  PersonalActivityPage,
  SavedItemPage
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';
const data = async <T>(request: Promise<{ data: ApiSuccess<T> }>) => (await request).data.data;
export const bookmarkApi = {
  saved: (params: {
    type?: BookmarkType;
    collectionId?: string;
    search?: string;
    sort?: string;
    cursor?: string;
  }) => data<SavedItemPage>(apiClient.get('/bookmarks', { params: { ...params, limit: 20 } })),
  status: (type: BookmarkType, id: string) =>
    data<{ items: { id: string; entityType: BookmarkType; entityId: string }[] }>(
      apiClient.get('/bookmarks/status', { params: { entities: `${type}:${id}` } })
    ),
  save: (type: BookmarkType, id: string) =>
    data<{ id: string }>(apiClient.post('/bookmarks', { entityType: type, entityId: id })),
  remove: (bookmarkId: string) => data<{ removed: boolean }>(apiClient.delete(`/bookmarks/${bookmarkId}`)),
  collections: (cursor?: string) =>
    data<BookmarkCollectionPage>(apiClient.get('/collections', { params: { limit: 40, cursor } })),
  createCollection: (name: string) => data<{ id: string }>(apiClient.post('/collections', { name })),
  renameCollection: (id: string, name: string) =>
    data<unknown>(apiClient.patch(`/collections/${id}`, { name })),
  deleteCollection: (id: string) => data<unknown>(apiClient.delete(`/collections/${id}`)),
  addToCollection: (collectionId: string, bookmarkId: string) =>
    data<unknown>(apiClient.put(`/collections/${collectionId}/items/${bookmarkId}`)),
  removeFromCollection: (collectionId: string, bookmarkId: string) =>
    data<unknown>(apiClient.delete(`/collections/${collectionId}/items/${bookmarkId}`)),
  activity: (params: { type?: ActivityType; cursor?: string }) =>
    data<PersonalActivityPage>(apiClient.get('/me/activity', { params: { ...params, limit: 20 } }))
};
