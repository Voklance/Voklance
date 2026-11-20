import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedApi } from '../api/feedApi';

export const feedKeys = {
  feed: ['feed', 'home'] as const,
  saved: ['bookmarks', 'me'] as const,
  comments: (postId: string) => ['posts', postId, 'comments'] as const
};

export function useFeed(saved = false) {
  return useInfiniteQuery({
    queryKey: saved ? feedKeys.saved : feedKeys.feed,
    queryFn: ({ pageParam }) => (saved ? feedApi.saved(pageParam) : feedApi.feed(pageParam)),
    initialPageParam: '' as string,
    getNextPageParam: (page) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined)
  });
}

export function useFeedActions() {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: feedKeys.feed }),
      client.invalidateQueries({ queryKey: feedKeys.saved }),
      client.invalidateQueries({ queryKey: ['saved-items'] }),
      client.invalidateQueries({ queryKey: ['bookmark-status'] }),
      client.invalidateQueries({ queryKey: ['recommended-feed'] })
    ]);
  return {
    create: useMutation({ mutationFn: feedApi.create, onSuccess: refresh }),
    edit: useMutation({
      mutationFn: ({ id, content }: { id: string; content: string }) => feedApi.edit(id, content),
      onSuccess: refresh
    }),
    remove: useMutation({ mutationFn: feedApi.remove, onSuccess: refresh }),
    like: useMutation({
      mutationFn: ({ id, desired }: { id: string; desired: boolean }) => feedApi.like(id, desired),
      onSuccess: refresh
    }),
    bookmark: useMutation({
      mutationFn: ({ id, desired }: { id: string; desired: boolean }) => feedApi.bookmark(id, desired),
      onSuccess: refresh
    })
  };
}

export function useComments(postId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: feedKeys.comments(postId),
    queryFn: ({ pageParam }) => feedApi.comments(postId, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: (page) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined),
    enabled
  });
}

export function useCommentActions(postId: string) {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: feedKeys.comments(postId) }),
      client.invalidateQueries({ queryKey: feedKeys.feed }),
      client.invalidateQueries({ queryKey: feedKeys.saved }),
      client.invalidateQueries({ queryKey: ['recommended-feed'] })
    ]);
  return {
    add: useMutation({
      mutationFn: (content: string) => feedApi.addComment(postId, content),
      onSuccess: refresh
    }),
    edit: useMutation({
      mutationFn: ({ id, content }: { id: string; content: string }) =>
        feedApi.editComment(postId, id, content),
      onSuccess: refresh
    }),
    remove: useMutation({ mutationFn: (id: string) => feedApi.removeComment(postId, id), onSuccess: refresh })
  };
}
