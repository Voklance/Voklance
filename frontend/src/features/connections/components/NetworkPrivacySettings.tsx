import type { NetworkSettings } from '@voklance/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/lib/apiClient';
import { useNetworkActions, useNetworkSettings } from '../hooks/useNetwork';

export default function NetworkPrivacySettings() {
  const query = useNetworkSettings();
  const actions = useNetworkActions();
  const [draft, setDraft] = useState<NetworkSettings | null>(null);
  useEffect(() => {
    if (query.data?.settings && draft === null) setDraft(query.data.settings);
  }, [query.data, draft]);
  if (query.isError)
    return (
      <div role="alert">
        <p>Could not load network settings.</p>
        <button type="button" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  if (query.isPending || !draft) return <p role="status">Loading network privacy settings…</p>;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await actions.settings.mutateAsync(draft).catch(() => undefined);
  };
  return (
    <form className="network-settings" onSubmit={(event) => void submit(event)}>
      <h2>Network privacy</h2>
      <label>
        <input
          type="checkbox"
          checked={draft.profileDiscoverable}
          onChange={(event) => setDraft({ ...draft, profileDiscoverable: event.target.checked })}
        />{' '}
        Show my public profile in Discover Professionals
      </label>
      <label>
        <input
          type="checkbox"
          checked={draft.allowConnectionRequests}
          onChange={(event) => setDraft({ ...draft, allowConnectionRequests: event.target.checked })}
        />{' '}
        Allow connection requests
      </label>
      <label>
        Who can see my connections and count
        <select
          value={draft.connectionListVisibility}
          onChange={(event) =>
            setDraft({
              ...draft,
              connectionListVisibility: event.target.value as NetworkSettings['connectionListVisibility']
            })
          }
        >
          <option value="private">Only me</option>
          <option value="connections">My connections</option>
        </select>
      </label>
      <p>Private profiles are omitted from any list shared with your connections.</p>
      <button type="submit" className="community-primary" disabled={actions.settings.isPending}>
        {actions.settings.isPending ? 'Saving…' : 'Save settings'}
      </button>
      {actions.settings.isSuccess && <p role="status">Network settings saved.</p>}
      {actions.settings.isError && <p role="alert">{apiErrorMessage(actions.settings.error)}</p>}
    </form>
  );
}
