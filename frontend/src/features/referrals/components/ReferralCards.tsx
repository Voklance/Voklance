import type { ReferralNeed, ReferralOpportunity } from '@voklance/shared';
import { Link } from 'react-router';

export function ReferralStatusBadge({ status }: { status: string }) {
  return <span className="referral-status" data-status={status.toLowerCase()}>{status.toLowerCase()}</span>;
}
function Author({ person }: { person: { name: string; username: string | null; headline: string | null } }) {
  return <p className="referral-byline">By {person.username ? <Link to={`/app/professionals/${person.username}`}>{person.name}</Link> : person.name}{person.headline && <> · {person.headline}</>}</p>;
}
export function ReferralOpportunityCard({ item, detailed = false }: { item: ReferralOpportunity; detailed?: boolean }) {
  return <article className="referral-card">
    <div className="referral-card-top"><span className="referral-kicker">Referral opportunity</span><ReferralStatusBadge status={item.status} /></div>
    <h3>{item.details.jobTitle}</h3><p className="referral-company">{item.details.company}</p>
    <Author person={item.author} />
    <dl><div><dt>Location</dt><dd>{item.details.location}</dd></div><div><dt>Work mode</dt><dd>{item.details.workMode}</dd></div>
      {(item.details.experienceMin !== undefined || item.details.experienceMax !== undefined) && <div><dt>Experience</dt><dd>{item.details.experienceMin ?? 0}–{item.details.experienceMax ?? 'any'} years</dd></div>}
      {item.details.requiredSkills?.length ? <div><dt>Skills</dt><dd>{item.details.requiredSkills.join(', ')}</dd></div> : null}
    </dl>
    {detailed && <p className="referral-description">{item.details.description}</p>}
    <div className="referral-card-links"><Link to={`/app/referrals/opportunities/${item.id}`}>{detailed ? 'Refresh opportunity' : 'View opportunity'}</Link><Link to={`/app/communities/${item.community.slug}`}>{item.community.name}</Link><a href={item.details.jobUrl} target="_blank" rel="noopener noreferrer">Job link</a></div>
  </article>;
}
export function ReferralNeedCard({ item, detailed = false }: { item: ReferralNeed; detailed?: boolean }) {
  return <article className="referral-card">
    <div className="referral-card-top"><span className="referral-kicker">Referral request</span><ReferralStatusBadge status={item.status} /></div>
    <h3>{item.details.jobTitle}</h3><p className="referral-company">{item.details.company}</p>
    <Author person={item.author} />
    <dl><div><dt>Experience</dt><dd>{item.details.experienceLevel}</dd></div>{item.details.skills?.length ? <div><dt>Skills</dt><dd>{item.details.skills.join(', ')}</dd></div> : null}</dl>
    {detailed && <p className="referral-description">{item.details.message}</p>}
    <div className="referral-card-links"><Link to={`/app/referrals/needs/${item.id}`}>{detailed ? 'Refresh request' : 'View request'}</Link><Link to={`/app/communities/${item.community.slug}`}>{item.community.name}</Link>{item.details.jobUrl && <a href={item.details.jobUrl} target="_blank" rel="noopener noreferrer">Job link</a>}</div>
  </article>;
}
