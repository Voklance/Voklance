import type { ApplicationStatus, OfferStatus, ReferralApplication, ReferralOffer } from '@voklance/shared';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useApplications, useOffers, useReferralActions } from '../hooks/useReferrals';
import { ReferralStatusBadge } from './ReferralCards';

function Person({ name, username }: { name: string; username: string | null }) {
  return username ? <Link to={`/app/professionals/${username}`}>{name}</Link> : <span>{name}</span>;
}
export function ResponseActions({
  response,
  kind,
  owner
}: {
  response: ReferralApplication | ReferralOffer;
  kind: 'application' | 'offer';
  owner: boolean;
}) {
  const actions = useReferralActions();
  const mutation = kind === 'application' ? actions.applicationStatus : actions.offerStatus;
  let next: string[] = [];
  if (kind === 'application') {
    if (owner && response.status === 'REQUESTED') next = ['ACCEPTED', 'DECLINED'];
    else if (owner && response.status === 'ACCEPTED') next = ['SUBMITTED'];
    else if (owner && response.status === 'SUBMITTED') next = ['COMPLETED'];
    else if (!owner && (response.status === 'REQUESTED' || response.status === 'ACCEPTED'))
      next = ['WITHDRAWN'];
  } else {
    if (owner && response.status === 'OFFERED') next = ['ACCEPTED', 'DECLINED'];
    else if (!owner && response.status === 'OFFERED') next = ['WITHDRAWN'];
    else if (!owner && response.status === 'ACCEPTED') next = ['SUBMITTED'];
    else if (!owner && response.status === 'SUBMITTED') next = ['COMPLETED'];
  }
  if (!next.length) return null;
  return (
    <div className="referral-response-actions">
      {next.map((status) => (
        <button
          key={status}
          type="button"
          className="community-action"
          disabled={mutation.isPending}
          onClick={() => {
            if (kind === 'application')
              actions.applicationStatus.mutate({ id: response.id, status: status as ApplicationStatus });
            else actions.offerStatus.mutate({ id: response.id, status: status as OfferStatus });
          }}
        >
          {status === 'SUBMITTED'
            ? 'Confirm employer referral submitted'
            : status === 'COMPLETED'
              ? 'Mark workflow complete'
              : status.toLowerCase()}
        </button>
      ))}
      {mutation.isError && (
        <p role="alert" className="referral-field-error">
          {apiErrorMessage(mutation.error)}
        </p>
      )}
    </div>
  );
}
export function ReferralResponseCard({
  response,
  kind,
  owner
}: {
  response: ReferralApplication | ReferralOffer;
  kind: 'application' | 'offer';
  owner: boolean;
}) {
  const person =
    kind === 'application' ? (response as ReferralApplication).applicant : (response as ReferralOffer).helper;
  return (
    <article className="referral-response-card">
      <div className="referral-card-top">
        <strong>
          <Person name={person.name} username={person.username} />
        </strong>
        <ReferralStatusBadge status={response.status} />
      </div>
      {person.headline && <p>{person.headline}</p>}
      <p>{response.introduction}</p>
      {kind === 'application' ? (
        <>
          {(response as ReferralApplication).relevantSkills.length > 0 && (
            <p>Skills: {(response as ReferralApplication).relevantSkills.join(', ')}</p>
          )}
          {(response as ReferralApplication).portfolioUrl && (
            <a
              href={(response as ReferralApplication).portfolioUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              Professional link
            </a>
          )}
        </>
      ) : (
        <>
          <p>{(response as ReferralOffer).offerDetails}</p>
          {(response as ReferralOffer).employerRelationship && (
            <p>
              Relationship stated by helper (unverified): {(response as ReferralOffer).employerRelationship}
            </p>
          )}
        </>
      )}
      <time dateTime={response.createdAt}>{new Date(response.createdAt).toLocaleString()}</time>
      <ResponseActions response={response} kind={kind} owner={owner} />
    </article>
  );
}
export function ReferralResponses({ targetId, kind }: { targetId: string; kind: 'applications' | 'offers' }) {
  const applications = useApplications(targetId, kind === 'applications');
  const offers = useOffers(targetId, kind === 'offers');
  const query = kind === 'applications' ? applications : offers;
  const items: (ReferralApplication | ReferralOffer)[] =
    kind === 'applications'
      ? (applications.data?.pages.flatMap((page) => page.items) ?? [])
      : (offers.data?.pages.flatMap((page) => page.items) ?? []);
  return (
    <section className="referral-responses">
      <h2>{kind === 'applications' ? 'Referral requests' : 'Offers to help'}</h2>
      {query.isPending ? (
        <p role="status">Loading responses…</p>
      ) : query.isError ? (
        <div role="alert">
          Responses could not be loaded.{' '}
          <button type="button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <p>No responses yet.</p>
      ) : (
        <>
          <div className="referral-response-list">
            {items.map((item) => (
              <ReferralResponseCard
                key={item.id}
                response={item}
                kind={kind === 'applications' ? 'application' : 'offer'}
                owner
              />
            ))}
          </div>
          {query.hasNextPage && (
            <button
              type="button"
              className="community-load"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Load more responses
            </button>
          )}
        </>
      )}
    </section>
  );
}
