import { MESSAGE_REPORT_REASONS, type MessageDto, type MessageReportReason } from '@voklance/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiErrorMessage } from '@/lib/apiClient';
import { messagingApi } from '../api/messagingApi';
export default function MessageReportDialog({
  message,
  onClose
}: {
  message: MessageDto;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<MessageReportReason>('spam');
  const select = useRef<HTMLSelectElement>(null);
  const report = useMutation({ mutationFn: () => messagingApi.report(message.id, reason) });
  useEffect(() => {
    select.current?.focus();
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    report.mutate();
  };
  return (
    <div className="message-dialog-backdrop">
      <section role="dialog" aria-modal="true" aria-label="Report message" className="message-dialog">
        <h2>Report message</h2>
        <p>Only the moderation team can review this private report.</p>
        <form onSubmit={submit}>
          <label>
            Reason
            <select
              ref={select}
              value={reason}
              onChange={(event) => setReason(event.target.value as MessageReportReason)}
            >
              {MESSAGE_REPORT_REASONS.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={report.isPending || report.isSuccess}>
              {report.isPending ? 'Reporting…' : 'Report'}
            </button>
          </div>
        </form>
        {report.isSuccess && (
          <p role="status">
            Report saved.{' '}
            <button type="button" onClick={onClose}>
              Close
            </button>
          </p>
        )}
        {report.isError && <p role="alert">{apiErrorMessage(report.error)}</p>}
      </section>
    </div>
  );
}
