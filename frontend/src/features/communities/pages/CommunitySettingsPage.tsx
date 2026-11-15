import type { CommunityInput } from '@voklance/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import CommunityForm from '../components/CommunityForm';
import { useCommunity, useCommunityActions, useCommunityMembers } from '../hooks/useCommunities';

export default function CommunitySettingsPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const detail = useCommunity(slug);
  const id = detail.data?.community.id ?? '';
  const members = useCommunityMembers(id, detail.data?.community.myRole === 'OWNER');
  const { update, transfer, archive } = useCommunityActions();
  const [newOwner, setNewOwner] = useState('');
  const [saved, setSaved] = useState(false);
  if (detail.isPending)
    return (
      <p className="community-state" role="status">
        Loading settings…
      </p>
    );
  if (detail.isError)
    return (
      <p className="community-state" role="alert">
        Settings could not be loaded.
      </p>
    );
  const community = detail.data.community;
  if (!community.permissions.editDetails)
    return (
      <p className="community-state" role="alert">
        You cannot edit this community.
      </p>
    );
  const initial: CommunityInput = {
    name: community.name,
    description: community.description ?? '',
    category: community.category,
    tags: community.tags,
    visibility: community.visibility,
    rules: community.rules ?? ''
  };
  const candidates =
    members.data?.pages.flatMap((page) => page.items).filter((person) => person.role !== 'OWNER') ?? [];
  return (
    <div className="community-page community-narrow">
      <Link className="community-back" to={`/app/communities/${slug}`}>
        Back to {community.name}
      </Link>
      <header className="community-page-header">
        <div>
          <h1>Community settings</h1>
          <p>Keep the community’s purpose and access clear.</p>
        </div>
      </header>
      {saved && (
        <p role="status" className="community-success">
          Settings saved.
        </p>
      )}
      {update.isError && (
        <p className="community-error" role="alert">
          {apiErrorMessage(update.error)}
        </p>
      )}
      <CommunityForm
        initial={initial}
        pending={update.isPending}
        canChangeVisibility={community.myRole === 'OWNER'}
        submitLabel="Save settings"
        onSubmit={(input) => {
          setSaved(false);
          const changes: Partial<CommunityInput> = { ...input };
          if (community.myRole !== 'OWNER') delete changes.visibility;
          update.mutate({ id, input: changes }, { onSuccess: () => setSaved(true) });
        }}
      />
      {community.myRole === 'OWNER' && (
        <>
          <section className="community-settings-section">
            <h2>Transfer ownership</h2>
            <p>Choose an active member. You will become an admin.</p>
            {members.isPending ? (
              <p role="status">Loading members…</p>
            ) : members.isError ? (
              <p role="alert">Members could not be loaded.</p>
            ) : (
              <>
                <label>
                  New owner
                  <select value={newOwner} onChange={(event) => setNewOwner(event.target.value)}>
                    <option value="">Choose a member</option>
                    {candidates.map((person) => (
                      <option key={person.userId} value={person.userId}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </label>
                {members.hasNextPage && (
                  <button
                    type="button"
                    className="community-text-button"
                    onClick={() => void members.fetchNextPage()}
                  >
                    Load more members
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              className="community-action"
              disabled={!newOwner || transfer.isPending}
              onClick={() => {
                if (window.confirm('Transfer ownership to this member?'))
                  transfer.mutate(
                    { id, newOwnerUserId: newOwner },
                    { onSuccess: () => void navigate(`/app/communities/${slug}`) }
                  );
              }}
            >
              Transfer ownership
            </button>
            {transfer.isError && (
              <p className="community-error" role="alert">
                {apiErrorMessage(transfer.error)}
              </p>
            )}
          </section>
          <section className="community-settings-section">
            <h2>Archive community</h2>
            <p>Archived communities remain readable to members. New joins and management actions stop.</p>
            <button
              type="button"
              className="community-danger"
              disabled={archive.isPending}
              onClick={() => {
                if (window.confirm('Archive this community? New members will not be able to join.'))
                  archive.mutate(id, { onSuccess: () => void navigate(`/app/communities/${slug}`) });
              }}
            >
              Archive community
            </button>
            {archive.isError && (
              <p className="community-error" role="alert">
                {apiErrorMessage(archive.error)}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
