import { MESSAGE_LIMIT } from '@voklance/shared';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { messagingSocket } from '@/lib/socketClient';
export default function MessageComposer({
  conversationId,
  onSend,
  disabled
}: {
  conversationId: string;
  onSend: (body: string) => void;
  disabled: boolean;
}) {
  const [body, setBody] = useState('');
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    const socket = messagingSocket();
    if (socket.connected) socket.emit('typing:stop', { conversationId }, () => undefined);
  };
  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
    },
    []
  );
  const change = (value: string) => {
    setBody(value);
    const socket = messagingSocket();
    if (socket.connected && value.trim()) {
      socket.emit('typing:start', { conversationId }, () => undefined);
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(stop, 1_600);
    } else stop();
  };
  const send = (event?: FormEvent) => {
    event?.preventDefault();
    const value = body.trim();
    if (!value || value.length > MESSAGE_LIMIT || disabled) return;
    onSend(value);
    setBody('');
    stop();
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };
  return (
    <form className="message-composer" onSubmit={send}>
      <label htmlFor="message-body">Message</label>
      <textarea
        id="message-body"
        value={body}
        maxLength={MESSAGE_LIMIT}
        rows={3}
        disabled={disabled}
        onChange={(event) => change(event.target.value)}
        onKeyDown={keyDown}
        placeholder="Write a private message…"
      />
      <div>
        <span>
          {body.length}/{MESSAGE_LIMIT}
        </span>
        <button type="submit" className="community-primary" disabled={disabled || !body.trim()}>
          Send
        </button>
      </div>
      <p>Enter to send · Shift + Enter for a new line</p>
    </form>
  );
}
