import type { ApiSuccess, ProfileCertification, ProfileCompleteness, ProfileProject } from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';
const data = async <T>(request: Promise<{ data: ApiSuccess<T> }>) => (await request).data.data;
export const portfolioApi = {
  certifications: () => data<{ items: ProfileCertification[] }>(apiClient.get('/me/profile/certifications')),
  addCertification: (value: object) =>
    data<{ item: ProfileCertification }>(apiClient.post('/me/profile/certifications', value)),
  updateCertification: (id: string, value: object) =>
    data<{ item: ProfileCertification }>(apiClient.patch(`/me/profile/certifications/${id}`, value)),
  removeCertification: (id: string) =>
    data<{ deleted: boolean }>(apiClient.delete(`/me/profile/certifications/${id}`)),
  projects: () => data<{ items: ProfileProject[] }>(apiClient.get('/me/profile/projects')),
  addProject: (value: object) =>
    data<{ item: ProfileProject }>(apiClient.post('/me/profile/projects', value)),
  updateProject: (id: string, value: object) =>
    data<{ item: ProfileProject }>(apiClient.patch(`/me/profile/projects/${id}`, value)),
  removeProject: (id: string) => data<{ deleted: boolean }>(apiClient.delete(`/me/profile/projects/${id}`)),
  completeness: () => data<ProfileCompleteness>(apiClient.get('/me/profile/completeness'))
};
