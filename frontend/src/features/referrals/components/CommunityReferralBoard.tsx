import { useState } from 'react';
import { Link } from 'react-router';
import { ReferralNeedCard, ReferralOpportunityCard } from './ReferralCards';
import { useCommunityNeeds, useCommunityOpportunities } from '../hooks/useReferrals';

export default function CommunityReferralBoard({ communityId }: { communityId: string }) {
  const [opportunityStatus, setOpportunityStatus] = useState('');
  const [needStatus, setNeedStatus] = useState('');
  const opportunities = useCommunityOpportunities(communityId, opportunityStatus || undefined);
  const needs = useCommunityNeeds(communityId, needStatus || undefined);
  const opportunityItems = opportunities.data?.pages.flatMap((page) => page.items) ?? [];
  const needItems = needs.data?.pages.flatMap((page) => page.items) ?? [];
  return <section className="community-referral-board" aria-labelledby="community-referrals-title"><div className="community-referral-heading"><div><span className="referral-kicker">Career collaboration</span><h2 id="community-referrals-title">Referrals in this community</h2><p>Explore openings and requests from members. Response details stay private to participants.</p></div><Link to="/app/referrals">My referrals</Link></div>
    <div className="community-referral-columns"><section><div className="referral-section-heading"><h3>Opportunities</h3><label>Show opportunities <select value={opportunityStatus} onChange={(event) => setOpportunityStatus(event.target.value)}><option value="">All</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option><option value="EXPIRED">Expired</option></select></label></div>
      {opportunities.isPending ? <p role="status">Loading opportunities…</p> : opportunities.isError ? <div role="alert">Opportunities could not be loaded. <button type="button" onClick={() => void opportunities.refetch()}>Try again</button></div> : opportunityItems.length === 0 ? <p>No opportunities match this filter.</p> : <>{opportunityItems.map((item) => <ReferralOpportunityCard key={item.id} item={item} />)}{opportunities.hasNextPage && <button type="button" className="community-load" disabled={opportunities.isFetchingNextPage} onClick={() => void opportunities.fetchNextPage()}>Load more opportunities</button>}</>}
    </section><section><div className="referral-section-heading"><h3>Requests</h3><label>Show requests <select value={needStatus} onChange={(event) => setNeedStatus(event.target.value)}><option value="">All</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option><option value="FULFILLED">Fulfilled</option></select></label></div>
      {needs.isPending ? <p role="status">Loading requests…</p> : needs.isError ? <div role="alert">Requests could not be loaded. <button type="button" onClick={() => void needs.refetch()}>Try again</button></div> : needItems.length === 0 ? <p>No requests match this filter.</p> : <>{needItems.map((item) => <ReferralNeedCard key={item.id} item={item} />)}{needs.hasNextPage && <button type="button" className="community-load" disabled={needs.isFetchingNextPage} onClick={() => void needs.fetchNextPage()}>Load more requests</button>}</>}
    </section></div>
  </section>;
}
