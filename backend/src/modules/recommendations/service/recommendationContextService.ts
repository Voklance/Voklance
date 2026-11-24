import { Types } from 'mongoose';
import Connection from '../../connections/model/Connection.js';
import Interest from '../../interests/model/Interest.js';
import UserInterest from '../../interests/model/UserInterest.js';
import CommunityMembership from '../../memberships/model/CommunityMembership.js';
import UserBlock from '../../messaging/model/UserBlock.js';
import Skill from '../../skills/model/Skill.js';
import UserSkill from '../../skills/model/UserSkill.js';
import UserFeedPreference from '../model/UserFeedPreference.js';
import PostFollow from '../../posts/model/PostFollow.js';

export interface RecommendationContext {
  topics: string[];
  connectionIds: Set<string>;
  followedUserIds: Set<string>;
  communityIds: Set<string>;
  excludedUserIds: Set<string>;
}
export async function recommendationContext(userId: string): Promise<RecommendationContext> {
  const id = new Types.ObjectId(userId);
  const [preference, interests, skills, connections, follows, memberships, blocks] = await Promise.all([
    UserFeedPreference.findOne({ userId: id }).select('topics').lean(),
    UserInterest.find({ userId: id }).select('interestId').limit(30).lean(),
    UserSkill.find({ userId: id }).select('skillId').limit(30).lean(),
    Connection.find({ status: 'accepted', $or: [{ userLowId: id }, { userHighId: id }] })
      .select('userLowId userHighId')
      .limit(500)
      .lean(),
    PostFollow.find({ followerId: id }).select('followeeId').limit(500).lean(),
    CommunityMembership.find({ userId: id, status: 'ACTIVE' }).select('communityId').limit(500).lean(),
    UserBlock.find({ $or: [{ blockerId: id }, { blockedId: id }] })
      .select('blockerId blockedId')
      .limit(500)
      .lean()
  ]);
  const [interestNames, skillNames] = await Promise.all([
    Interest.find({ _id: { $in: interests.map((row) => row.interestId) } })
      .select('name')
      .lean(),
    Skill.find({ _id: { $in: skills.map((row) => row.skillId) } })
      .select('name')
      .lean()
  ]);
  const topics = [
    ...new Set(
      [
        ...(preference?.topics ?? []),
        ...interestNames.map((row) => row.name),
        ...skillNames.map((row) => row.name)
      ].map((value) => value.toLocaleLowerCase())
    )
  ].slice(0, 36);
  return {
    topics,
    connectionIds: new Set(
      connections.map((row) =>
        row.userLowId.toString() === userId ? row.userHighId.toString() : row.userLowId.toString()
      )
    ),
    followedUserIds: new Set(follows.map((row) => row.followeeId.toString())),
    communityIds: new Set(memberships.map((row) => row.communityId.toString())),
    excludedUserIds: new Set(
      blocks.map((row) =>
        row.blockerId.toString() === userId ? row.blockedId.toString() : row.blockerId.toString()
      )
    )
  };
}
