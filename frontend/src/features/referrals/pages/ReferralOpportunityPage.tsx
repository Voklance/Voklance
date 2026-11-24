import { useState } from 'react';
import { Link, useParams } from 'react-router';
import BookmarkButton from '@/features/bookmarks/components/BookmarkButton';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommunity } from '@/features/communities/hooks/useCommunities';
import { ReferralOpportunityCard } from '../components/ReferralCards';
import ReferralResponseForm from '../components/ReferralResponseForm';
import ReferralDetailsEditor from '../components/ReferralDetailsEditor';
import { ReferralResponseCard, ReferralResponses } from '../components/ReferralResponses';
import { useOpportunity, useReferralActions } from '../hooks/useReferrals';

export default function ReferralOpportunityPage() {
  const { opportunityId = '' } = useParams();
  const query = useOpportunity(opportunityId);
  const community = useCommunity(query.data?.opportunity.community.slug ?? '');
  const [form, setForm] = useState<'apply' | 'edit' | null>(null);
  const actions = useReferralActions();
  if (query.isPending)
    return (
      <p role="status" className="community-state">
        Loading opportunity…
      </p>
    );
  if (query.isError)
    return (
      <div className="community-state" role="alert">
        Opportunity could not be loaded.{' '}
        <button type="button" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  const item = query.data.opportunity;
  const activeMember =
    community.data?.community.membershipStatus === 'ACTIVE' && community.data.community.status === 'ACTIVE';
  return (
    <div className="referral-page">
      <nav className="referral-breadcrumb">
        <Link to={`/app/communities/${item.community.slug}`}>{item.community.name}</Link>
      </nav>
      <h1>Referral opportunity</h1>
      {item.status === 'OPEN' && <BookmarkButton type="referral" entityId={item.id} />}
      <ReferralOpportunityCard item={item} detailed />
      <p className="referral-note">
        This opportunity was posted by a community member. Voklance has not verified the job or employer
        affiliation.
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
                Edit opportunity
              </button>
              <button
                type="button"
                className="community-action"
                disabled={actions.closeOpportunity.isPending}
                onClick={() => {
                  if (window.confirm('Close this opportunity to new requests?'))
                    actions.closeOpportunity.mutate(item.id);
                }}
              >
                Close opportunity
              </button>
            </div>
          )}
          {actions.closeOpportunity.isError && (
            <p role="alert" className="referral-field-error">
              {apiErrorMessage(actions.closeOpportunity.error)}
            </p>
          )}
          {form === 'edit' && (
            <ReferralDetailsEditor
              kind="opportunity"
              id={item.id}
              initial={item.details}
              onCancel={() => setForm(null)}
              onSuccess={() => setForm(null)}
            />
          )}
          <ReferralResponses targetId={item.id} kind="applications" />
        </>
      ) : item.myApplication ? (
        <section className="referral-panel">
          <h2>Your request</h2>
          <ReferralResponseCard response={item.myApplication} kind="application" owner={false} />
          <p>
            Accepted means the referrer agreed to help. Submitted means they confirmed an employer referral
            was sent.
          </p>
        </section>
      ) : item.status === 'OPEN' && activeMember ? (
        <section className="referral-panel">
          <h2>Interested in this role?</h2>
          {form === 'apply' ? (
            <ReferralResponseForm
              kind="application"
              targetId={item.id}
              onCancel={() => setForm(null)}
              onSuccess={() => setForm(null)}
            />
          ) : (
            <button type="button" className="community-primary" onClick={() => setForm('apply')}>
              Request referral
            </button>
          )}
        </section>
      ) : (
        <p className="referral-note">
          {item.status === 'OPEN'
            ? 'Join this community to request a referral.'
            : 'This opportunity is no longer accepting requests.'}
        </p>
      )}
    </div>
  );
}
