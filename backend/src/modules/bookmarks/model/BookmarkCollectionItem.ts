import mongoose, { Schema, type Types } from 'mongoose';
export interface BookmarkCollectionItemRecord {
  userId: Types.ObjectId;
  collectionId: Types.ObjectId;
  bookmarkId: Types.ObjectId;
  createdAt: Date;
}
const schema = new Schema<BookmarkCollectionItemRecord>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  collectionId: { type: Schema.Types.ObjectId, ref: 'BookmarkCollection', required: true },
  bookmarkId: { type: Schema.Types.ObjectId, ref: 'Bookmark', required: true },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ collectionId: 1, bookmarkId: 1 }, { unique: true });
schema.index({ userId: 1, bookmarkId: 1 });
export default mongoose.model<BookmarkCollectionItemRecord>('BookmarkCollectionItem', schema);
