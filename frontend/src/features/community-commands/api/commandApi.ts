import type {
  ActivityPage,
  ApiSuccess,
  CommandMetadata,
  CommandSubmission,
  CommunityActivity,
  CommandId
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';

async function data<T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return (await request).data.data;
}
export const commandApi = {
  commands: (communityId: string) =>
    data<{ commands: CommandMetadata[] }>(apiClient.get(`/communities/${communityId}/commands`)),
  submit: (communityId: string, input: CommandSubmission) =>
    data<{ activity: CommunityActivity }>(apiClient.post(`/communities/${communityId}/commands`, input)),
  activities: (communityId: string, command?: CommandId, cursor?: string) =>
    data<ActivityPage>(
      apiClient.get(`/communities/${communityId}/activities`, {
        params: { limit: 10, ...(command ? { command } : {}), ...(cursor ? { cursor } : {}) }
      })
    ),
  remove: (communityId: string, activityId: string) =>
    data<Record<string, never>>(apiClient.delete(`/communities/${communityId}/activities/${activityId}`))
};
