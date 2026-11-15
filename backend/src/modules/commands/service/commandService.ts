import { Types } from 'mongoose';
import { referralPayloadSchema } from '@voklance/shared';
import type {
  ActivityPage,
  CommandMetadata,
  CommunityActivity,
  CommandPayload,
  PostAuthor
} from '@voklance/shared';
import { AppError } from '../../../common/AppError.js';
import { resolveCommunityAccess } from '../../communities/service/communityService.js';
import { canCreateCommand, canModerateActivity } from '../../communities/service/communityPermissions.js';
import Profile from '../../profiles/model/Profile.js';
import User from '../../users/model/User.js';
import ReferralApplication from '../../referrals/model/ReferralApplication.js';
import ReferralOffer from '../../referrals/model/ReferralOffer.js';
import CommunityActivityModel, { type CommunityActivityRecord } from '../model/CommunityActivity.js';
import { commandDefinitions, findCommand, metadataFor } from '../registry/commandRegistry.js';
import type { ActivityQuery, SubmissionInput } from '../validation/commandSchemas.js';

type ActivityRecord = CommunityActivityRecord & { _id: Types.ObjectId };
const id = (value: Types.ObjectId | string) => value.toString();
const denied = () => new AppError(403, 'COMMAND_FORBIDDEN', 'This community action is unavailable to you.');
function encodeCursor(record: { createdAt: Date; _id: Types.ObjectId }) {
  return Buffer.from(`${record.createdAt.getTime()}:${id(record._id)}`).toString('base64url');
}
function decodeCursor(value?: string) {
  if (!value) return null;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(value)) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  const raw = Buffer.from(value, 'base64url').toString('utf8');
  const match = /^(\d{13}):([0-9a-f]{24})$/.exec(raw);
  if (!match || Buffer.from(raw).toString('base64url') !== value)
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  const date = new Date(Number(match[1]));
  if (!Number.isFinite(date.getTime())) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  return { createdAt: date, _id: new Types.ObjectId(match[2]) };
}
function beforeCursor(cursor: ReturnType<typeof decodeCursor>) {
  return cursor
    ? {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }
        ]
      }
    : {};
}
export async function safeAuthorsFor(ids: Types.ObjectId[]) {
  const unique = [...new Set(ids.map(id))];
  const [users, profiles] = await Promise.all([
    User.find({
      _id: { $in: unique },
      accountStatus: { $in: ['ACTIVE', null] },
      onboardingStatus: 'COMPLETED'
    })
      .select('name')
      .lean(),
    Profile.find({ userId: { $in: unique }, visibility: 'PUBLIC' })
      .select('userId username fullName headline')
      .lean()
  ]);
  const profilesByUser = new Map(profiles.map((profile) => [id(profile.userId), profile]));
  return new Map(
    users.map((user) => {
      const profile = profilesByUser.get(id(user._id));
      const author: PostAuthor = {
        name: profile?.fullName ?? user.name,
        username: profile?.username ?? null,
        headline: profile?.headline ?? null
      };
      return [id(user._id), author];
    })
  );
}
export async function activityDtos(records: ActivityRecord[], viewerId: string, canModerate: boolean) {
  const authors = await safeAuthorsFor(records.map((record) => record.authorId));
  return records.flatMap((record) => {
    const definition = findCommand(record.commandType);
    const author = authors.get(id(record.authorId));
    const parsed = definition?.schema.safeParse(record.payload);
    if (!definition || !author || !parsed?.success || record.payloadVersion !== definition.payloadVersion)
      return [];
    return [
      {
        id: id(record._id),
        communityId: id(record.communityId),
        author,
        command: record.commandType,
        commandLabel: definition.label,
        payloadVersion: 1 as const,
        payload: parsed.data as CommandPayload,
        createdAt: record.createdAt.toISOString(),
        ownedByMe: id(record.authorId) === viewerId,
        canDelete: canModerate || id(record.authorId) === viewerId,
        referralStatus: record.commandType === 'referral'
          ? (record.referralStatus === 'CLOSED' ? 'CLOSED' :
              record.payload && 'expiresAt' in record.payload && record.payload.expiresAt && Date.parse(record.payload.expiresAt) <= Date.now() ? 'EXPIRED' : 'OPEN')
          : record.commandType === 'needreferral'
            ? (record.referralStatus ?? 'OPEN')
            : undefined
      } as CommunityActivity
    ];
  });
}

export async function availableCommands(communityId: string, userId: string): Promise<CommandMetadata[]> {
  const access = await resolveCommunityAccess(communityId, userId);
  if (!access.active || !access.role) throw denied();
  return commandDefinitions
    .filter(
      (definition) =>
        definition.enabled &&
        canCreateCommand(
          access.role,
          access.active,
          access.community.status === 'ARCHIVED',
          definition.requiredPermission
        )
    )
    .map(metadataFor);
}

