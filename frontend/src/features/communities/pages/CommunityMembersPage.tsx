import { Link, useParams } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommunity, useCommunityActions, useCommunityMembers } from '../hooks/useCommunities';

export default function CommunityMembersPage() {
  const { slug = '' } = useParams();
  const detail = useCommunity(slug);
  const id = detail.data?.community.id ?? '';
  const list = useCommunityMembers(id, !!detail.data?.community.permissions.viewMembers);
  const { role, remove } = useCommunityActions();
  if (detail.isPending)
    return (
      <p className="community-state" role="status">
        Loading community…
      </p>
    );
  if (detail.isError)
    return (
      <p className="community-state" role="alert">
        Community could not be loaded.
      </p>
    );
  const community = detail.data.community;
  if (!community.permissions.viewMembers)
    return (
      <p className="community-state" role="alert">
        Join this community to view members.
      </p>
    );
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="community-page">
      <Link className="community-back" to={`/app/communities/${slug}`}>
        Back to {community.name}
      </Link>
      <header className="community-page-header">
        <div>
          <h1>Member directory</h1>
          <p>People in {community.name}</p>
        </div>
      </header>
      {(role.isError || remove.isError) && (
        <p className="community-error" role="alert">
          {apiErrorMessage(role.error ?? remove.error)}
        </p>
      )}
      {list.isPending ? (
        <p className="community-state" role="status">
          Loading members…
        </p>
      ) : list.isError ? (
        <div className="community-state" role="alert">
          <p>Members could not be loaded.</p>
          <button type="button" className="community-action" onClick={() => void list.refetch()}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="community-state">No active members are available.</p>
      ) : (
        <>
          <ul className="community-member-list">
            {items.map((person) => {
              const canEdit =
                community.permissions.manageRoles &&
                person.role !== 'OWNER' &&
                (community.myRole === 'OWNER' || person.role !== 'ADMIN');
              const canRemove =
                community.permissions.removeMembers &&
                person.role !== 'OWNER' &&
                (community.myRole === 'OWNER' || person.role === 'MEMBER');
              return (
                <li key={person.userId} className="community-member">
                  <span className="community-member-avatar" aria-hidden="true">
                    {person.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="community-member-info">
                    <strong>
                      {person.username ? (
                        <Link to={`/app/professionals/${person.username}`}>{person.name}</Link>
                      ) : (
                        person.name
                      )}
                    </strong>
                    {person.headline && <p>{person.headline}</p>}
                  </div>
                  <span className="community-role">{person.role.toLowerCase()}</span>
                  {canEdit && (
                    <label className="community-role-select">
                      Change role
                      <select
                        aria-label={`Role for ${person.name}`}
                        value={person.role}
                        disabled={role.isPending}
                        onChange={(event) =>
                          role.mutate({
                            id,
                            userId: person.userId,
                            role: event.target.value as 'ADMIN' | 'MODERATOR' | 'MEMBER'
                          })
                        }
                      >
                        <option value="MEMBER">Member</option>
                        <option value="MODERATOR">Moderator</option>
                        {community.myRole === 'OWNER' && <option value="ADMIN">Admin</option>}
                      </select>
                    </label>
                  )}
                  {canRemove && (
                    <button
                      type="button"
                      className="community-text-button"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`Remove ${person.name} from this community?`))
                          remove.mutate({ id, userId: person.userId });
                      }}
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {list.hasNextPage && (
            <button
              type="button"
              className="community-load"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? 'Loading…' : 'Load more members'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
