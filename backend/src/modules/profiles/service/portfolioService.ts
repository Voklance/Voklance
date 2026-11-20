import type { ProfileCertification, ProfileProject } from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import Profile from '../model/Profile.js';
import CertificationModel, { type ProfileCertificationRecord } from '../model/ProfileCertification.js';
import ProjectModel, { type ProfileProjectRecord } from '../model/ProfileProject.js';
import { certificationBody, projectBody } from '../validation/portfolioSchemas.js';
import type { z } from 'zod';

const oid = (value: string) => new Types.ObjectId(value);
const certDto = (row: ProfileCertificationRecord & { _id: Types.ObjectId }): ProfileCertification => ({
  id: row._id.toString(),
  name: row.name,
  issuingOrganization: row.issuingOrganization,
  issueDate: row.issueDate.toISOString().slice(0, 10),
  expirationDate: row.expirationDate?.toISOString().slice(0, 10) ?? null,
  credentialId: row.credentialId ?? null,
  credentialUrl: row.credentialUrl ?? null
});
const projectDto = (row: ProfileProjectRecord & { _id: Types.ObjectId }): ProfileProject => ({
  id: row._id.toString(),
  title: row.title,
  description: row.description,
  role: row.role,
  technologies: row.technologies,
  projectUrl: row.projectUrl ?? null,
  repositoryUrl: row.repositoryUrl ?? null,
  startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
  endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
  isOngoing: row.isOngoing,
  isFeatured: row.isFeatured,
  displayOrder: row.displayOrder
});
async function requireProfile(userId: string) {
  if (!(await Profile.exists({ userId: oid(userId) })))
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Create your profile first.');
}
export async function listCertifications(userId: string) {
  return (
    await CertificationModel.find({ userId: oid(userId) })
      .sort({ issueDate: -1, _id: -1 })
      .limit(50)
      .lean()
  ).map(certDto);
}
export async function createCertification(userId: string, input: z.infer<typeof certificationBody>) {
  await requireProfile(userId);
  if ((await CertificationModel.countDocuments({ userId: oid(userId) })) >= 50)
    throw new AppError(409, 'CERTIFICATION_LIMIT', 'Certification limit reached.');
  return certDto(await CertificationModel.create({ userId: oid(userId), ...input }));
}
export async function updateCertification(
  userId: string,
  recordId: string,
  patch: Partial<z.infer<typeof certificationBody>>
) {
  const row = await CertificationModel.findOne({ _id: oid(recordId), userId: oid(userId) });
  if (!row) throw new AppError(404, 'CERTIFICATION_NOT_FOUND', 'Certification unavailable.');
  const parsed = certificationBody.safeParse({
    name: patch.name ?? row.name,
    issuingOrganization: patch.issuingOrganization ?? row.issuingOrganization,
    issueDate: patch.issueDate ?? row.issueDate.toISOString().slice(0, 10),
    expirationDate:
      patch.expirationDate === undefined
        ? (row.expirationDate?.toISOString().slice(0, 10) ?? null)
        : patch.expirationDate,
    credentialId: patch.credentialId === undefined ? (row.credentialId ?? null) : patch.credentialId,
    credentialUrl: patch.credentialUrl === undefined ? (row.credentialUrl ?? null) : patch.credentialUrl
  });
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid certification dates or fields.');
  Object.assign(row, parsed.data);
  await row.save();
  return certDto(row);
}
export async function deleteCertification(userId: string, recordId: string) {
  const row = await CertificationModel.findOneAndDelete({ _id: oid(recordId), userId: oid(userId) });
  if (!row) throw new AppError(404, 'CERTIFICATION_NOT_FOUND', 'Certification unavailable.');
  return { deleted: true };
}
export async function listProjects(userId: string) {
  return (
    await ProjectModel.find({ userId: oid(userId) })
      .sort({ isFeatured: -1, displayOrder: 1, _id: -1 })
      .limit(50)
      .lean()
  ).map(projectDto);
}
export async function createProject(userId: string, input: z.infer<typeof projectBody>) {
  await requireProfile(userId);
  if ((await ProjectModel.countDocuments({ userId: oid(userId) })) >= 50)
    throw new AppError(409, 'PROJECT_LIMIT', 'Project limit reached.');
  if (input.isFeatured && (await ProjectModel.countDocuments({ userId: oid(userId), isFeatured: true })) >= 4)
    throw new AppError(409, 'FEATURED_LIMIT', 'You can feature up to four projects.');
  return projectDto(await ProjectModel.create({ userId: oid(userId), ...input }));
}
export async function updateProject(
  userId: string,
  recordId: string,
  patch: Partial<z.infer<typeof projectBody>>
) {
  const row = await ProjectModel.findOne({ _id: oid(recordId), userId: oid(userId) });
  if (!row) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project unavailable.');
  const parsed = projectBody.safeParse({
    title: patch.title ?? row.title,
    description: patch.description ?? row.description,
    role: patch.role ?? row.role,
    technologies: patch.technologies ?? row.technologies,
    projectUrl: patch.projectUrl === undefined ? (row.projectUrl ?? null) : patch.projectUrl,
    repositoryUrl: patch.repositoryUrl === undefined ? (row.repositoryUrl ?? null) : patch.repositoryUrl,
    startDate:
      patch.startDate === undefined ? (row.startDate?.toISOString().slice(0, 10) ?? null) : patch.startDate,
    endDate: patch.endDate === undefined ? (row.endDate?.toISOString().slice(0, 10) ?? null) : patch.endDate,
    isOngoing: patch.isOngoing ?? row.isOngoing,
    isFeatured: patch.isFeatured ?? row.isFeatured,
    displayOrder: patch.displayOrder ?? row.displayOrder
  });
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid project dates or fields.');
  const valid = parsed.data;
  if (
    valid.isFeatured &&
    !row.isFeatured &&
    (await ProjectModel.countDocuments({ userId: oid(userId), isFeatured: true })) >= 4
  )
    throw new AppError(409, 'FEATURED_LIMIT', 'You can feature up to four projects.');
  Object.assign(row, valid);
  await row.save();
  return projectDto(row);
}
export async function deleteProject(userId: string, recordId: string) {
  const row = await ProjectModel.findOneAndDelete({ _id: oid(recordId), userId: oid(userId) });
  if (!row) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project unavailable.');
  return { deleted: true };
}
