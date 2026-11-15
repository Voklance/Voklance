import type { CatalogItem } from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import { escapeRegex, toCatalogDto } from '../../../common/catalogDto.js';
import { runSelectionWrite } from '../../../common/selectionWrite.js';
import type { CatalogQuery } from '../../../common/validationSchemas.js';
import User from '../../users/model/User.js';
import Interest from '../model/Interest.js';
import UserInterest from '../model/UserInterest.js';

export async function listInterests(query: CatalogQuery) {
  const filter = {
    ...(query.search ? { name: { $regex: escapeRegex(query.search), $options: 'i' } } : {}),
    ...(query.category ? { category: { $regex: `^${escapeRegex(query.category)}$`, $options: 'i' } } : {})
  };
  const [records, total] = await Promise.all([
    Interest.find(filter)
      .sort({ name: 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Interest.countDocuments(filter)
  ]);
  return { items: records.map(toCatalogDto), page: query.page, limit: query.limit, total };
}

export async function getOwnInterests(userId: string): Promise<CatalogItem[]> {
  const assignments = await UserInterest.find({ userId }).select('interestId').limit(31).lean();
  const records = await Interest.find({ _id: { $in: assignments.map((item) => item.interestId) } })
    .sort({ name: 1, _id: 1 })
    .lean();
  return records.map(toCatalogDto);
}

export async function replaceOwnInterests(userId: string, interestIds: string[]): Promise<CatalogItem[]> {
  const count = await Interest.countDocuments({ _id: { $in: interestIds } });
  if (count !== interestIds.length)
    throw new AppError(400, 'UNKNOWN_INTEREST', 'One or more interests do not exist.');

  const user = await User.findById(userId).select('onboardingStatus').lean();
  if (user?.onboardingStatus === 'COMPLETED' && interestIds.length === 0)
    throw new AppError(409, 'ONBOARDING_REQUIRED_DATA', 'At least one interest is required.');

  await runSelectionWrite(async (session) => {
    const ownerId = new Types.ObjectId(userId);
    if (interestIds.length)
      await UserInterest.bulkWrite(
        interestIds.map((interestId) => ({
          updateOne: {
            filter: { userId: ownerId, interestId: new Types.ObjectId(interestId) },
            update: { $setOnInsert: { userId: ownerId, interestId: new Types.ObjectId(interestId) } },
            upsert: true
          }
        })),
        { session }
      );
    await UserInterest.deleteMany({ userId, interestId: { $nin: interestIds } }, { session });
  });
  return getOwnInterests(userId);
}
