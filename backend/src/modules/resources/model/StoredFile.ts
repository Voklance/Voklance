import mongoose, { Schema, type Types } from 'mongoose';

export interface StoredFileRecord {
  uploadedBy: Types.ObjectId;
  storageProvider: string;
  storageKey: string;
  originalFilename: string;
  safeFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  scanStatus: 'pending' | 'clean' | 'rejected';
  status: 'uploaded' | 'attached' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<StoredFileRecord>(
  {
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    storageProvider: { type: String, required: true, trim: true },
    storageKey: { type: String, required: true, select: false },
    originalFilename: { type: String, required: true, select: false },
    safeFilename: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
    checksum: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    scanStatus: { type: String, enum: ['pending', 'clean', 'rejected'], default: 'pending', required: true },
    status: { type: String, enum: ['uploaded', 'attached', 'deleted'], default: 'uploaded', required: true }
  },
  { timestamps: true }
);
schema.index({ storageKey: 1 }, { unique: true });
schema.index({ uploadedBy: 1, status: 1, createdAt: -1 });
export default mongoose.model<StoredFileRecord>('StoredFile', schema);
