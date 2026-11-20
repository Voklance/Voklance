import type {
  FeedPreferences,
  RecommendationCategory,
  RecommendationPage,
  RecommendationResult
} from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import CommunityActivity from '../../commands/model/CommunityActivity.js';
import Community from '../../communities/model/Community.js';
import Connection from '../../connections/model/Connection.js';
import ProfessionalEvent from '../../events/model/ProfessionalEvent.js';
import Profile from '../../profiles/model/Profile.js';
import ProfileProject from '../../profiles/model/ProfileProject.js';
import CommunityResource from '../../resources/model/CommunityResource.js';
import { publicPeople, visibleCommunities } from '../../search/service/searchService.js';
import RecommendationFeedback from '../model/RecommendationFeedback.js';
import UserFeedPreference from '../model/UserFeedPreference.js';
import { recommendationContext } from './recommendationContextService.js';

const oid = (id: string) => new Types.ObjectId(id);
const CANDIDATES = 120;
function cursor(value?: string) {
  if (!value) return 0;
  const n = Number(Buffer.from(value, 'base64url').toString());
  if (!Number.isSafeInteger(n) || n < 0 || n > CANDIDATES)
    throw new AppError(400, 'INVALID_CURSOR', 'Invalid recommendation cursor.');
  return n;
}
function match(text: string, topics: string[]) {
  return topics.find((topic) => topic.length >= 2 && text.toLocaleLowerCase().includes(topic));
}
function result(
  category: RecommendationCategory,
  entityId: string,
  title: string,
  description: string,
  href: string,
  createdAt: Date,
  reason: string,
  score: number,
  metadata: RecommendationResult['metadata'] = {}
): RecommendationResult {
  return {
    id: `${category}:${entityId}`,
    category,
    title,
    description: description.replace(/\s+/g, ' ').slice(0, 180),
    href,
    imageUrl: null,
    createdAt: createdAt.toISOString(),
    relevanceScore: score,
    reason,
    metadata
  };
}
export async function feedPreferences(userId: string): Promise<FeedPreferences> {
  const row = await UserFeedPreference.findOne({ userId: oid(userId) })
    .select('topics')
    .lean();
  return { topics: row?.topics ?? [] };
}
export async function saveFeedPreferences(userId: string, topics: string[]): Promise<FeedPreferences> {
  const normalized = [
    ...new Set(topics.map((topic) => topic.toLocaleLowerCase().replace(/\s+/g, ' ').trim()))
  ];
  await UserFeedPreference.updateOne(
    { userId: oid(userId) },
    { $set: { topics: normalized } },
    { upsert: true, runValidators: true }
  );
  return { topics: normalized };
}
export async function recommendationPage(
  userId: string,
  category: RecommendationCategory,
  limit: number,
  cursorValue?: string
): Promise<RecommendationPage> {
  const offset = cursor(cursorValue);
  const context = await recommendationContext(userId);
  const excluded = context.excludedUserIds;
  const suppressed = await RecommendationFeedback.find({
    userId: oid(userId),
    entityType: category,
    action: 'dismissed'
  })
    .select('entityId')
    .lean();
  const dismissed = new Set(suppressed.map((row) => row.entityId.toString()));
  const now = new Date();
  let items: RecommendationResult[] = [];
  if (category === 'people') {
    const relationships = await Connection.find({
      status: { $in: ['pending', 'accepted'] },
      $or: [{ userLowId: oid(userId) }, { userHighId: oid(userId) }]
    })
      .select('userLowId userHighId')
      .limit(500)
      .lean();
    const known = new Set([
      userId,
      ...relationships.map((row) =>
        row.userLowId.toString() === userId ? row.userHighId.toString() : row.userLowId.toString()
      )
    ]);
    const rows = await Profile.find({
      visibility: 'PUBLIC',
      profileDiscoverable: { $ne: false },
      userId: { $nin: [...excluded, ...known].map(oid) }
    })
      .sort({ _id: -1 })
      .limit(CANDIDATES)
      .lean();
    const people = await publicPeople(
      rows.map((row) => row.userId.toString()),
      excluded,
      true
    );
    const projects = await ProfileProject.find({ userId: { $in: rows.map((row) => row.userId) } })
      .select('userId title description technologies')
      .limit(CANDIDATES * 4)
      .lean();
    const projectText = new Map<string, string>();
    for (const project of projects)
      projectText.set(
        project.userId.toString(),
        `${projectText.get(project.userId.toString()) ?? ''} ${project.title} ${project.description} ${project.technologies.join(' ')}`
      );
    items = rows
      .filter((row) => people.has(row.userId.toString()))
      .map((row) => {
        const topic = match(
          `${row.headline} ${row.bio ?? ''} ${projectText.get(row.userId.toString()) ?? ''}`,
          context.topics
        );
        return result(
          'people',
          row._id.toString(),
          row.fullName,
          row.headline,
          `/app/professionals/${encodeURIComponent(row.username)}`,
          row._id.getTimestamp(),
          topic ? `Shares your ${topic} interest` : 'Discoverable professional',
          topic ? 40 : 10,
          { location: [row.city, row.country].filter(Boolean).join(', ') }
        );
      });
  } else if (category === 'communities') {
    const rows = await Community.find({
      status: 'ACTIVE',
      visibility: 'PUBLIC',
      _id: { $nin: [...context.communityIds].map(oid) }
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(CANDIDATES)
      .lean();
    items = rows.map((row) => {
      const topic = match(`${row.name} ${row.description} ${row.tags.join(' ')}`, context.topics);
      return result(
        'communities',
        row._id.toString(),
        row.name,
        row.description,
        `/app/communities/${encodeURIComponent(row.slug)}`,
        row.createdAt,
        topic ? `Matches your ${topic} interest` : 'Active public community',
        topic ? 40 : 10,
        { category: row.category }
      );
    });
  } else if (category === 'events') {
    const rows = await ProfessionalEvent.find({
      status: 'scheduled',
      startAt: { $gte: now },
      organizerId: { $nin: [...excluded].map(oid) }
    })
      .sort({ startAt: 1, _id: 1 })
      .limit(CANDIDATES)
      .lean();
    const [visible, people] = await Promise.all([
      visibleCommunities(
        rows.map((row) => row.communityId.toString()),
        userId
      ),
      publicPeople(
        rows.map((row) => row.organizerId.toString()),
        excluded
      )
    ]);
    items = rows
      .filter((row) => visible.has(row.communityId.toString()) && people.has(row.organizerId.toString()))
      .map((row) => {
        const joined = context.communityIds.has(row.communityId.toString());
        const topic = match(`${row.title} ${row.description} ${row.category ?? ''}`, context.topics);
        return result(
          'events',
          row._id.toString(),
          row.title,
          row.description,
          `/app/events/${row._id}`,
          row.createdAt,
          joined
            ? 'In a community you joined'
            : topic
              ? `Matches your ${topic} interest`
              : 'Upcoming professional event',
          (joined ? 25 : 0) + (topic ? 30 : 0) + 10,
          { startsAt: row.startAt.toISOString(), type: row.type }
        );
      });
  } else if (category === 'resources') {
    const rows = await CommunityResource.find({
      status: 'published',
      createdBy: { $nin: [...excluded].map(oid) }
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(CANDIDATES)
      .lean();
    const [visible, people] = await Promise.all([
      visibleCommunities(
        rows.map((row) => row.communityId.toString()),
        userId
      ),
      publicPeople(
        rows.map((row) => row.createdBy.toString()),
        excluded
      )
    ]);
    items = rows
      .filter((row) => visible.has(row.communityId.toString()) && people.has(row.createdBy.toString()))
      .map((row) => {
        const joined = context.communityIds.has(row.communityId.toString());
        const topic = match(`${row.title} ${row.description} ${row.tags.join(' ')}`, context.topics);
        return result(
          'resources',
          row._id.toString(),
          row.title,
          row.description,
          `/app/resources/${row._id}`,
          row.createdAt,
          joined
            ? 'In a community you joined'
            : topic
              ? `Matches your ${topic} interest`
              : 'Published resource',
          (joined ? 25 : 0) + (topic ? 30 : 0) + 10,
          { category: row.category }
        );
      });
  } else {
    const rows = await CommunityActivity.find({
      status: 'ACTIVE',
      commandType: 'referral',
      referralStatus: 'OPEN',
      authorId: { $nin: [...excluded].map(oid) }
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(CANDIDATES)
      .lean();
    const [visible, people] = await Promise.all([
      visibleCommunities(
        rows.map((row) => row.communityId.toString()),
        userId
      ),
      publicPeople(
        rows.map((row) => row.authorId.toString()),
        excluded
      )
    ]);
    items = rows.flatMap((row) => {
      if (!visible.has(row.communityId.toString()) || !people.has(row.authorId.toString()) || !row.payload)
        return [];
      const payload = row.payload as {
        jobTitle: string;
        company: string;
        description: string;
        expiresAt?: string;
        requiredSkills?: string[];
      };
      if (payload.expiresAt && new Date(payload.expiresAt) < now) return [];
      const joined = context.communityIds.has(row.communityId.toString());
      const topic = match(
        `${payload.jobTitle} ${payload.description} ${(payload.requiredSkills ?? []).join(' ')}`,
        context.topics
      );
      return [
        result(
          'referrals',
          row._id.toString(),
          payload.jobTitle,
          payload.description,
          `/app/referrals/opportunities/${row._id}`,
          row.createdAt,
          joined
            ? 'In a community you joined'
            : topic
              ? `Matches your ${topic} interest`
              : 'Open referral opportunity',
          (joined ? 25 : 0) + (topic ? 30 : 0) + 10,
          { company: payload.company }
        )
      ];
    });
  }
  const sorted = items
    .filter((item) => !dismissed.has(item.id.split(':')[1]))
    .sort(
      (a, b) =>
        b.relevanceScore - a.relevanceScore ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id)
    );
  const page = sorted.slice(offset, offset + limit);
  const hasMore = offset + limit < sorted.length;
  return {
    items: page,
    hasMore,
    nextCursor: hasMore ? Buffer.from(String(offset + limit)).toString('base64url') : null
  };
}
