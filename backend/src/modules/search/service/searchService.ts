import type { SearchCategory, SearchPage, SearchResult, SearchResultCategory } from '@voklance/shared';
import { SEARCH_CATEGORIES } from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import CommunityActivity from '../../commands/model/CommunityActivity.js';
import Community from '../../communities/model/Community.js';
import ProfessionalEvent from '../../events/model/ProfessionalEvent.js';
import GitHubConnection from '../../github/model/GitHubConnection.js';
import GitHubRepository from '../../github/model/GitHubRepository.js';
import CommunityMembership from '../../memberships/model/CommunityMembership.js';
import UserBlock from '../../messaging/model/UserBlock.js';
import Post from '../../posts/model/Post.js';
import Profile from '../../profiles/model/Profile.js';
import ProfileProject from '../../profiles/model/ProfileProject.js';
import ProfileCertification from '../../profiles/model/ProfileCertification.js';
import CommunityResource from '../../resources/model/CommunityResource.js';
import Skill from '../../skills/model/Skill.js';
import UserSkill from '../../skills/model/UserSkill.js';
import User from '../../users/model/User.js';

export interface SearchInput {
  q: string;
  category: SearchCategory;
  sort: 'relevance' | 'recent';
  limit: number;
  cursor?: string;
  location?: string;
  skill?: string;
  communityCategory?: string;
  eventType?: 'event' | 'meetup';
  upcoming?: boolean;
  resourceCategory?: string;
  language?: string;
  featuredOnly?: boolean;
}
const categoryList = SEARCH_CATEGORIES.filter((item): item is SearchResultCategory => item !== 'all');
const oid = (value: string) => new Types.ObjectId(value);
const MAX_CANDIDATES = 250;
const cleanSearch = (value: string) => value.match(/[\p{L}\p{N}]+/gu)?.join(' ') ?? '';
const id = (value: Types.ObjectId) => value.toString();
const excerpt = (value: string | null | undefined, max = 180) => {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};
function relevance(title: string, description: string, query: string) {
  const name = title.toLocaleLowerCase();
  const text = description.toLocaleLowerCase();
  const q = query.toLocaleLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (text.includes(q)) return 30;
  return 10;
}
function item(
  category: SearchResultCategory,
  entityId: string,
  title: string,
  description: string,
  href: string,
  createdAt: Date,
  q: string,
  metadata: SearchResult['metadata'] = {},
  imageUrl: string | null = null
): SearchResult {
  return {
    id: `${category}:${entityId}`,
    category,
    title,
    description: excerpt(description),
    href,
    imageUrl,
    relevanceScore: relevance(title, description, q),
    createdAt: createdAt.toISOString(),
    metadata
  };
}
async function excludedUsers(viewerId: string) {
  const rows = await UserBlock.find({
    $or: [{ blockerId: oid(viewerId) }, { blockedId: oid(viewerId) }]
  })
    .select('blockerId blockedId')
    .lean();
  return new Set(rows.map((row) => (id(row.blockerId) === viewerId ? id(row.blockedId) : id(row.blockerId))));
}
export async function publicPeople(userIds: string[], excluded: Set<string>, discoverable = false) {
  const ids = [...new Set(userIds)].filter((value) => !excluded.has(value));
  if (!ids.length)
    return new Map<string, { username: string; fullName: string; headline: string; avatarUrl?: string }>();
  const [profiles, users] = await Promise.all([
    Profile.find({
      userId: { $in: ids },
      visibility: 'PUBLIC',
      ...(discoverable ? { profileDiscoverable: { $ne: false } } : {})
    })
      .select('userId username fullName headline avatarUrl')
      .lean(),
    User.find({
      _id: { $in: ids },
      onboardingStatus: 'COMPLETED',
      $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }]
    })
      .select('_id')
      .lean()
  ]);
  const active = new Set(users.map((user) => id(user._id)));
  return new Map(
    profiles
      .filter((profile) => active.has(id(profile.userId)))
      .map((profile) => [id(profile.userId), profile])
  );
}
export async function visibleCommunities(ids: string[], viewerId: string) {
  const communities = await Community.find({ _id: { $in: ids }, status: 'ACTIVE' })
    .select('_id slug name visibility category')
    .lean();
  const privateIds = communities
    .filter((community) => community.visibility === 'PRIVATE')
    .map((community) => community._id);
  const memberships = privateIds.length
    ? await CommunityMembership.find({
        communityId: { $in: privateIds },
        userId: oid(viewerId),
        status: 'ACTIVE'
      })
        .select('communityId')
        .lean()
    : [];
  const joined = new Set(memberships.map((row) => id(row.communityId)));
  return new Map(
    communities
      .filter((row) => row.visibility === 'PUBLIC' || joined.has(id(row._id)))
      .map((row) => [id(row._id), row])
  );
}
async function people(q: string, viewerId: string, excluded: Set<string>, input: SearchInput) {
  const filter = {
    visibility: 'PUBLIC' as const,
    profileDiscoverable: { $ne: false },
    userId: { $nin: [...excluded, viewerId].map(oid) },
    ...(input.location
      ? {
          $or: [
            { city: { $regex: `^${escapePrefix(input.location)}`, $options: 'i' } },
            { country: { $regex: `^${escapePrefix(input.location)}`, $options: 'i' } }
          ]
        }
      : {})
  };
  const [textRows, matchingSkills, matchingProjects, matchingCertifications] = await Promise.all([
    Profile.find({
      $text: { $search: cleanSearch(q) },
      ...filter
    })
      .limit(MAX_CANDIDATES)
      .lean(),
    Skill.find({ $text: { $search: cleanSearch(q) } })
      .select('_id')
      .limit(30)
      .lean(),
    ProfileProject.find({ $text: { $search: cleanSearch(q) } })
      .select('userId')
      .limit(MAX_CANDIDATES)
      .lean(),
    ProfileCertification.find({ $text: { $search: cleanSearch(q) } })
      .select('userId')
      .limit(MAX_CANDIDATES)
      .lean()
  ]);
  const matchingAssignments = matchingSkills.length
    ? await UserSkill.find({ skillId: { $in: matchingSkills.map((skill) => skill._id) } })
        .select('userId')
        .limit(MAX_CANDIDATES)
        .lean()
    : [];
  const matchedUserIds = [
    ...new Set(
      [...matchingAssignments, ...matchingProjects, ...matchingCertifications].map((row) => id(row.userId))
    )
  ];
  const skillRows = matchedUserIds.length
    ? await Profile.find({
        ...filter,
        userId: {
          $in: matchedUserIds.map(oid),
          $nin: [...excluded, viewerId].map(oid)
        }
      })
        .limit(MAX_CANDIDATES)
        .lean()
    : [];
  let rows = [...new Map([...textRows, ...skillRows].map((row) => [id(row._id), row])).values()];
  if (input.skill) {
    const skill = await Skill.findOne({ slug: input.skill.toLowerCase() }).select('_id').lean();
    if (!skill) return [];
    const assignments = await UserSkill.find({
      skillId: skill._id,
      userId: { $in: rows.map((row) => row.userId) }
    })
      .select('userId')
      .lean();
    const skilled = new Set(assignments.map((assignment) => id(assignment.userId)));
    rows = rows.filter((row) => skilled.has(id(row.userId)));
  }
  const active = await User.find({
    _id: { $in: rows.map((row) => row.userId) },
    onboardingStatus: 'COMPLETED',
    $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }]
  })
    .select('_id')
    .lean();
  const allowed = new Set(active.map((row) => id(row._id)));
  return rows
    .filter((row) => allowed.has(id(row.userId)))
    .map((row) =>
      item(
        'people',
        id(row._id),
        row.fullName,
        row.headline,
        `/app/professionals/${encodeURIComponent(row.username)}`,
        row._id.getTimestamp(),
        q,
        { location: [row.city, row.country].filter(Boolean).join(', ') },
        row.avatarUrl ?? null
      )
    );
}
function escapePrefix(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
async function communities(q: string, viewerId: string, input: SearchInput) {
  const rows = await Community.find({
    $text: { $search: cleanSearch(q) },
    status: 'ACTIVE',
    ...(input.communityCategory ? { category: input.communityCategory } : {})
  })
    .limit(MAX_CANDIDATES)
    .lean();
  const visible = await visibleCommunities(
    rows.map((row) => id(row._id)),
    viewerId
  );
  return rows
    .filter((row) => visible.has(id(row._id)))
    .map((row) =>
      item(
        'communities',
        id(row._id),
        row.name,
        row.description,
        `/app/communities/${encodeURIComponent(row.slug)}`,
        row.createdAt,
        q,
        { category: row.category, visibility: row.visibility }
      )
    );
}
async function posts(q: string, excluded: Set<string>) {
  const rows = await Post.find({
    $text: { $search: cleanSearch(q) },
    status: 'PUBLISHED',
    authorId: { $nin: [...excluded].map(oid) }
  })
    .limit(MAX_CANDIDATES)
    .lean();
  const authors = await publicPeople(
    rows.map((row) => id(row.authorId)),
    excluded
  );
  return rows
    .filter((row) => authors.has(id(row.authorId)))
    .map((row) => {
      const author = authors.get(id(row.authorId))!;
      return item(
        'posts',
        id(row._id),
        excerpt(row.content, 85),
        row.content,
        `/app/posts/${id(row._id)}`,
        row.createdAt,
        q,
        { author: author.fullName }
      );
    });
}
async function events(q: string, viewerId: string, excluded: Set<string>, input: SearchInput) {
  const rows = await ProfessionalEvent.find({
    $text: { $search: cleanSearch(q) },
    status: 'scheduled',
    organizerId: { $nin: [...excluded].map(oid) },
    ...(input.eventType ? { type: input.eventType } : {}),
    ...(input.upcoming ? { startAt: { $gte: new Date() } } : {})
  })
    .limit(MAX_CANDIDATES)
    .lean();
  const [visible, authors] = await Promise.all([
    visibleCommunities(
      rows.map((row) => id(row.communityId)),
      viewerId
    ),
    publicPeople(
      rows.map((row) => id(row.organizerId)),
      excluded
    )
  ]);
  return rows
    .filter((row) => visible.has(id(row.communityId)) && authors.has(id(row.organizerId)))
    .map((row) =>
      item(
        'events',
        id(row._id),
        row.title,
        row.description,
        `/app/events/${id(row._id)}`,
        row.createdAt,
        q,
        {
          type: row.type,
          startAt: row.startAt.toISOString(),
          location: row.locationType === 'online' ? 'Online' : (row.venueName ?? 'In person')
        }
      )
    );
}
async function referrals(q: string, viewerId: string, excluded: Set<string>) {
  const rows = await CommunityActivity.find({
    $text: { $search: cleanSearch(q) },
    status: 'ACTIVE',
    commandType: { $in: ['referral', 'needreferral'] },
    referralStatus: 'OPEN',
    authorId: { $nin: [...excluded].map(oid) }
  })
    .limit(MAX_CANDIDATES)
    .lean();
  const [visible, authors] = await Promise.all([
    visibleCommunities(
      rows.map((row) => id(row.communityId)),
      viewerId
    ),
    publicPeople(
      rows.map((row) => id(row.authorId)),
      excluded
    )
  ]);
  return rows.flatMap((row) => {
    if (!visible.has(id(row.communityId)) || !authors.has(id(row.authorId)) || !row.payload) return [];
    if (row.commandType === 'referral') {
      const payload = row.payload as {
        jobTitle: string;
        company: string;
        description: string;
        expiresAt?: string;
      };
      if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) return [];
      return [
        item(
          'referrals',
          id(row._id),
          payload.jobTitle,
          payload.description,
          `/app/referrals/opportunities/${id(row._id)}`,
          row.createdAt,
          q,
          { company: payload.company, type: 'opportunity' }
        )
      ];
    }
    const payload = row.payload as { jobTitle: string; company: string; message: string };
    return [
      item(
        'referrals',
        id(row._id),
        payload.jobTitle,
        payload.message,
        `/app/referrals/needs/${id(row._id)}`,
        row.createdAt,
        q,
        { company: payload.company, type: 'request' }
      )
    ];
  });
}
async function resources(q: string, viewerId: string, excluded: Set<string>, input: SearchInput) {
  const rows = await CommunityResource.find({
    $text: { $search: cleanSearch(q) },
    status: 'published',
    createdBy: { $nin: [...excluded].map(oid) },
    ...(input.resourceCategory ? { category: input.resourceCategory } : {})
  })
    .limit(MAX_CANDIDATES)
    .lean();
  const [visible, authors] = await Promise.all([
    visibleCommunities(
      rows.map((row) => id(row.communityId)),
      viewerId
    ),
    publicPeople(
      rows.map((row) => id(row.createdBy)),
      excluded
    )
  ]);
  return rows
    .filter((row) => visible.has(id(row.communityId)) && authors.has(id(row.createdBy)))
    .map((row) =>
      item(
        'resources',
        id(row._id),
        row.title,
        row.description,
        `/app/resources/${id(row._id)}`,
        row.createdAt,
        q,
        { category: row.category, community: visible.get(id(row.communityId))!.name }
      )
    );
}
async function github(q: string, excluded: Set<string>, input: SearchInput) {
  const rows = await GitHubRepository.find({
    $text: { $search: cleanSearch(q) },
    isUnavailable: false,
    userId: { $nin: [...excluded].map(oid) },
    ...(input.language ? { primaryLanguage: input.language } : {})
  })
    .limit(MAX_CANDIDATES)
    .lean();
  const [owners, connections] = await Promise.all([
    publicPeople(
      rows.map((row) => id(row.userId)),
      excluded,
      true
    ),
    GitHubConnection.find({ userId: { $in: rows.map((row) => row.userId) } })
      .select('userId featuredRepositoryIds')
      .lean()
  ]);
  const connected = new Map(connections.map((row) => [id(row.userId), row]));
  return rows
    .filter((row) => {
      const owner = owners.get(id(row.userId));
      const connection = connected.get(id(row.userId));
      return (
        owner &&
        connection &&
        (!input.featuredOnly ||
          connection.featuredRepositoryIds.some((featured) => id(featured) === id(row._id)))
      );
    })
    .map((row) => {
      const owner = owners.get(id(row.userId))!;
      return item(
        'github',
        id(row._id),
        row.name,
        row.description ?? '',
        `/app/professionals/${encodeURIComponent(owner.username)}`,
        row.createdAt,
        q,
        {
          owner: owner.fullName,
          language: row.primaryLanguage ?? '',
          stars: row.stargazersCount,
          githubUrl: row.htmlUrl
        }
      );
    });
}
function cursorOffset(cursor?: string) {
  if (!cursor) return 0;
  try {
    const value = Number(Buffer.from(cursor, 'base64url').toString());
    if (Number.isSafeInteger(value) && value >= 0 && value <= MAX_CANDIDATES) return value;
  } catch {
    /* invalid cursor */
  }
  throw new AppError(400, 'INVALID_CURSOR', 'Invalid search cursor.');
}
export async function search(viewerId: string, input: SearchInput): Promise<SearchPage> {
  const q = input.q.replace(/\s+/g, ' ').trim();
  if (cleanSearch(q).length < 2)
    throw new AppError(400, 'SEARCH_QUERY_INVALID', 'Enter at least two searchable characters.');
  const excluded = await excludedUsers(viewerId);
  const adapters = {
    people: () => people(q, viewerId, excluded, input),
    communities: () => communities(q, viewerId, input),
    posts: () => posts(q, excluded),
    events: () => events(q, viewerId, excluded, input),
    referrals: () => referrals(q, viewerId, excluded),
    resources: () => resources(q, viewerId, excluded, input),
    github: () => github(q, excluded, input)
  };
  const sortResults = (rows: SearchResult[]) =>
    [...rows].sort((a, b) =>
      input.sort === 'recent'
        ? b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
        : b.relevanceScore - a.relevanceScore ||
          b.createdAt.localeCompare(a.createdAt) ||
          b.id.localeCompare(a.id)
    );
  if (input.category === 'all') {
    const results = await Promise.all(
      categoryList.map(
        async (category) => [category, sortResults(await adapters[category]()).slice(0, 5)] as const
      )
    );
    return {
      category: 'all',
      items: [],
      hasMore: false,
      nextCursor: null,
      previews: Object.fromEntries(results)
    };
  }
  const offset = cursorOffset(input.cursor);
  const results = sortResults(await adapters[input.category]());
  const page = results.slice(offset, offset + input.limit);
  const hasMore = offset + input.limit < results.length;
  return {
    category: input.category,
    items: page,
    hasMore,
    nextCursor: hasMore ? Buffer.from(String(offset + input.limit)).toString('base64url') : null
  };
}
