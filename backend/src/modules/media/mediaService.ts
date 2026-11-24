import { createReadStream } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import formidable, { type File } from 'formidable';
import mongoose, { Types } from 'mongoose';
import type { Request } from 'express';
import { AppError } from '../../common/AppError.js';
import Post from '../posts/model/Post.js';
import Profile from '../profiles/model/Profile.js';
import User from '../users/model/User.js';

const bucketName = 'voklance_media';
const imageLimit = 8 * 1024 * 1024;
const documentLimit = 15 * 1024 * 1024;
export type MediaKind = 'image' | 'document';
export interface StoredMedia {
  fileId: string;
  kind: MediaKind;
  mimeType: string;
  filename: string;
  size: number;
}

function bucket() {
  if (!mongoose.connection.db) throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Database unavailable.');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });
}

function mediaType(header: Buffer): { kind: MediaKind; mimeType: string; extension: string } | null {
  if (header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return { kind: 'image', mimeType: 'image/jpeg', extension: 'jpg' };
  if (header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return { kind: 'image', mimeType: 'image/png', extension: 'png' };
  if (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP')
    return { kind: 'image', mimeType: 'image/webp', extension: 'webp' };
  if (header.toString('ascii', 0, 5) === '%PDF-')
    return { kind: 'document', mimeType: 'application/pdf', extension: 'pdf' };
  return null;
}

export async function parseMediaForm(request: Request): Promise<{ content: string; file: File | null }> {
  if (!request.is('multipart/form-data'))
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Choose a photo or PDF file.');
  const temporaryFiles: File[] = [];
  try {
    const form = formidable({
      maxFiles: 1,
      maxFileSize: documentLimit,
      maxTotalFileSize: documentLimit,
      maxFields: 2,
      maxFieldsSize: 32 * 1024,
      allowEmptyFiles: false
    });
    form.on('fileBegin', (_name, file) => temporaryFiles.push(file));
    const [fields, files] = await form.parse(request);
    if (
      Object.keys(fields).some((key) => key !== 'content') ||
      Object.keys(files).some((key) => key !== 'file')
    ) {
      throw new AppError(400, 'INVALID_UPLOAD', 'Only a post caption and one file are allowed.');
    }
    const file = files.file?.[0] ?? null;
    return { content: fields.content?.[0]?.trim() ?? '', file };
  } catch (error) {
    await Promise.all(temporaryFiles.map(removeTempFile));
    if (error instanceof AppError) throw error;
    const status = typeof error === 'object' && error && 'httpCode' in error ? Number(error.httpCode) : 400;
    throw new AppError(
      status === 413 ? 413 : 400,
      'INVALID_UPLOAD',
      status === 413 ? 'File is too large.' : 'Could not read the selected file.'
    );
  }
}

export async function saveMedia(
  file: File,
  ownerId: string,
  expected: MediaKind | 'post' | 'cover'
): Promise<StoredMedia> {
  const handle = await open(file.filepath, 'r');
  const header = Buffer.alloc(16);
  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }
  const detected = mediaType(header);
  if (!detected || (expected !== 'post' && detected.kind !== (expected === 'cover' ? 'image' : expected)))
    throw new AppError(
      400,
      'INVALID_FILE_TYPE',
      expected === 'image' || expected === 'cover'
        ? 'Use a JPEG, PNG, or WebP image.'
        : 'Use a JPEG, PNG, WebP, or PDF file.'
    );
  if (file.size > (detected.kind === 'image' ? imageLimit : documentLimit))
    throw new AppError(
      413,
      'FILE_TOO_LARGE',
      detected.kind === 'image' ? 'Images must be 8 MB or smaller.' : 'PDFs must be 15 MB or smaller.'
    );
  const original = [...basename(file.originalFilename || `upload.${detected.extension}`)]
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join('')
    .slice(0, 120);
  const stem = (original.replace(/\.[^.]+$/, '') || 'upload').slice(0, 110);
  const name = `${stem}.${detected.extension}`;
  const upload = bucket().openUploadStream(name, {
    contentType: detected.mimeType,
    metadata: { ownerId, kind: expected === 'post' ? 'post' : expected === 'cover' ? 'cover' : 'avatar' }
  });
  try {
    await pipeline(createReadStream(file.filepath), upload);
  } catch (error) {
    await bucket()
      .delete(upload.id)
      .catch(() => undefined);
    throw error;
  }
  return {
    fileId: upload.id.toString(),
    kind: detected.kind,
    mimeType: detected.mimeType,
    filename: name,
    size: file.size
  };
}

export async function removeTempFile(file: File | null) {
  if (file) await unlink(file.filepath).catch(() => undefined);
}

export async function deleteMedia(fileId: string) {
  if (Types.ObjectId.isValid(fileId))
    await bucket()
      .delete(new Types.ObjectId(fileId))
      .catch(() => undefined);
}

export async function readableMedia(fileId: string, viewerId?: string) {
  if (!/^[0-9a-f]{24}$/i.test(fileId)) throw new AppError(404, 'MEDIA_NOT_FOUND', 'File not found.');
  const db = mongoose.connection.db;
  if (!db) throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Database unavailable.');
  const file = await db.collection(`${bucketName}.files`).findOne({ _id: new Types.ObjectId(fileId) });
  if (!file) throw new AppError(404, 'MEDIA_NOT_FOUND', 'File not found.');
  const avatarUrl = `/api/v1/media/${fileId}`;
  const profile = await Profile.findOne({ $or: [{ avatarUrl }, { coverUrl: avatarUrl }] })
    .select('userId visibility')
    .lean();
  let allowed = false;
  if (profile) {
    if (profile.userId.toString() === viewerId) allowed = true;
    else if (profile.visibility === 'PUBLIC') {
      allowed = Boolean(
        await User.exists({
          _id: profile.userId,
          accountStatus: { $in: ['ACTIVE', null] },
          onboardingStatus: 'COMPLETED'
        })
      );
    }
  } else if (viewerId) {
    const post = await Post.findOne({ 'attachment.fileId': fileId, status: 'PUBLISHED' })
      .select('authorId')
      .lean();
    if (post)
      allowed = Boolean(
        await User.exists({
          _id: post.authorId,
          accountStatus: { $in: ['ACTIVE', null] },
          onboardingStatus: 'COMPLETED'
        })
      );
  }
  if (!allowed) throw new AppError(404, 'MEDIA_NOT_FOUND', 'File not found.');
  return { file, stream: bucket().openDownloadStream(new Types.ObjectId(fileId)) };
}
