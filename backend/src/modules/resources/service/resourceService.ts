import { Types, type HydratedDocument } from 'mongoose';
import type {
  CommunityResourceDTO,
  ResourcePage,
  ResourceReportDTO,
  ResourceReportPage
} from '@voklance/shared';
import { AppError } from '../../../common/AppError.js';
import { withReplicaTransaction } from '../../../common/withReplicaTransaction.js';
import { resolveCommunityAccess } from '../../communities/service/communityService.js';
import { canModerateActivity } from '../../communities/service/communityPermissions.js';
import { safeAuthorsFor } from '../../commands/service/commandService.js';
import CommunityActivity from '../../commands/model/CommunityActivity.js';
import Community from '../../communities/model/Community.js';
import CommunityMembership from '../../memberships/model/CommunityMembership.js';
import CommunityResource, { type CommunityResourceRecord } from '../model/CommunityResource.js';
import StoredFile from '../model/StoredFile.js';
import ResourceReport from '../model/ResourceReport.js';
import type {
  ReportInput,
  ReportQuery,
  ResourcePatch,
  ResourceQuery
} from '../validation/resourceSchemas.js';

const oid = (value: string) => new Types.ObjectId(value);
const forbidden = () =>
  new AppError(403, 'RESOURCE_FORBIDDEN', 'This resource action is unavailable to you.');
const missing = () => new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
const storageUnavailable = () =>
  new AppError(
    503,
    'RESOURCE_STORAGE_UNAVAILABLE',
    'Approved private storage and scanning are not configured.'
  );
const duplicate = (error: unknown) =>
  !!error && typeof error === 'object' && 'code' in error && error.code === 11000;
const mayModerate = (role: string | null, active: boolean, archived: boolean) =>
  canModerateActivity(role as 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | null, active, archived);
