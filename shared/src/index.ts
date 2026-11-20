export const API_V1_PREFIX = '/api/v1';
export * from './communityCommands.js';
export * from './referrals.js';
export * from './events.js';
export * from './resources.js';
export * from './connections.js';
export * from './messaging.js';
export * from './notifications.js';
export * from './github.js';
export * from './search.js';
export * from './recommendations.js';
export * from './bookmarks.js';
export * from './portfolio.js';
import type { ProfileCertification, ProfileProject, ProfileSectionId } from './portfolio.js';
export const POST_CONTENT_LIMIT = 3000;
export const COMMENT_CONTENT_LIMIT = 1000;
export const COMMUNITY_CATEGORIES = [
  'software-development',
  'data-science-ai',
  'ui-ux-design',
  'product-management',
  'cybersecurity',
  'cloud-devops',
  'business-finance',
  'marketing',
  'human-resources',
  'other-professional-fields'
] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];
export const COMMUNITY_CATEGORY_LABELS: Record<CommunityCategory, string> = {
  'software-development': 'Software Development',
  'data-science-ai': 'Data Science & AI',
  'ui-ux-design': 'UI/UX Design',
  'product-management': 'Product Management',
  cybersecurity: 'Cybersecurity',
  'cloud-devops': 'Cloud & DevOps',
  'business-finance': 'Business & Finance',
  marketing: 'Marketing',
  'human-resources': 'Human Resources',
  'other-professional-fields': 'Other Professional Fields'
};
export const COMMUNITY_ROLES = ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'] as const;
export type CommunityRole = (typeof COMMUNITY_ROLES)[number];
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REMOVED' | null;
export type CommunityVisibility = 'PUBLIC' | 'PRIVATE';
export type CommunityStatus = 'ACTIVE' | 'ARCHIVED';

export interface CommunityPermissions {
  viewMembers: boolean;
  reviewRequests: boolean;
  editDetails: boolean;
  manageRoles: boolean;
  removeMembers: boolean;
  transferOwnership: boolean;
  archive: boolean;
}

export interface CommunitySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: CommunityCategory;
  tags: string[];
  visibility: CommunityVisibility;
  status: CommunityStatus;
  memberCount: number;
  membershipStatus: MembershipStatus;
  myRole: CommunityRole | null;
  createdAt: string;
}

export interface CommunityDetail extends CommunitySummary {
  rules: string | null;
  owner: PostAuthor | null;
  permissions: CommunityPermissions;
}

export interface CommunityMember {
  userId: string;
  name: string;
  username: string | null;
  headline: string | null;
  role: CommunityRole;
  joinedAt: string;
}

export interface CommunityMembershipRequest {
  id: string;
  member: CommunityMember;
  createdAt: string;
}

export interface CommunityPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CommunityInput {
  name: string;
  description: string;
  category: CommunityCategory;
  tags: string[];
  visibility: CommunityVisibility;
  rules: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  accountStatus: AccountStatus;
  onboardingStatus: OnboardingStatus;
  emailVerifiedAt: string | null;
  emailVerificationRequired: boolean;
}

export interface HealthData {
  status: 'ok';
  service: 'Voklance API';
  database: 'connected' | 'disconnected';
  timestamp: string;
}

export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ONBOARDING_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];
export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

export const PROFESSIONAL_STATUSES = [
  'STUDENT',
  'WORKING_PROFESSIONAL',
  'FREELANCER',
  'FOUNDER',
  'RECRUITER',
  'EDUCATOR',
  'OTHER'
] as const;
export type ProfessionalStatus = (typeof PROFESSIONAL_STATUSES)[number];

export const USERNAME_PATTERN = /^[a-z][a-z0-9._-]{2,29}$/;
export const PROFILE_VISIBILITIES = ['PRIVATE', 'PUBLIC'] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

export interface ProfessionalProfile {
  id: string;
  username: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  headline: string;
  country: string;
  city?: string;
  bio?: string;
  avatarUrl?: string;
  professionalStatus?: ProfessionalStatus;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  websiteUrl?: string | null;
  visibility?: ProfileVisibility;
  sectionOrder?: ProfileSectionId[];
}

export interface PublicProfileResponseData {
  profile: Omit<ProfessionalProfile, 'id' | 'visibility' | 'avatarUrl'>;
  skills: CatalogItem[];
  experiences: ProfessionalExperience[];
  education: Education[];
  certifications?: ProfileCertification[];
  projects?: ProfileProject[];
}

export interface CatalogItem {
  id: string;
  name: string;
  slug: string;
  category: string;
}

export interface CatalogPage {
  items: CatalogItem[];
  page: number;
  limit: number;
  total: number;
}

export interface ProfessionalExperience {
  id: string;
  jobTitle: string;
  companyName: string;
  employmentType?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate?: string;
}

export interface OnboardingSnapshot {
  status: OnboardingStatus;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  completedAt?: string;
  profile: ProfessionalProfile | null;
  skills: CatalogItem[];
  interests: CatalogItem[];
  experiences: ProfessionalExperience[];
  education: Education[];
}

export interface ProfileResponseData {
  profile: ProfessionalProfile | null;
}

export interface OnboardingIdentityRequest {
  firstName: string;
  lastName: string;
  headline?: string;
}

export type ProfilePatchRequest = Partial<
  Pick<
    ProfessionalProfile,
    | 'username'
    | 'fullName'
    | 'headline'
    | 'country'
    | 'city'
    | 'bio'
    | 'professionalStatus'
    | 'visibility'
    | 'sectionOrder'
  >
> & { githubUrl?: string | null; portfolioUrl?: string | null; websiteUrl?: string | null };

export interface UsernameAvailabilityData {
  username: string;
  available: boolean;
}

export interface SkillsResponseData {
  skills: CatalogItem[];
}

export interface SkillSelectionRequest {
  skillIds: string[];
}

export interface InterestsResponseData {
  interests: CatalogItem[];
}

export interface InterestSelectionRequest {
  interestIds: string[];
}

export interface ExperiencesResponseData {
  experiences: ProfessionalExperience[];
}

export interface ExperienceResponseData {
  experience: ProfessionalExperience;
}

export type ExperienceCreateRequest = Omit<ProfessionalExperience, 'id' | 'endDate'> & {
  endDate?: string | null;
};

export type ExperiencePatchRequest = Partial<ExperienceCreateRequest>;

export interface EducationsResponseData {
  educations: Education[];
}

export interface PostAuthor {
  name: string;
  username: string | null;
  headline: string | null;
}

export interface FeedPost {
  id: string;
  content: string;
  author: PostAuthor;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  ownedByMe: boolean;
}

export interface FeedPage {
  items: FeedPost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface FeedComment {
  id: string;
  postId: string;
  content: string;
  author: PostAuthor;
  createdAt: string;
  updatedAt: string;
  ownedByMe: boolean;
}

export interface CommentPage {
  items: FeedComment[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface EducationResponseData {
  education: Education;
}

export type EducationCreateRequest = Omit<Education, 'id' | 'endDate'> & { endDate?: string | null };
export type EducationPatchRequest = Partial<EducationCreateRequest>;

export interface OnboardingResponseData {
  onboarding: OnboardingSnapshot;
}

export interface OnboardingProgressRequest {
  currentStep: OnboardingStep;
}
