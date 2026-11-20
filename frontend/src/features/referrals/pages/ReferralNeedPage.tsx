import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommunity } from '@/features/communities/hooks/useCommunities';
import { ReferralNeedCard } from '../components/ReferralCards';
import ReferralResponseForm from '../components/ReferralResponseForm';
import ReferralDetailsEditor from '../components/ReferralDetailsEditor';
import { ReferralResponseCard, ReferralResponses } from '../components/ReferralResponses';
import { useNeed, useReferralActions } from '../hooks/useReferrals';

export default function ReferralNeedPage() {
  const { needId = '' } = useParams();
  const query = useNeed(needId);
  const community = useCommunity(query.data?.need.community.slug ?? '');
  const [form, setForm] = useState<'offer' | 'edit' | null>(null);
  const actions = useReferralActions();
  if (query.isPending)
    return (
      <p role="status" className="community-state">
        Loading referral request…
      </p>
    );
  if (query.isError)
    return (
      <div className="community-state" role="alert">
        Referral request could not be loaded.{' '}
        <button type="button" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  const item = query.data.need;
  const activeMember =
    community.data?.community.membershipStatus === 'ACTIVE' && community.data.community.status === 'ACTIVE';
  return (
    <div className="referral-page">
      <nav className="referral-breadcrumb">
        <Link to="/app/referrals">My referrals</Link>
        <span>/</span>
        <Link to={`/app/communities/${item.community.slug}`}>{item.community.name}</Link>
      </nav>
      <h1>Referral request</h1>
      <ReferralNeedCard item={item} detailed />
      <p className="referral-note">
        An offer is a member's statement of willingness to help. Employer affiliation is not verified by
        Voklance.
      </p>
      {item.ownedByMe ? (
        <>
          {item.status === 'OPEN' && (
            <div className="referral-actions">
              <button
                type="button"
                className="community-action"
                onClick={() => setForm(form === 'edit' ? null : 'edit')}
              >
                Edit request
              </button>
              <button
                type="button"
                className="community-action"
                disabled={actions.closeNeed.isPending}
                onClick={() => {
                  if (window.confirm('Close this request to new offers?')) actions.closeNeed.mutate(item.id);
                }}
              >
                Close request
              </button>
              <button
                type="button"
                className="community-action"
                disabled={actions.fulfillNeed.isPending}
                onClick={() => actions.fulfillNeed.mutate(item.id)}
              >
                Mark fulfilled
              </button>
            </div>
          )}
          {(actions.closeNeed.isError || actions.fulfillNeed.isError) && (
            <p role="alert" className="referral-field-error">
              {apiErrorMessage(actions.closeNeed.error ?? actions.fulfillNeed.error)}
            </p>
          )}
          {form === 'edit' && (
            <ReferralDetailsEditor
              kind="need"
              id={item.id}
              initial={item.details}
              onCancel={() => setForm(null)}
              onSuccess={() => setForm(null)}
            />
          )}
          <ReferralResponses targetId={item.id} kind="offers" />
        </>
      ) : item.myOffer ? (
        <section className="referral-panel">
          <h2>Your offer</h2>
          <ReferralResponseCard response={item.myOffer} kind="offer" owner={false} />
          <p>Confirm a submitted referral only after sending it through the employer's process.</p>
        </section>
      ) : item.status === 'OPEN' && activeMember ? (
        <section className="referral-panel">
          <h2>Can you help?</h2>
          {form === 'offer' ? (
            <ReferralResponseForm
              kind="offer"
              targetId={item.id}
              onCancel={() => setForm(null)}
              onSuccess={() => setForm(null)}
            />
          ) : (
            <button type="button" className="community-primary" onClick={() => setForm('offer')}>
              Offer referral
            </button>
          )}
        </section>
      ) : (
        <p className="referral-note">
          {item.status === 'OPEN'
            ? 'Join this community to offer a referral.'
            : 'This request is no longer accepting offers.'}
        </p>
      )}
    </div>
  );
}
