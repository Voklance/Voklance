import { referralApplicationSchema, referralOfferSchema } from '@voklance/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/lib/apiClient';
import { useReferralActions } from '../hooks/useReferrals';

export default function ReferralResponseForm({ kind, targetId, onCancel, onSuccess }: {
  kind: 'application' | 'offer'; targetId: string; onCancel: () => void; onSuccess: () => void;
}) {
  const first = useRef<HTMLTextAreaElement>(null);
  const [values, setValues] = useState({ introduction: '', relevantSkills: '', portfolioUrl: '', offerDetails: '', employerRelationship: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const actions = useReferralActions();
  const action = kind === 'application' ? actions.apply : actions.offer;
  useEffect(() => first.current?.focus(), [kind]);
  const set = (name: keyof typeof values, value: string) => setValues((current) => ({ ...current, [name]: value }));
  const save = (event: FormEvent) => {
    event.preventDefault();
    const input = kind === 'application'
      ? { introduction: values.introduction, relevantSkills: values.relevantSkills.split(',').map((item) => item.trim()).filter(Boolean), ...(values.portfolioUrl.trim() ? { portfolioUrl: values.portfolioUrl.trim() } : {}) }
      : { introduction: values.introduction, offerDetails: values.offerDetails, ...(values.employerRelationship.trim() ? { employerRelationship: values.employerRelationship } : {}) };
    const parsed = (kind === 'application' ? referralApplicationSchema : referralOfferSchema).safeParse(input);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
    setErrors({});
    if (kind === 'application') actions.apply.mutate({ id: targetId, input: referralApplicationSchema.parse(input) }, { onSuccess });
    else actions.offer.mutate({ id: targetId, input: referralOfferSchema.parse(input) }, { onSuccess });
  };
  return <form className="referral-form" onSubmit={save} noValidate aria-labelledby="referral-response-title">
    <h2 id="referral-response-title">{kind === 'application' ? 'Request referral' : 'Offer referral'}</h2>
    <p>{kind === 'application' ? 'Share a brief professional introduction. Only the opportunity owner can review it.' : 'Describe how you can help. The requester can review your offer.'}</p>
    <label>Professional introduction <textarea ref={first} rows={4} maxLength={1000} value={values.introduction} aria-invalid={!!errors.introduction} onChange={(event) => set('introduction', event.target.value)} /></label>{errors.introduction && <p className="referral-field-error">{errors.introduction}</p>}
    {kind === 'application' ? <><label>Relevant skills (comma separated) <input maxLength={500} value={values.relevantSkills} aria-invalid={!!errors.relevantSkills} onChange={(event) => set('relevantSkills', event.target.value)} /></label>{errors.relevantSkills && <p className="referral-field-error">{errors.relevantSkills}</p>}<label>Portfolio or GitHub link (optional, HTTPS) <input type="url" value={values.portfolioUrl} aria-invalid={!!errors.portfolioUrl} onChange={(event) => set('portfolioUrl', event.target.value)} /></label>{errors.portfolioUrl && <p className="referral-field-error">{errors.portfolioUrl}</p>}</> : <><label>Offer details <textarea rows={4} maxLength={1000} value={values.offerDetails} aria-invalid={!!errors.offerDetails} onChange={(event) => set('offerDetails', event.target.value)} /></label>{errors.offerDetails && <p className="referral-field-error">{errors.offerDetails}</p>}<label>Employer relationship (optional, unverified) <input maxLength={250} value={values.employerRelationship} aria-invalid={!!errors.employerRelationship} onChange={(event) => set('employerRelationship', event.target.value)} /></label>{errors.employerRelationship && <p className="referral-field-error">{errors.employerRelationship}</p>}</>}
    {action.isError && <p role="alert" className="referral-field-error">{apiErrorMessage(action.error)}</p>}
    <div className="referral-actions"><button type="button" className="community-action" onClick={onCancel} disabled={action.isPending}>Cancel</button><button type="submit" className="community-primary" disabled={action.isPending}>{action.isPending ? 'Sending…' : kind === 'application' ? 'Send request' : 'Send offer'}</button></div>
  </form>;
}
