import { Link, useNavigate } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useFlash } from '@/components/shared/FlashMessages';
import CommunityForm from '../components/CommunityForm';
import { useCommunityActions } from '../hooks/useCommunities';

export default function CreateCommunityPage() {
  const navigate = useNavigate();
  const { showFlash } = useFlash();
  const { create } = useCommunityActions();
  return (
    <div className="community-page community-narrow">
      <Link className="community-back" to="/app/communities">
        Back to communities
      </Link>
      <header className="community-page-header">
        <div>
          <h1>Create a community</h1>
          <p>Give professionals a focused place to find one another.</p>
        </div>
      </header>
      {create.isError && (
        <p className="community-error" role="alert">
          {apiErrorMessage(create.error)}
        </p>
      )}
      <CommunityForm
        pending={create.isPending}
        submitLabel="Create community"
        onSubmit={(input) => {
          create.mutate(input, {
            onSuccess: ({ community }) => {
              showFlash({ type: 'success', message: `${community.name} is ready.` });
              void navigate(`/app/communities/${community.slug}`);
            },
            onError: (error) => showFlash({ type: 'error', message: apiErrorMessage(error) })
          });
        }}
      />
    </div>
  );
}
