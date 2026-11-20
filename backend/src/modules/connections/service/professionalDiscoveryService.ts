import type { NetworkPage, ProfessionalSummary } from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import Profile from '../../profiles/model/Profile.js';
import Skill from '../../skills/model/Skill.js';
import UserSkill from '../../skills/model/UserSkill.js';
import { summaries } from './connectionService.js';
import type { DiscoveryQuery } from '../validation/connectionSchemas.js';

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function discoverProfessionals(
  viewerId: string,
  query: DiscoveryQuery
): Promise<NetworkPage<ProfessionalSummary>> {
  if (query.cursor && !Types.ObjectId.isValid(query.cursor))
    throw new AppError(400, 'INVALID_CURSOR', 'Invalid page cursor.');
  let skillId: Types.ObjectId | undefined;
  if (query.skill) {
    const skill = await Skill.findOne({
      $or: [
        { slug: query.skill.toLowerCase() },
        { name: { $regex: `^${escape(query.skill)}$`, $options: 'i' } }
      ]
    })
      .select('_id')
      .lean();
    if (!skill) return { items: [], nextCursor: null, hasMore: false };
    skillId = skill._id;
  }
  const search = query.search?.trim();
  const location = query.location?.trim();
  const rows = await Profile.aggregate<{ _id: Types.ObjectId; userId: Types.ObjectId }>([
    {
      $match: {
        visibility: 'PUBLIC',
        profileDiscoverable: { $ne: false },
        userId: { $ne: new Types.ObjectId(viewerId) },
        ...(query.cursor ? { _id: { $lt: new Types.ObjectId(query.cursor) } } : {}),
        ...(search || location
          ? {
              $and: [
                ...(search
                  ? [
                      {
                        $or: [
                          { fullName: { $regex: escape(search), $options: 'i' } },
                          { headline: { $regex: escape(search), $options: 'i' } }
                        ]
                      }
                    ]
                  : []),
                ...(location
                  ? [
                      {
                        $or: [
                          { city: { $regex: escape(location), $options: 'i' } },
                          { country: { $regex: escape(location), $options: 'i' } }
                        ]
                      }
                    ]
                  : [])
              ]
            }
          : {})
      }
    },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'owner' } },
    {
      $match: {
        owner: {
          $elemMatch: {
            onboardingStatus: 'COMPLETED',
            $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }]
          }
        }
      }
    },
    ...(skillId
      ? [
          {
            $lookup: {
              from: 'user_skills',
              localField: 'userId',
              foreignField: 'userId',
              as: 'assignedSkills'
            }
          },
          { $match: { 'assignedSkills.skillId': skillId } }
        ]
      : []),
    { $sort: { _id: -1 } },
    { $limit: query.limit + 1 },
    { $project: { userId: 1 } }
  ]);
  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const ids = page.map((row) => row.userId.toString());
  const [people, assignments] = await Promise.all([
    summaries(viewerId, ids),
    UserSkill.find({ userId: { $in: ids } })
      .select('userId skillId')
      .lean()
  ]);
  const skills = await Skill.find({ _id: { $in: assignments.map((item) => item.skillId) } })
    .select('name')
    .lean();
  const skillNames = new Map(skills.map((item) => [item._id.toString(), item.name]));
  const byUser = new Map<string, string[]>();
  for (const item of assignments) {
    const userId = item.userId.toString();
    const name = skillNames.get(item.skillId.toString());
    if (name) byUser.set(userId, [...(byUser.get(userId) ?? []), name]);
  }
  const items = ids.flatMap((id) => {
    const person = people.get(id);
    return person ? [{ ...person, skills: (byUser.get(id) ?? []).sort() }] : [];
  });
  return { items, hasMore, nextCursor: hasMore && page.length ? page[page.length - 1]._id.toString() : null };
}
