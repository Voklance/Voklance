import { Types } from 'mongoose';
import PostBookmark from '../../posts/model/PostBookmark.js';
import Bookmark from '../model/Bookmark.js';

/** Move existing post saves on first use, preserving their original save date. */
export async function migrateLegacyPostBookmarks(userId: string) {
  const legacy = await PostBookmark.find({ userId: new Types.ObjectId(userId) })
    .select('postId createdAt')
    .lean();
  if (!legacy.length) return;
  try {
    await Bookmark.bulkWrite(
      legacy.map((row) => ({
        updateOne: {
          filter: { userId: new Types.ObjectId(userId), entityType: 'post' as const, entityId: row.postId },
          update: {
            $setOnInsert: {
              userId: new Types.ObjectId(userId),
              entityType: 'post' as const,
              entityId: row.postId,
              createdAt: row.createdAt,
              updatedAt: row.createdAt
            }
          },
          upsert: true
        }
      })),
      { ordered: false, timestamps: false }
    );
  } catch (error) {
    const failures = error && typeof error === 'object' && 'writeErrors' in error ? error.writeErrors : null;
    if (!Array.isArray(failures) || !failures.length || failures.some((failure) => failure.code !== 11000))
      throw error;
  }
  await PostBookmark.deleteMany({
    userId: new Types.ObjectId(userId),
    _id: { $in: legacy.map((row) => row._id) }
  });
}
