import { PROFILE_SECTION_IDS, type ProfileSectionId } from '@voklance/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { profileApi } from '../api/profileApi';
import { apiErrorMessage } from '@/lib/apiClient';

export default function ProfileSectionOrder({ initial }: { initial?: ProfileSectionId[] }) {
  const referenceOrder: ProfileSectionId[] = [
    'experience',
    'projects',
    'education',
    'certifications',
    'links',
    'skills',
    'github'
  ];
  const isOriginalDefault = initial?.every((item, index) => item === PROFILE_SECTION_IDS[index]);
  const [items, setItems] = useState<ProfileSectionId[]>(
    initial?.length === PROFILE_SECTION_IDS.length && !isOriginalDefault
      ? initial.filter((item) => item !== 'about')
      : referenceOrder
  );
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => profileApi.save({ sectionOrder: ['about', ...items] }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['onboarding'] });
      await client.invalidateQueries({ queryKey: ['profiles'] });
    }
  });
  const move = (index: number, amount: number) => {
    const next = [...items];
    const target = index + amount;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };
  return (
    <section className="profile-section">
      <h2>Section order</h2>
      <p>Choose the order of sections below your profile summary.</p>
      <ol className="section-order-list">
        {items.map((item, index) => (
          <li key={item}>
            <span>{item.charAt(0).toUpperCase() + item.slice(1)}</span>
            <button
              type="button"
              disabled={index === 0}
              aria-label={`Move ${item} up`}
              onClick={() => move(index, -1)}
            >
              Up
            </button>
            <button
              type="button"
              disabled={index === items.length - 1}
              aria-label={`Move ${item} down`}
              onClick={() => move(index, 1)}
            >
              Down
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="community-action"
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        Save section order
      </button>
      {save.isSuccess && <p role="status">Section order saved.</p>}
      {save.isError && <p role="alert">{apiErrorMessage(save.error)}</p>}
    </section>
  );
}
