import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/lib/apiClient';
import { portfolioApi } from '../api/portfolioApi';
import type { ProfileCertification, ProfileProject } from '@voklance/shared';

export default function PortfolioManager() {
  const client = useQueryClient();
  const certifications = useQuery({ queryKey: ['my-certifications'], queryFn: portfolioApi.certifications });
  const projects = useQuery({ queryKey: ['my-projects'], queryFn: portfolioApi.projects });
  const [editingCert, setEditingCert] = useState<ProfileCertification | null>(null);
  const [editingProject, setEditingProject] = useState<ProfileProject | null>(null);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['my-certifications'] }),
      client.invalidateQueries({ queryKey: ['my-projects'] }),
      client.invalidateQueries({ queryKey: ['profiles'] })
    ]);
  };
  const saveCert = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: object }) =>
      id ? portfolioApi.updateCertification(id, value) : portfolioApi.addCertification(value),
    onSuccess: async () => {
      setEditingCert(null);
      await refresh();
    }
  });
  const removeCert = useMutation({ mutationFn: portfolioApi.removeCertification, onSuccess: refresh });
  const saveProject = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: object }) =>
      id ? portfolioApi.updateProject(id, value) : portfolioApi.addProject(value),
    onSuccess: async () => {
      setEditingProject(null);
      await refresh();
    }
  });
  const removeProject = useMutation({ mutationFn: portfolioApi.removeProject, onSuccess: refresh });
  function submitCert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(event.currentTarget);
    saveCert.mutate(
      {
        id: editingCert?.id,
        value: {
          name: String(form.get('name')),
          issuingOrganization: String(form.get('organization')),
          issueDate: String(form.get('issueDate')),
          expirationDate: String(form.get('expirationDate')) || null,
          credentialId: String(form.get('credentialId')) || null,
          credentialUrl: String(form.get('credentialUrl')) || null
        }
      },
      {
        onSuccess: () => {
          if (!editingCert) element.reset();
        }
      }
    );
  }
  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(event.currentTarget);
    saveProject.mutate(
      {
        id: editingProject?.id,
        value: {
          title: String(form.get('title')),
          description: String(form.get('description')),
          role: String(form.get('role')),
          technologies: String(form.get('technologies'))
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean),
          projectUrl: String(form.get('projectUrl')) || null,
          repositoryUrl: String(form.get('repositoryUrl')) || null,
          startDate: String(form.get('startDate')) || null,
          endDate: String(form.get('endDate')) || null,
          isOngoing: form.get('isOngoing') === 'on',
          isFeatured: form.get('isFeatured') === 'on',
          displayOrder: Number(form.get('displayOrder') || 0)
        }
      },
      {
        onSuccess: () => {
          if (!editingProject) element.reset();
        }
      }
    );
  }
  return (
    <div className="portfolio-manager">
      <section className="profile-section" id="profile-certifications-editor">
        <h2>Manage certifications</h2>
        {certifications.isError && <p role="alert">Could not load certifications.</p>}
        <ul>
          {certifications.data?.items.map((item) => (
            <li key={item.id}>
              {item.name} · {item.issuingOrganization}{' '}
              <button type="button" onClick={() => setEditingCert(item)}>
                Edit
              </button>{' '}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove ${item.name}?`)) removeCert.mutate(item.id);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form key={editingCert?.id ?? 'new-cert'} onSubmit={submitCert} className="portfolio-form">
          <h3>{editingCert ? 'Edit certification' : 'Add certification'}</h3>
          <label>
            Name
            <input name="name" required minLength={2} maxLength={160} defaultValue={editingCert?.name} />
          </label>
          <label>
            Issuing organization
            <input
              name="organization"
              required
              minLength={2}
              maxLength={160}
              defaultValue={editingCert?.issuingOrganization}
            />
          </label>
          <label>
            Issue date
            <input name="issueDate" type="date" required defaultValue={editingCert?.issueDate} />
          </label>
          <label>
            Expiration date
            <input name="expirationDate" type="date" defaultValue={editingCert?.expirationDate ?? ''} />
          </label>
          <label>
            Credential ID
            <input name="credentialId" maxLength={160} defaultValue={editingCert?.credentialId ?? ''} />
          </label>
          <label>
            Credential URL
            <input
              name="credentialUrl"
              type="url"
              placeholder="https://"
              defaultValue={editingCert?.credentialUrl ?? ''}
            />
          </label>
          <div className="saved-filter-row">
            <button className="community-primary" disabled={saveCert.isPending}>
              {editingCert ? 'Save certification' : 'Add certification'}
            </button>
            {editingCert && (
              <button type="button" onClick={() => setEditingCert(null)}>
                Cancel
              </button>
            )}
          </div>
        </form>
        {(saveCert.isError || removeCert.isError) && (
          <p role="alert">{apiErrorMessage(saveCert.error ?? removeCert.error)}</p>
        )}
      </section>
      <section className="profile-section" id="profile-projects-editor">
        <h2>Manage projects</h2>
        {projects.isError && <p role="alert">Could not load projects.</p>}
        <ul>
          {projects.data?.items.map((item) => (
            <li key={item.id}>
              {item.title}
              {item.isFeatured ? ' · Featured' : ''}{' '}
              <button type="button" onClick={() => setEditingProject(item)}>
                Edit
              </button>{' '}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove ${item.title}?`)) removeProject.mutate(item.id);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form key={editingProject?.id ?? 'new-project'} onSubmit={submitProject} className="portfolio-form">
          <h3>{editingProject ? 'Edit project' : 'Add project'}</h3>
          <label>
            Title
            <input name="title" required minLength={2} maxLength={160} defaultValue={editingProject?.title} />
          </label>
          <label>
            Description
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={2000}
              defaultValue={editingProject?.description}
            />
          </label>
          <label>
            Your role
            <input name="role" maxLength={120} defaultValue={editingProject?.role} />
          </label>
          <label>
            Technologies, comma separated
            <input name="technologies" defaultValue={editingProject?.technologies.join(', ')} />
          </label>
          <label>
            Project URL
            <input
              name="projectUrl"
              type="url"
              placeholder="https://"
              defaultValue={editingProject?.projectUrl ?? ''}
            />
          </label>
          <label>
            Repository URL
            <input
              name="repositoryUrl"
              type="url"
              placeholder="https://"
              defaultValue={editingProject?.repositoryUrl ?? ''}
            />
          </label>
          <label>
            Start date
            <input name="startDate" type="date" defaultValue={editingProject?.startDate ?? ''} />
          </label>
          <label>
            End date
            <input name="endDate" type="date" defaultValue={editingProject?.endDate ?? ''} />
          </label>
          <label>
            <input name="isOngoing" type="checkbox" defaultChecked={editingProject?.isOngoing} /> Ongoing
          </label>
          <label>
            <input name="isFeatured" type="checkbox" defaultChecked={editingProject?.isFeatured} /> Featured
            (up to four)
          </label>
          <label>
            Display order
            <input
              name="displayOrder"
              type="number"
              min={0}
              max={1000}
              defaultValue={editingProject?.displayOrder ?? 0}
            />
          </label>
          <div className="saved-filter-row">
            <button className="community-primary" disabled={saveProject.isPending}>
              {editingProject ? 'Save project' : 'Add project'}
            </button>
            {editingProject && (
              <button type="button" onClick={() => setEditingProject(null)}>
                Cancel
              </button>
            )}
          </div>
        </form>
        {(saveProject.isError || removeProject.isError) && (
          <p role="alert">{apiErrorMessage(saveProject.error ?? removeProject.error)}</p>
        )}
      </section>
    </div>
  );
}
