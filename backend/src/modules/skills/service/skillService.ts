import type { CatalogItem } from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import { escapeRegex, toCatalogDto } from '../../../common/catalogDto.js';
import { runSelectionWrite } from '../../../common/selectionWrite.js';
import type { CatalogQuery } from '../../../common/validationSchemas.js';
import User from '../../users/model/User.js';
import Skill from '../model/Skill.js';
import UserSkill from '../model/UserSkill.js';

export async function listSkills(query: CatalogQuery) {
  const filter = {
    ...(query.search ? { name: { $regex: escapeRegex(query.search), $options: 'i' } } : {}),
    ...(query.category ? { category: { $regex: `^${escapeRegex(query.category)}$`, $options: 'i' } } : {})
  };
  const [records, total] = await Promise.all([
    Skill.find(filter)
      .sort({ name: 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Skill.countDocuments(filter)
  ]);
  return { items: records.map(toCatalogDto), page: query.page, limit: query.limit, total };
}

export async function getOwnSkills(userId: string): Promise<CatalogItem[]> {
  const assignments = await UserSkill.find({ userId }).select('skillId').limit(31).lean();
  const records = await Skill.find({ _id: { $in: assignments.map((item) => item.skillId) } })
    .sort({ name: 1, _id: 1 })
    .lean();
  return records.map(toCatalogDto);
}

export async function replaceOwnSkills(userId: string, skillIds: string[]): Promise<CatalogItem[]> {
  const count = await Skill.countDocuments({ _id: { $in: skillIds } });
  if (count !== skillIds.length) throw new AppError(400, 'UNKNOWN_SKILL', 'One or more skills do not exist.');

  const user = await User.findById(userId).select('onboardingStatus').lean();
  if (user?.onboardingStatus === 'COMPLETED' && skillIds.length === 0)
    throw new AppError(409, 'ONBOARDING_REQUIRED_DATA', 'At least one skill is required.');

  await runSelectionWrite(async (session) => {
    const ownerId = new Types.ObjectId(userId);
    if (skillIds.length)
      await UserSkill.bulkWrite(
        skillIds.map((skillId) => ({
          updateOne: {
            filter: { userId: ownerId, skillId: new Types.ObjectId(skillId) },
            update: { $setOnInsert: { userId: ownerId, skillId: new Types.ObjectId(skillId) } },
            upsert: true
          }
        })),
        { session }
      );
    await UserSkill.deleteMany({ userId, skillId: { $nin: skillIds } }, { session });
  });
  return getOwnSkills(userId);
}
