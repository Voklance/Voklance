import type { Education as EducationDto, ProfessionalExperience as ExperienceDto } from '@voklance/shared';
import type { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import Education, { type EducationRecord } from '../model/Education.js';
import ProfessionalExperience, {
  type ProfessionalExperienceRecord
} from '../model/ProfessionalExperience.js';
import {
  educationSchema,
  experienceSchema,
  type EducationInput,
  type EducationPatchInput,
  type ExperienceInput,
  type ExperiencePatchInput
} from '../validation/historySchemas.js';

const maxHistoryRecords = 50;

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function toExperienceDto(
  record: ProfessionalExperienceRecord & { _id: Types.ObjectId }
): ExperienceDto {
  return {
    id: record._id.toString(),
    jobTitle: record.jobTitle,
    companyName: record.companyName,
    ...(record.employmentType ? { employmentType: record.employmentType } : {}),
    startDate: dateOnly(record.startDate),
    ...(record.endDate ? { endDate: dateOnly(record.endDate) } : {}),
    isCurrent: record.isCurrent,
    ...(record.description ? { description: record.description } : {})
  };
}

export function toEducationDto(record: EducationRecord & { _id: Types.ObjectId }): EducationDto {
  return {
    id: record._id.toString(),
    institution: record.institution,
    ...(record.degree ? { degree: record.degree } : {}),
    ...(record.fieldOfStudy ? { fieldOfStudy: record.fieldOfStudy } : {}),
    startDate: dateOnly(record.startDate),
    ...(record.endDate ? { endDate: dateOnly(record.endDate) } : {})
  };
}

export async function getOwnExperiences(userId: string): Promise<ExperienceDto[]> {
  const records = await ProfessionalExperience.find({ userId })
    .sort({ startDate: -1, _id: 1 })
    .limit(maxHistoryRecords)
    .lean();
  return records.map(toExperienceDto);
}

export async function createExperience(userId: string, input: ExperienceInput): Promise<ExperienceDto> {
  if ((await ProfessionalExperience.countDocuments({ userId })) >= maxHistoryRecords)
    throw new AppError(409, 'HISTORY_LIMIT', 'Experience record limit reached.');
  const record = await ProfessionalExperience.create({
    userId,
    ...input,
    endDate: input.endDate ? new Date(input.endDate) : undefined
  });
  return toExperienceDto(record);
}

export async function updateExperience(
  userId: string,
  id: string,
  input: ExperiencePatchInput
): Promise<ExperienceDto> {
  const record = await ProfessionalExperience.findOne({ _id: id, userId });
  if (!record) throw new AppError(404, 'EXPERIENCE_NOT_FOUND', 'Experience not found.');
  const merged = {
    jobTitle: record.jobTitle,
    companyName: record.companyName,
    employmentType: record.employmentType,
    startDate: dateOnly(record.startDate),
    endDate: record.endDate ? dateOnly(record.endDate) : undefined,
    isCurrent: record.isCurrent,
    description: record.description,
    ...input
  };
  if (input.isCurrent === true && input.endDate === undefined) merged.endDate = null;
  const valid = experienceSchema.safeParse(merged);
  if (!valid.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid experience dates or fields.');
  record.set({
    ...valid.data,
    startDate: new Date(valid.data.startDate),
    endDate: valid.data.endDate ? new Date(valid.data.endDate) : undefined
  });
  await record.save();
  return toExperienceDto(record);
}

export async function deleteExperience(userId: string, id: string) {
  const deleted = await ProfessionalExperience.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new AppError(404, 'EXPERIENCE_NOT_FOUND', 'Experience not found.');
}

export async function getOwnEducations(userId: string): Promise<EducationDto[]> {
  const records = await Education.find({ userId })
    .sort({ startDate: -1, _id: 1 })
    .limit(maxHistoryRecords)
    .lean();
  return records.map(toEducationDto);
}

export async function createEducation(userId: string, input: EducationInput): Promise<EducationDto> {
  if ((await Education.countDocuments({ userId })) >= maxHistoryRecords)
    throw new AppError(409, 'HISTORY_LIMIT', 'Education record limit reached.');
  const record = await Education.create({
    userId,
    ...input,
    endDate: input.endDate ? new Date(input.endDate) : undefined
  });
  return toEducationDto(record);
}

export async function updateEducation(
  userId: string,
  id: string,
  input: EducationPatchInput
): Promise<EducationDto> {
  const record = await Education.findOne({ _id: id, userId });
  if (!record) throw new AppError(404, 'EDUCATION_NOT_FOUND', 'Education not found.');
  const merged = {
    institution: record.institution,
    degree: record.degree,
    fieldOfStudy: record.fieldOfStudy,
    startDate: dateOnly(record.startDate),
    endDate: record.endDate ? dateOnly(record.endDate) : undefined,
    ...input
  };
  const valid = educationSchema.safeParse(merged);
  if (!valid.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid education dates or fields.');
  record.set({
    ...valid.data,
    startDate: new Date(valid.data.startDate),
    endDate: valid.data.endDate ? new Date(valid.data.endDate) : undefined
  });
  await record.save();
  return toEducationDto(record);
}

export async function deleteEducation(userId: string, id: string) {
  const deleted = await Education.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new AppError(404, 'EDUCATION_NOT_FOUND', 'Education not found.');
}
