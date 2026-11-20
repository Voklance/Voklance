import { COMMAND_IDS, COMMAND_LABELS, type CommandId, type CommunityDetail } from '@voklance/shared';
import { useState } from 'react';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommunityActivities, useCommunityCommands } from '../hooks/useCommunityCommands';
import CommunityCommandPicker from './CommunityCommandPicker';
import CommandForm from './CommandForm';
import CommandActivityCard from './CommandActivityCard';
import type { CommandMetadata } from '@voklance/shared';
import ResourceCommandForm from '@/features/resources/components/ResourceCommandForm';

export default function CommunityActivityBoard({ community }: { community: CommunityDetail }) {
  const [selected, setSelected] = useState<CommandMetadata | null>(null);
  const [filter, setFilter] = useState<CommandId | undefined>();
  const canCompose = community.membershipStatus === 'ACTIVE' && community.status === 'ACTIVE';
  const commands = useCommunityCommands(community.id, canCompose);
  const activities = useCommunityActivities(community.id, filter, true);
  const seen = new Set<string>();
  const items = (activities.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return (
    <section className="community-activity-board" aria-labelledby="community-activity-heading">
      <div className="community-activity-heading">
        <div>
          <h2 id="community-activity-heading">Community activity</h2>
          <p>Structured opportunities and gatherings from this community.</p>
        </div>
      </div>
      {canCompose && (
        <div className="community-command-composer">
          {commands.isPending ? (
            <p role="status">Loading available actions…</p>
          ) : commands.isError ? (
            <p role="alert" className="command-error">
              {apiErrorMessage(commands.error)}
            </p>
          ) : commands.data.commands.length === 0 ? (
            <p>No commands are available here.</p>
          ) : selected?.id === 'resource' ? (
            <ResourceCommandForm onCancel={() => setSelected(null)} />
          ) : selected ? (
            <CommandForm
              key={selected.id}
              communityId={community.id}
              command={selected}
              onCancel={() => setSelected(null)}
              onSuccess={() => setSelected(null)}
            />
          ) : (
            <CommunityCommandPicker commands={commands.data.commands} onSelect={setSelected} />
          )}
        </div>
      )}
      <div className="community-activity-filter">
        <label htmlFor="activity-command-filter">Show activity</label>
        <select
          id="activity-command-filter"
          value={filter ?? ''}
          onChange={(event) => setFilter((event.target.value || undefined) as CommandId | undefined)}
        >
          <option value="">All activity</option>
          {COMMAND_IDS.map((id) => (
            <option key={id} value={id}>
              {COMMAND_LABELS[id]}
            </option>
          ))}
        </select>
      </div>
      {activities.isPending ? (
        <p className="community-state" role="status">
          Loading activity…
        </p>
      ) : activities.isError ? (
        <div className="community-state" role="alert">
          <p>Community activity could not be loaded.</p>
          <button type="button" className="community-action" onClick={() => void activities.refetch()}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="community-state">No activity matches this filter yet.</p>
      ) : (
        <>
          <div className="command-activity-list">
            {items.map((item) => (
              <CommandActivityCard key={item.id} activity={item} />
            ))}
          </div>
          {activities.hasNextPage && (
            <button
              type="button"
              className="community-load"
              disabled={activities.isFetchingNextPage}
              onClick={() => void activities.fetchNextPage()}
            >
              {activities.isFetchingNextPage ? 'Loading…' : 'Load more activity'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
