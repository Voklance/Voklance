import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { messagingApi } from '../api/messagingApi';
export default function StartConversationButton({ username }: { username: string }) {
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: () => messagingApi.create(username),
    onSuccess: (result) => navigate(`/app/messages/${result.conversation.id}`)
  });
  return (
    <span className="message-start">
      <button
        type="button"
        className="community-primary"
        disabled={create.isPending}
        onClick={() => create.mutate()}
      >
        {create.isPending ? 'Opening…' : 'Message'}
      </button>
      {create.isError && <span role="alert">{apiErrorMessage(create.error)}</span>}
    </span>
  );
}
