import type { ProfessionalSummary } from '@voklance/shared';
import { Link } from 'react-router';
import ConnectionButton from './ConnectionButton';

export default function ProfessionalCard({ person }: { person: ProfessionalSummary }) {
  return (
    <article className="network-card">
      <div className="network-card-head">
        <span className="network-avatar" aria-hidden="true">
          {person.fullName.charAt(0).toUpperCase()}
        </span>
        <div>
          <h2>
            <Link to={`/app/professionals/${person.username}`}>{person.fullName}</Link>
          </h2>
          <p>@{person.username}</p>
        </div>
      </div>
      <p className="network-headline">{person.headline}</p>
      <p className="network-location">{[person.city, person.country].filter(Boolean).join(', ')}</p>
      {person.skills.length > 0 && (
        <div className="network-skills" aria-label="Skills">
          {person.skills.slice(0, 5).map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      )}
      {person.connectionCount !== null && <p>{person.connectionCount} connections</p>}
      <ConnectionButton username={person.username} userId={person.userId} status={person.connectionStatus} />
    </article>
  );
}
