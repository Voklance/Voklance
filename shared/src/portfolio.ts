export interface ProfileCertification {
  id: string;
  name: string;
  issuingOrganization: string;
  issueDate: string;
  expirationDate: string | null;
  credentialId: string | null;
  credentialUrl: string | null;
}
export interface ProfileProject {
  id: string;
  title: string;
  description: string;
  role: string;
  technologies: string[];
  projectUrl: string | null;
  repositoryUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  isOngoing: boolean;
  isFeatured: boolean;
  displayOrder: number;
}
export const PROFILE_SECTION_IDS = [
  'about',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'github',
  'links'
] as const;
export type ProfileSectionId = (typeof PROFILE_SECTION_IDS)[number];
export interface ProfileCompleteness {
  percentage: number;
  completedSections: string[];
  suggestedSections: string[];
}
