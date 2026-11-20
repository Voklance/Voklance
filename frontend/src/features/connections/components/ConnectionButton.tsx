import type { RelativeConnectionStatus } from '@voklance/shared';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useConnectionStatus, useNetworkActions } from '../hooks/useNetwork';

export default function ConnectionButton({
  username,
  userId,
  status: suppliedStatus
}: {
  username: string;
  userId?: string;
  status?: RelativeConnectionStatus;
}) {
  const lookup = useConnectionStatus(suppliedStatus === undefined ? username : '');
  const actions = useNetworkActions();
  const status = suppliedStatus ?? lookup.data?.status;
  if (suppliedStatus === undefined && lookup.isPending)
    return <span role="status">Checking connection…</span>;
  if (suppliedStatus === undefined && lookup.isError)
    return (
      <button type="button" className="community-action" onClick={() => void lookup.refetch()}>
        Retry connection status
      </button>
    );
  if (lookup.data?.isSelf) return null;
  if (status === 'connected') return <span className="network-badge">Connected</span>;
  if (status === 'pending_sent') return <span className="network-badge">Request sent</span>;
  if (status === 'pending_received')
    return (
      <Link className="community-action" to="/app/network?tab=incoming">
        Respond
      </Link>
    );
  return (
    <div className="network-action-stack">
      <button
        className="community-primary"
        type="button"
        disabled={actions.send.isPending}
        onClick={() =>
          actions.send.mutate(userId ? { recipientId: userId } : { recipientUsername: username })
        }
      >
        {actions.send.isPending ? 'Sending…' : 'Connect'}
      </button>
      {actions.send.isError && <p role="alert">{apiErrorMessage(actions.send.error)}</p>}
    </div>
  );
}
