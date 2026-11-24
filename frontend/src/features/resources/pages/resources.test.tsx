// @vitest-environment jsdom
import type { CommunityDetail, CommunityResourceDTO } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { communityApi } from '@/features/communities/api/communityApi';
import { resourceApi } from '../api/resourceApi';
import ResourceCommandForm from '../components/ResourceCommandForm';
import CommunityResourcesPage from './CommunityResourcesPage';
import ResourceDetailPage from './ResourceDetailPage';

vi.mock('@/features/communities/api/communityApi', () => ({ communityApi: { detail: vi.fn() } }));
vi.mock('../api/resourceApi', () => ({
  resourceApi: {
    community: vi.fn(),
    detail: vi.fn(),
    edit: vi.fn(),
    remove: vi.fn(),
    report: vi.fn(),
    reports: vi.fn(),
    review: vi.fn()
  }
}));
const community: CommunityDetail = {
  id: 'a'.repeat(24),
  slug: 'resource-guild',
  name: 'Resource Guild',
  description: 'A professional community.',
  category: 'software-development',
  tags: [],
  visibility: 'PUBLIC',
  status: 'ACTIVE',
  memberCount: 2,
  membershipStatus: 'ACTIVE',
  myRole: 'MEMBER',
  createdAt: '2026-11-15T00:00:00.000Z',
  rules: '',
  owner: null,
  permissions: {
    viewMembers: true,
    reviewRequests: false,
    editDetails: false,
    manageRoles: false,
    removeMembers: false,
    transferOwnership: false,
    archive: false
  }
};
const resource: CommunityResourceDTO = {
  id: 'b'.repeat(24),
  activityId: 'c'.repeat(24),
  community: { id: community.id, name: community.name, slug: community.slug },
  uploader: { name: 'Ada Author', username: 'ada', headline: 'Engineer' },
  title: 'React interview guide',
  description: 'A useful guide for frontend interviews.',
  category: 'interview-preparation',
  tags: ['react'],
  file: {
    id: 'd'.repeat(24),
    safeFilename: 'guide.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    uploadedAt: '2026-11-15T10:00:00.000Z',
    previewAvailable: false
  },
  status: 'published',
  createdAt: '2026-11-15T10:00:00.000Z',
  canEdit: false,
  canDelete: false,
  canModerate: false,
  canReport: true
};
const page = { items: [resource], hasMore: false, nextCursor: null };
function mount(path: string, element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } }
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path={
              path.startsWith('/app/communities/')
                ? '/app/communities/:slug/resources'
                : '/app/resources/:resourceId'
            }
            element={element}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(communityApi.detail).mockResolvedValue({ community });
  vi.mocked(resourceApi.community).mockResolvedValue(page);
  vi.mocked(resourceApi.detail).mockResolvedValue({ resource });
  vi.mocked(resourceApi.reports).mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  vi.mocked(resourceApi.report).mockResolvedValue({
    report: {
      id: 'e'.repeat(24),
      resourceId: resource.id,
      reason: 'spam',
      description: null,
      status: 'pending',
      createdAt: '2026-11-15T10:00:00.000Z',
      reviewedAt: null
    }
  });
});
afterEach(cleanup);
describe('resource foundation UI', () => {
  it('shows the structured /resource form and rejects unsupported local file selection without publishing', () => {
    render(<ResourceCommandForm onCancel={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Share resource' })).toBeTruthy();
    const input = screen.getByLabelText(/Document \(PDF/i) as HTMLInputElement;
    const file = new File(['hello'], 'script.html', { type: 'text/html' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole('alert').textContent).toContain('PDF');
    expect((screen.getByRole('button', { name: 'Publish unavailable' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
  it('renders community resources and passes search and category filters', async () => {
    mount('/app/communities/resource-guild/resources', <CommunityResourcesPage />);
    expect(await screen.findByRole('link', { name: 'React interview guide' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search resources' }), {
      target: { value: 'React' }
    });
    await waitFor(() =>
      expect(resourceApi.community).toHaveBeenCalledWith(
        community.id,
        expect.objectContaining({ search: 'React' })
      )
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), {
      target: { value: 'interview-preparation' }
    });
    await waitFor(() =>
      expect(resourceApi.community).toHaveBeenCalledWith(
        community.id,
        expect.objectContaining({ category: 'interview-preparation' })
      )
    );
  });
  it('shows detail and report action while withholding unauthorized owner controls', async () => {
    mount(`/app/resources/${resource.id}`, <ResourceDetailPage />);
    expect(await screen.findByRole('heading', { name: 'React interview guide' })).toBeTruthy();
    expect(screen.getByText(/Preview and download are unavailable/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Resource controls' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Report a concern' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Reason' }), { target: { value: 'spam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    await waitFor(() => expect(resourceApi.report).toHaveBeenCalledWith(resource.id, 'spam', undefined));
  });
  it('shows metadata controls to the owner', async () => {
    vi.mocked(resourceApi.detail).mockResolvedValue({
      resource: { ...resource, canEdit: true, canDelete: true, canReport: false }
    });
    mount(`/app/resources/${resource.id}`, <ResourceDetailPage />);
    expect(await screen.findByRole('heading', { name: 'Resource controls' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Report a concern' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeTruthy();
  });
});
