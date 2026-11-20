import { COMMUNITY_CATEGORIES, COMMUNITY_CATEGORY_LABELS, type CommunityInput } from '@voklance/shared';
import { useState, type FormEvent } from 'react';
import { useFlash } from '@/components/shared/FlashMessages';

const blank: CommunityInput = {
  name: '',
  description: '',
  category: 'software-development',
  tags: [],
  visibility: 'PUBLIC',
  rules: ''
};
export default function CommunityForm({
  initial = blank,
  pending,
  canChangeVisibility = true,
  submitLabel,
  onSubmit
}: {
  initial?: CommunityInput;
  pending: boolean;
  canChangeVisibility?: boolean;
  submitLabel: string;
  onSubmit: (input: CommunityInput) => void;
}) {
  const [form, setForm] = useState(initial);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [error, setError] = useState('');
  const { showFlash } = useFlash();
  const save = (event: FormEvent) => {
    event.preventDefault();
    const parsedTags = tags
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (form.name.trim().length < 3 || form.description.trim().length < 10) {
      setError('Add a name of at least 3 characters and a description of at least 10 characters.');
      showFlash({ type: 'warning', message: 'Please complete the required community fields.' });
      return;
    }
    if (
      parsedTags.length > 8 ||
      new Set(parsedTags).size !== parsedTags.length ||
      parsedTags.some((tag) => !/^[a-z0-9][a-z0-9 -]{0,29}$/.test(tag))
    ) {
      setError('Use up to 8 unique topics, separated by commas.');
      showFlash({ type: 'warning', message: 'Please check the community topics.' });
      return;
    }
    setError('');
    onSubmit({
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      rules: form.rules.trim(),
      tags: parsedTags
    });
  };
  return (
    <form className="community-form" onSubmit={save} noValidate>
      <label>
        Community name
        <input
          required
          minLength={3}
          maxLength={80}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </label>
      <label>
        Description
        <textarea
          required
          minLength={10}
          maxLength={1000}
          rows={4}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </label>
      <label>
        Category
        <select
          value={form.category}
          onChange={(event) =>
            setForm({ ...form, category: event.target.value as CommunityInput['category'] })
          }
        >
          {COMMUNITY_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {COMMUNITY_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Topics <span className="community-hint">Separate with commas, up to 8</span>
        <input
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="react, typescript"
        />
      </label>
      {canChangeVisibility && (
        <fieldset>
          <legend>Visibility</legend>
          <label className="community-radio">
            <input
              type="radio"
              name="visibility"
              checked={form.visibility === 'PUBLIC'}
              onChange={() => setForm({ ...form, visibility: 'PUBLIC' })}
            />
            Public <span>Professionals can join immediately.</span>
          </label>
          <label className="community-radio">
            <input
              type="radio"
              name="visibility"
              checked={form.visibility === 'PRIVATE'}
              onChange={() => setForm({ ...form, visibility: 'PRIVATE' })}
            />
            Private <span>Membership needs approval; details stay with members.</span>
          </label>
        </fieldset>
      )}
      <label>
        Community rules <span className="community-hint">Optional, up to 3,000 characters</span>
        <textarea
          maxLength={3000}
          rows={4}
          value={form.rules}
          onChange={(event) => setForm({ ...form, rules: event.target.value })}
        />
      </label>
      {error && (
        <p role="alert" className="community-error">
          {error}
        </p>
      )}
      <button type="submit" className="community-primary" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