export async function submitCommand(
  communityId: string,
  userId: string,
  input: SubmissionInput
): Promise<CommunityActivity> {
  const access = await resolveCommunityAccess(communityId, userId);
  if (!access.active || !access.role) throw denied();
  if (access.community.status !== 'ACTIVE')
    throw new AppError(409, 'COMMUNITY_ARCHIVED', 'Archived communities cannot accept actions.');
  const definition = findCommand(input.command);
  if (!definition) throw new AppError(400, 'COMMAND_UNKNOWN', 'Unknown community command.');
  if (!definition.enabled) throw new AppError(403, 'COMMAND_DISABLED', 'This command is unavailable.');
  if (!canCreateCommand(access.role, access.active, false, definition.requiredPermission)) throw denied();
  if (input.payloadVersion !== definition.payloadVersion)
    throw new AppError(400, 'COMMAND_VERSION_UNSUPPORTED', 'Unsupported command payload version.');
  const parsed = definition.schema.safeParse(input.payload);
  if (!parsed.success)
    throw new AppError(400, 'COMMAND_PAYLOAD_INVALID', 'Check the fields for this command.');
  if (definition.id === 'referral') {
    const expiresAt = referralPayloadSchema.parse(parsed.data).expiresAt;
    if (expiresAt && Date.parse(expiresAt) <= Date.now())
      throw new AppError(400, 'COMMAND_PAYLOAD_INVALID', 'Expiration must be in the future.');
  }
  const record = await CommunityActivityModel.create({
    communityId,
    authorId: userId,
    commandType: definition.id,
    payloadVersion: definition.payloadVersion,
    payload: parsed.data,
    status: 'ACTIVE'
  });
  const [activity] = await activityDtos(
    [record],
    userId,
    canModerateActivity(access.role, access.active, false)
  );
  return activity;
}

export async function listActivities(
  communityId: string,
  userId: string,
  query: ActivityQuery
): Promise<ActivityPage> {
  const access = await resolveCommunityAccess(communityId, userId);
  if (access.community.visibility === 'PRIVATE' && !access.active) throw denied();
  const cursor = decodeCursor(query.cursor);
  const filter = {
    communityId: new Types.ObjectId(communityId),
    status: 'ACTIVE',
    ...(query.command ? { commandType: query.command } : {}),
    ...beforeCursor(cursor)
  };
  const records = await CommunityActivityModel.aggregate<ActivityRecord>([
    { $match: filter },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'authorId',
        foreignField: '_id',
        pipeline: [
          { $match: { accountStatus: { $in: ['ACTIVE', null] }, onboardingStatus: 'COMPLETED' } },
          { $project: { _id: 1 } }
        ],
        as: 'availableAuthor'
      }
    },
    { $match: { 'availableAuthor.0': { $exists: true } } },
    { $limit: query.limit + 1 },
    { $project: { availableAuthor: 0 } }
  ]);
  const visible = records.slice(0, query.limit);
  return {
    items: await activityDtos(
      visible,
      userId,
      canModerateActivity(access.role, access.active, access.community.status === 'ARCHIVED')
    ),
    hasMore: records.length > query.limit,
    nextCursor: records.length > query.limit ? encodeCursor(visible[visible.length - 1]) : null
  };
}

export async function deleteActivity(communityId: string, activityId: string, userId: string) {
  const access = await resolveCommunityAccess(communityId, userId);
  if (access.community.status !== 'ACTIVE')
    throw new AppError(409, 'COMMUNITY_ARCHIVED', 'Archived communities are read-only.');
  if (access.community.visibility === 'PRIVATE' && !access.active) throw denied();
  const record = await CommunityActivityModel.findOne({ _id: activityId, communityId, status: 'ACTIVE' })
    .select('authorId')
    .lean();
  if (!record) throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity not found.');
  if (id(record.authorId) !== userId && !canModerateActivity(access.role, access.active, false))
    throw denied();
  const [applications, offers] = await Promise.all([
    ReferralApplication.exists({ opportunityId: activityId }),
    ReferralOffer.exists({ needId: activityId })
  ]);
  if (applications || offers)
    throw new AppError(409, 'REFERRAL_HAS_RESPONSES', 'Close this referral instead of deleting it.');
  const removed = await CommunityActivityModel.findOneAndUpdate(
    { _id: activityId, communityId, status: 'ACTIVE' },
    { $set: { status: 'DELETED', payload: null, deletedAt: new Date() } },
    { new: true, runValidators: false }
  );
  if (!removed) throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity not found.');
}
