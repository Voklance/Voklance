import type { CommunityResourceDTO } from '@voklance/shared';
import { Link } from 'react-router';

export default function ResourceCard({ resource }: { resource: CommunityResourceDTO }) {
  return (
    <article className="community-panel resource-card">
      <div className="resource-card-top">
        <span className="command-activity-type">{resource.category.replaceAll('-', ' ')}</span>
        <span role="status">{resource.status}</span>
      </div>
      <h3>
        <Link to={`/app/resources/${resource.id}`}>{resource.title}</Link>
      </h3>
      <p>{resource.description}</p>
      <p>
        {resource.file.safeFilename} · {(resource.file.sizeBytes / 1024 / 1024).toFixed(1)} MB
      </p>
      <p>
        Shared by {resource.uploader.name} in{' '}
        <Link to={`/app/communities/${resource.community.slug}`}>{resource.community.name}</Link>
      </p>
      {resource.tags.length > 0 && <p>Topics: {resource.tags.join(', ')}</p>}
    </article>
  );
}
