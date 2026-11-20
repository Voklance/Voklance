import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { RESOURCE_CATEGORIES, RESOURCE_CATEGORY_LABELS, type ResourceCategory } from '@voklance/shared';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import { apiErrorMessage } from '@/lib/apiClient';
import { useResource, useResourceActions } from '../hooks/useResources';
import BookmarkButton from '@/features/bookmarks/components/BookmarkButton';

const reasons = [
  ['spam', 'Spam'],
  ['misleading', 'Misleading content'],
  ['copyright', 'Copyright concern'],
  ['inappropriate', 'Inappropriate material'],
  ['malicious', 'Malicious or suspicious file'],
  ['other', 'Other']
] as const;
export default function ResourceDetailPage() {
  const { resourceId = '' } = useParams();
  const navigate = useNavigate();
  const query = useResource(resourceId);
  const actions = useResourceActions(resourceId);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  if (query.isPending) return <LoadingState label="Loading resource…" />;
  if (query.isError)
    return <ErrorState message={apiErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  const resource = query.data.resource;
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    actions.edit.mutate(
      {
        title: String(form.get('title') ?? '').trim(),
        description: String(form.get('description') ?? '').trim(),
        category: String(form.get('category') ?? ''),
        tags: String(form.get('tags') ?? '')
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      },
      { onSuccess: () => setEditing(false) }
    );
  };
  const report = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const description = String(form.get('description') ?? '').trim();
    actions.report.mutate(
      { reason: String(form.get('reason') ?? ''), ...(description ? { description } : {}) },
      { onSuccess: () => setReporting(false) }
    );
  };
  return (
    <div className="community-page resource-page">
      <Link className="community-back" to={`/app/communities/${resource.community.slug}/resources`}>
        Back to resources
      </Link>
      <header className="community-panel">
        <span className="command-activity-type">{RESOURCE_CATEGORY_LABELS[resource.category]}</span>
        <h1>{resource.title}</h1>
        <BookmarkButton type="resource" entityId={resource.id} />
        <p role="status">{resource.status}</p>
        <p>
          Shared by {resource.uploader.name} in{' '}
          <Link to={`/app/communities/${resource.community.slug}`}>{resource.community.name}</Link>
        </p>
      </header>
      <section className="community-panel">
        <h2>Document</h2>
        <p className="community-preserve">{resource.description}</p>
        <dl className="resource-details">
          <div>
            <dt>File</dt>
            <dd>{resource.file.safeFilename}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{resource.file.mimeType}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{(resource.file.sizeBytes / 1024 / 1024).toFixed(1)} MB</dd>
          </div>
          <div>
            <dt>Uploaded</dt>
            <dd>{new Date(resource.file.uploadedAt).toLocaleDateString()}</dd>
          </div>
        </dl>
        {resource.tags.length > 0 && <p>Topics: {resource.tags.join(', ')}</p>}
        <p role="status">
          Preview and download are unavailable until approved private storage and document scanning are
          configured. No file is served from this page.
        </p>
        <div className="resource-actions">
          <button type="button" className="community-action" disabled>
            Preview unavailable
          </button>
          <button type="button" className="community-action" disabled>
            Download unavailable
          </button>
        </div>
      </section>
      {(resource.canEdit || resource.canDelete) && (
        <section className="community-panel">
          <h2>Resource controls</h2>
          <div className="resource-actions">
            {resource.canEdit && (
              <button type="button" className="community-action" onClick={() => setEditing(!editing)}>
                {editing ? 'Close editor' : 'Edit details'}
              </button>
            )}
            {resource.canDelete && (
              <button
                type="button"
                className="community-action"
                disabled={actions.remove.isPending}
                onClick={() => {
                  if (window.confirm('Delete this resource?'))
                    actions.remove.mutate(undefined, { onSuccess: () => navigate('/app/resources') });
                }}
              >
                Delete resource
              </button>
            )}
          </div>
          {editing && (
            <form className="resource-edit-form" onSubmit={save}>
              <label>
                Title
                <input name="title" required minLength={3} maxLength={160} defaultValue={resource.title} />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  defaultValue={resource.description}
                />
              </label>
              <label>
                Category
                <select name="category" defaultValue={resource.category}>
                  {RESOURCE_CATEGORIES.map((item: ResourceCategory) => (
                    <option key={item} value={item}>
                      {RESOURCE_CATEGORY_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tags (comma separated)
                <input name="tags" defaultValue={resource.tags.join(', ')} />
              </label>
              <button type="submit" className="community-primary" disabled={actions.edit.isPending}>
                Save details
              </button>
            </form>
          )}
        </section>
      )}
      {resource.canReport && (
        <section className="community-panel">
          <h2>Report resource</h2>
          <button type="button" className="community-action" onClick={() => setReporting(!reporting)}>
            {reporting ? 'Close report' : 'Report a concern'}
          </button>
          {reporting && (
            <form className="resource-edit-form" onSubmit={report}>
              <label>
                Reason
                <select name="reason" required defaultValue="">
                  <option value="">Choose…</option>
                  {reasons.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Details (optional)
                <textarea name="description" minLength={10} maxLength={1000} rows={3} />
              </label>
              <button type="submit" className="community-primary" disabled={actions.report.isPending}>
                Submit report
              </button>
            </form>
          )}
        </section>
      )}
      {(actions.edit.isError || actions.remove.isError || actions.report.isError) && (
        <p role="alert" className="community-error">
          {apiErrorMessage(actions.edit.error ?? actions.remove.error ?? actions.report.error)}
        </p>
      )}
    </div>
  );
}
