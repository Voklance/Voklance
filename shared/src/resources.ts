import type { PostAuthor } from './index.js';

export const RESOURCE_CATEGORIES = [
  'interview-preparation',
  'learning-material',
  'technical-documentation',
  'presentation',
  'tutorial',
  'research',
  'career-development',
  'other'
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];
export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  'interview-preparation': 'Interview Preparation',
  'learning-material': 'Learning Material',
  'technical-documentation': 'Technical Documentation',
  presentation: 'Presentation',
  tutorial: 'Tutorial',
  research: 'Research',
  'career-development': 'Career Development',
  other: 'Other'
};
export const RESOURCE_FILE_TYPES = {
  pdf: { mime: 'application/pdf', extensions: ['.pdf'] },
  ppt: { mime: 'application/vnd.ms-powerpoint', extensions: ['.ppt'] },
  pptx: {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['.pptx']
  },
  doc: { mime: 'application/msword', extensions: ['.doc'] },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx']
  }
} as const;
export type ResourceFileType = keyof typeof RESOURCE_FILE_TYPES;
export const RESOURCE_MAX_FILE_BYTES = 10 * 1024 * 1024;
export type ResourceStatus = 'published' | 'hidden' | 'deleted';
export type ResourceReportReason =
  'spam' | 'misleading' | 'copyright' | 'inappropriate' | 'malicious' | 'other';
export type ResourceReportStatus = 'pending' | 'reviewed' | 'dismissed';
export interface ResourceFileDTO {
  id: string;
  safeFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  previewAvailable: boolean;
}
export interface CommunityResourceDTO {
  id: string;
  activityId: string;
  community: { id: string; name: string; slug: string };
  uploader: PostAuthor;
  title: string;
  description: string;
  category: ResourceCategory;
  tags: string[];
  file: ResourceFileDTO;
  status: ResourceStatus;
  createdAt: string;
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
  canReport: boolean;
}
export interface ResourcePage {
  items: CommunityResourceDTO[];
  nextCursor: string | null;
  hasMore: boolean;
}
export interface ResourceReportDTO {
  id: string;
  resourceId: string;
  reason: ResourceReportReason;
  description: string | null;
  status: ResourceReportStatus;
  createdAt: string;
  reviewedAt: string | null;
}
export interface ResourceReportPage {
  items: ResourceReportDTO[];
  nextCursor: string | null;
  hasMore: boolean;
}