function encodeCursor(record: { createdAt: Date; _id: Types.ObjectId }) {
  return Buffer.from(`${record.createdAt.getTime()}:${record._id}`).toString('base64url');
}
function decodeCursor(value?: string) {
  if (!value) return null;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(value)) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  const raw = Buffer.from(value, 'base64url').toString('utf8');
  const match = /^(\d{13}):([0-9a-f]{24})$/.exec(raw);
  if (!match || Buffer.from(raw).toString('base64url') !== value)
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  return { createdAt: new Date(Number(match[1])), _id: oid(match[2]) };
}
function before(cursor: ReturnType<typeof decodeCursor>) {
  return cursor
    ? {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }
        ]
      }
    : {};
}
async function accessibleCommunity(communityId: string, userId: string) {
  const access = await resolveCommunityAccess(communityId, userId);
  if (access.community.visibility === 'PRIVATE' && !access.active) throw forbidden();
  return access;
}
async function getRecord(resourceId: string, userId: string, includeHidden = false) {
  const resource = await CommunityResource.findById(resourceId);
  if (!resource || resource.status === 'deleted') throw missing();
  const access = await accessibleCommunity(resource.communityId.toString(), userId);
  const manager = mayModerate(access.role, access.active, access.community.status === 'ARCHIVED');
  if (
    resource.status === 'hidden' &&
    !(includeHidden && (resource.createdBy.toString() === userId || manager))
  )
    throw missing();
  return { resource, access, manager };
}
async function dtos(
  records: HydratedDocument<CommunityResourceRecord>[],
  userId: string
): Promise<CommunityResourceDTO[]> {
  if (!records.length) return [];
  const communityIds = [...new Set(records.map((item) => item.communityId.toString()))].map(oid);
  const [communities, memberships, authors, files] = await Promise.all([
    Community.find({ _id: { $in: communityIds } })
      .select('name slug visibility status')
      .lean(),
    CommunityMembership.find({ communityId: { $in: communityIds }, userId, status: 'ACTIVE' })
      .select('communityId role')
      .lean(),
    safeAuthorsFor(records.map((item) => item.createdBy)),
    StoredFile.find({
      _id: { $in: records.map((item) => item.fileId) },
      status: 'attached',
      scanStatus: 'clean'
    })
      .select('safeFilename mimeType sizeBytes createdAt')
      .lean()
  ]);
  const byCommunity = new Map(communities.map((item) => [item._id.toString(), item]));
  const byMembership = new Map(memberships.map((item) => [item.communityId.toString(), item]));
  const byFile = new Map(files.map((item) => [item._id.toString(), item]));
  return records.flatMap((record) => {
    const community = byCommunity.get(record.communityId.toString());
    const membership = byMembership.get(record.communityId.toString());
    const uploader = authors.get(record.createdBy.toString());
    const file = byFile.get(record.fileId.toString());
    if (!community || !uploader || !file || (community.visibility === 'PRIVATE' && !membership)) return [];
    const manager = mayModerate(membership?.role ?? null, !!membership, community.status === 'ARCHIVED');
    const own = record.createdBy.toString() === userId;
    return [
      {
        id: record._id.toString(),
        activityId: record.activityId.toString(),
        community: { id: community._id.toString(), name: community.name, slug: community.slug },
        uploader,
        title: record.title,
        description: record.description,
        category: record.category,
        tags: record.tags,
        file: {
          id: file._id.toString(),
          safeFilename: file.safeFilename,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          uploadedAt: file.createdAt.toISOString(),
          previewAvailable: false
        },
        status: record.status,
        createdAt: record.createdAt.toISOString(),
        canEdit: community.status === 'ACTIVE' && (own || manager),
        canDelete: community.status === 'ACTIVE' && (own || manager),
        canModerate: manager,
        canReport: !!membership && !own && record.status === 'published'
      }
    ];
  });
}
export async function listCommunityResources(
  communityId: string,
  userId: string,
  query: ResourceQuery
): Promise<ResourcePage> {
  await accessibleCommunity(communityId, userId);
  const cursor = decodeCursor(query.cursor);
  const filter = {
    communityId: oid(communityId),
    status: 'published',
    ...(query.category ? { category: query.category } : {}),
    ...(query.tag ? { tags: query.tag } : {}),
    ...(query.search ? { $text: { $search: query.search } } : {}),
    ...before(cursor)
  };
  const records = await CommunityResource.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1);
  const visible = records.slice(0, query.limit);
  return {
    items: await dtos(visible, userId),
    hasMore: records.length > query.limit,
    nextCursor: records.length > query.limit ? encodeCursor(visible[visible.length - 1]) : null
  };
}
export async function listMyResources(userId: string, query: ResourceQuery): Promise<ResourcePage> {
  const memberships = await CommunityMembership.find({ userId, status: 'ACTIVE' })
    .select('communityId')
    .lean();
  const cursor = decodeCursor(query.cursor);
  const records = await CommunityResource.find({
    createdBy: oid(userId),
    communityId: { $in: memberships.map((item) => item.communityId) },
    status: { $ne: 'deleted' },
    ...(query.category ? { category: query.category } : {}),
    ...(query.tag ? { tags: query.tag } : {}),
    ...(query.search ? { $text: { $search: query.search } } : {}),
    ...before(cursor)
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1);
  const visible = records.slice(0, query.limit);
  return {
    items: await dtos(visible, userId),
    hasMore: records.length > query.limit,
    nextCursor: records.length > query.limit ? encodeCursor(visible[visible.length - 1]) : null
  };
}
export async function resourceDetail(resourceId: string, userId: string) {
  const { resource } = await getRecord(resourceId, userId, true);
  const [dto] = await dtos([resource], userId);
  if (!dto) throw missing();
  return dto;
}
export async function checkUploadAccess(communityId: string, userId: string) {
  const access = await accessibleCommunity(communityId, userId);
  if (!access.active || access.community.status !== 'ACTIVE') throw forbidden();
  throw storageUnavailable();
}
export async function checkDownloadAccess(resourceId: string, userId: string) {
  const { resource, access } = await getRecord(resourceId, userId);
  if (resource.status !== 'published' || !access.active) throw forbidden();
  const file = await StoredFile.findById(resource.fileId).select('status scanStatus').lean();
  if (!file || file.status !== 'attached' || file.scanStatus !== 'clean') throw missing();
  throw storageUnavailable();
}
function assertManagerOrOwner(record: { createdBy: Types.ObjectId }, userId: string, manager: boolean) {
  if (record.createdBy.toString() !== userId && !manager) throw forbidden();
}
export async function editResource(resourceId: string, userId: string, patch: ResourcePatch) {
  const { resource, access, manager } = await getRecord(resourceId, userId, true);
  assertManagerOrOwner(resource, userId, manager);
  if (access.community.status !== 'ACTIVE') throw forbidden();
  await withReplicaTransaction(async (session) => {
    const changed = await CommunityResource.updateOne(
      { _id: resourceId, status: { $ne: 'deleted' } },
      { $set: patch },
      { session, runValidators: true }
    );
    if (!changed.matchedCount) throw missing();
    const current = await CommunityResource.findById(resourceId).session(session);
    if (!current) throw missing();
    await CommunityActivity.updateOne(
      { _id: current.activityId, status: 'ACTIVE' },
      {
        $set: {
          payload: {
            title: current.title,
            description: current.description,
            category: current.category,
            tags: current.tags,
            fileId: current.fileId.toString()
          }
        }
      },
      { session }
    );
  });
  return resourceDetail(resourceId, userId);
}
export async function deleteResource(resourceId: string, userId: string) {
  const { resource, access, manager } = await getRecord(resourceId, userId, true);
  assertManagerOrOwner(resource, userId, manager);
  if (access.community.status !== 'ACTIVE') throw forbidden();
  await withReplicaTransaction(async (session) => {
    const changed = await CommunityResource.updateOne(
      { _id: resourceId, status: { $ne: 'deleted' } },
      { $set: { status: 'deleted', deletedAt: new Date() } },
      { session }
    );
    if (!changed.matchedCount) throw missing();
    await CommunityActivity.updateOne(
      { _id: resource.activityId },
      { $set: { status: 'DELETED', payload: null, deletedAt: new Date() } },
      { session, runValidators: false }
    );
    await StoredFile.updateOne({ _id: resource.fileId }, { $set: { status: 'deleted' } }, { session });
  });
}
function reportDto(record: {
  _id: Types.ObjectId;
  resourceId: Types.ObjectId;
  reason: ResourceReportDTO['reason'];
  description?: string;
  status: ResourceReportDTO['status'];
  createdAt: Date;
  reviewedAt?: Date;
}): ResourceReportDTO {
  return {
    id: record._id.toString(),
    resourceId: record.resourceId.toString(),
    reason: record.reason,
    description: record.description ?? null,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    reviewedAt: record.reviewedAt?.toISOString() ?? null
  };
}
export async function reportResource(resourceId: string, userId: string, input: ReportInput) {
  const { resource, access } = await getRecord(resourceId, userId);
  if (!access.active || resource.status !== 'published' || resource.createdBy.toString() === userId)
    throw forbidden();
  try {
    const report = await ResourceReport.create({
      communityId: resource.communityId,
      resourceId: resource._id,
      reportedBy: userId,
      ...input,
      status: 'pending'
    });
    return reportDto(report);
  } catch (error) {
    if (duplicate(error))
      throw new AppError(409, 'RESOURCE_ALREADY_REPORTED', 'You already reported this resource.');
    throw error;
  }
}
export async function listReports(
  communityId: string,
  userId: string,
  query: ReportQuery
): Promise<ResourceReportPage> {
  const access = await accessibleCommunity(communityId, userId);
  if (!mayModerate(access.role, access.active, access.community.status === 'ARCHIVED')) throw forbidden();
  const cursor = decodeCursor(query.cursor);
  const records = await ResourceReport.find({
    communityId: oid(communityId),
    status: query.status,
    ...before(cursor)
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1);
  const visible = records.slice(0, query.limit);
  return {
    items: visible.map(reportDto),
    hasMore: records.length > query.limit,
    nextCursor: records.length > query.limit ? encodeCursor(visible[visible.length - 1]) : null
  };
}
export async function reviewReport(reportId: string, userId: string, decision: 'hide' | 'dismiss') {
  const report = await ResourceReport.findById(reportId);
  if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.');
  const access = await accessibleCommunity(report.communityId.toString(), userId);
  if (!mayModerate(access.role, access.active, access.community.status === 'ARCHIVED')) throw forbidden();
  if (report.status !== 'pending')
    throw new AppError(409, 'REPORT_REVIEWED', 'This report was already reviewed.');
  await withReplicaTransaction(async (session) => {
    const changed = await ResourceReport.updateOne(
      { _id: reportId, status: 'pending' },
      {
        $set: {
          status: decision === 'hide' ? 'reviewed' : 'dismissed',
          reviewedBy: oid(userId),
          reviewedAt: new Date()
        }
      },
      { session }
    );
    if (!changed.matchedCount)
      throw new AppError(409, 'REPORT_REVIEWED', 'This report was already reviewed.');
    if (decision === 'hide')
      await CommunityResource.updateOne(
        { _id: report.resourceId, status: 'published' },
        { $set: { status: 'hidden' } },
        { session }
      );
  });
  const updated = await ResourceReport.findById(reportId);
  if (!updated) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.');
  return reportDto(updated);
}
