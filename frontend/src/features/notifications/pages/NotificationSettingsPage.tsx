import { NOTIFICATION_CATEGORIES, type NotificationPreferences } from '@voklance/shared';
import { useEffect, useState } from 'react';
import { apiErrorMessage } from '@/lib/apiClient';
import { useNotificationMutations, useNotificationPreferences } from '../hooks/useNotifications';
export default function NotificationSettingsPage() {
  const settings = useNotificationPreferences();
  const { preferences: save } = useNotificationMutations();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  useEffect(() => {
    if (settings.data) setDraft(settings.data.preferences);
  }, [settings.data]);
  return (
    <section className="notifications-page">
      <h1>Notification preferences</h1>
      <p>
        Choose which activity appears in your notification center. Account security notices remain available.
      </p>
      {settings.isPending ? (
        <p role="status">Loading preferences…</p>
      ) : settings.isError ? (
        <p role="alert">{apiErrorMessage(settings.error)}</p>
      ) : (
        draft && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(draft);
            }}
          >
            <div className="notification-preferences">
              {NOTIFICATION_CATEGORIES.map((category) => (
                <label key={category}>
                  <input
                    type="checkbox"
                    checked={draft[category]}
                    onChange={(event) => setDraft({ ...draft, [category]: event.target.checked })}
                  />{' '}
                  {category[0].toUpperCase() + category.slice(1)}
                </label>
              ))}
            </div>
            <button type="submit" className="community-primary" disabled={save.isPending}>
              Save preferences
            </button>
            {save.isSuccess && <p role="status">Preferences saved.</p>}
            {save.isError && <p role="alert">{apiErrorMessage(save.error)}</p>}
          </form>
        )
      )}
    </section>
  );
}
