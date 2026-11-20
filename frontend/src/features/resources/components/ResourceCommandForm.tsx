import { useState, type ChangeEvent } from 'react';
import {
  RESOURCE_CATEGORIES,
  RESOURCE_CATEGORY_LABELS,
  RESOURCE_FILE_TYPES,
  RESOURCE_MAX_FILE_BYTES,
  type ResourceCategory
} from '@voklance/shared';

const allowed = Object.values(RESOURCE_FILE_TYPES);
function fileError(file: File): string | null {
  if (file.size < 1 || file.size > RESOURCE_MAX_FILE_BYTES)
    return 'The file must be between 1 byte and 10 MB.';
  const name = file.name.toLowerCase();
  if (
    !allowed.some(
      (type) => type.mime === file.type && type.extensions.some((extension) => name.endsWith(extension))
    )
  )
    return 'Choose a PDF, PowerPoint, or Word document with a matching file type.';
  return null;
}
export default function ResourceCommandForm({ onCancel }: { onCancel: () => void }) {
  const [selected, setSelected] = useState<string>('');
  const [error, setError] = useState('');
  const changeFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelected('');
      setError('');
      return;
    }
    const invalid = fileError(file);
    setError(invalid ?? '');
    setSelected(invalid ? '' : file.name);
  };
  return (
    <form
      className="command-form resource-form"
      onSubmit={(event) => event.preventDefault()}
      aria-labelledby="resource-command-title"
    >
      <header>
        <h3 id="resource-command-title">Share resource</h3>
        <p>Prepare a professional document for your community.</p>
      </header>
      <div className="command-form-fields">
        <label>
          Title
          <input name="title" required minLength={3} maxLength={160} />
        </label>
        <label>
          Description
          <textarea name="description" required minLength={10} maxLength={2000} rows={4} />
        </label>
        <label>
          Category
          <select name="category" required defaultValue="">
            <option value="">Choose…</option>
            {RESOURCE_CATEGORIES.map((category: ResourceCategory) => (
              <option key={category} value={category}>
                {RESOURCE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tags (comma separated)
          <input name="tags" maxLength={250} />
        </label>
        <label>
          Document (PDF, PowerPoint, or Word; maximum 10 MB)
          <input
            name="file"
            type="file"
            accept={allowed.flatMap((type) => [type.mime, ...type.extensions]).join(',')}
            onChange={changeFile}
          />
        </label>
      </div>
      {error && (
        <p className="command-error" role="alert">
          {error}
        </p>
      )}
      {selected && <p role="status">Selected: {selected}. The file has not been uploaded.</p>}
      <p className="community-state" role="status">
        Uploading and publishing resources are unavailable until private storage and document scanning are
        approved and configured. Nothing entered here is saved.
      </p>
      <div className="command-form-actions">
        <button type="button" className="community-action" onClick={onCancel}>
          Close
        </button>
        <button type="submit" className="community-primary" disabled>
          Publish unavailable
        </button>
      </div>
    </form>
  );
}
