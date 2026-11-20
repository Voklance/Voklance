import { Types, type HydratedDocument } from 'mongoose';
import type {
  EventAttendeePage,
  EventPage,
  EventPayload,
  MeetupPayload,
  ProfessionalEventDTO,
  RSVPResponse
} from '@voklance/shared';
import { AppError } from '../../../common/AppError.js';
import { withReplicaTransaction } from '../../../common/withReplicaTransaction.js';
import Community from '../../communities/model/Community.js';
import CommunityMembership from '../../memberships/model/CommunityMembership.js';
import { resolveCommunityAccess } from '../../communities/service/communityService.js';
import { canCreateCommand } from '../../communities/service/communityPermissions.js';
import { safeAuthorsFor } from '../../commands/service/commandService.js';
import CommunityActivity from '../../commands/model/CommunityActivity.js';
import EventRegistration from '../model/EventRegistration.js';
import MeetupRSVP from '../model/MeetupRSVP.js';
import ProfessionalEvent, { type ProfessionalEventRecord } from '../model/ProfessionalEvent.js';
import { queueNotification } from '../../notifications/service/notificationOutbox.js';
import type { AttendeeQuery, EventListQuery, EventPatch } from '../validation/eventSchemas.js';

const oid = (value: string) => new Types.ObjectId(value);
const missing = () => new AppError(404, 'EVENT_NOT_FOUND', 'Event not found.');
const denied = () => new AppError(403, 'EVENT_FORBIDDEN', 'This event action is unavailable to you.');
const conflict = (message: string) => new AppError(409, 'EVENT_UNAVAILABLE', message);
const duplicate = (error: unknown) =>
  !!error && typeof error === 'object' && 'code' in error && error.code === 11000;
const isManager = (role: string | null) => role === 'OWNER' || role === 'ADMIN';
async function notifyEventAudience(
  eventId: string,
  actorId: string,
  type: 'EVENT_UPDATED' | 'EVENT_CANCELLED' | 'MEETUP_UPDATED',
  version: string,
  isMeetup: boolean
) {
  let cursor: Types.ObjectId | null = null;
  while (true) {
    const filter: { eventId: Types.ObjectId; _id?: { $gt: Types.ObjectId } } = {
      eventId: oid(eventId),
      ...(cursor ? { _id: { $gt: cursor } } : {})
    };
    const rows: Array<{ _id: Types.ObjectId; userId: Types.ObjectId }> = isMeetup
      ? await MeetupRSVP.find({ ...filter, response: { $in: ['going', 'interested'] } })
          .sort({ _id: 1 })
          .limit(100)
          .select('_id userId')
          .lean()
      : await EventRegistration.find({ ...filter, status: 'registered' })
          .sort({ _id: 1 })
          .limit(100)
          .select('_id userId')
          .lean();
    if (!rows.length) break;
    await Promise.all(
      rows.map((row) =>
        queueNotification({
          recipientId: row.userId.toString(),
          actorId,
          type,
          entityType: 'event',
          entityId: eventId,
          deduplicationKey: `event:${eventId}:${type}:${version}`
        })
      )
    );
    cursor = rows.at(-1)!._id;
    if (rows.length < 100) break;
  }
}

export function validTimezone(zone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
function localParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant);
  const get = (key: string) => parts.find((part) => part.type === key)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}
function checkedDate(value: string, timezone: string, explicitZone: boolean) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid event date.');
  if (explicitZone && localParts(date, timezone) !== value.slice(0, 19))
    throw new AppError(400, 'VALIDATION_ERROR', 'The supplied time and offset do not match the time zone.');
  return date;
}
function schedule(start: Date, end: Date, requireFuture = true) {
  if (end <= start || (requireFuture && start <= new Date()))
    throw new AppError(400, 'VALIDATION_ERROR', 'Choose a future start and an end after it.');
}
const transaction = withReplicaTransaction;

export async function createFromCommand(
  communityId: string,
  userId: string,
  type: 'event' | 'meetup',
  payload: EventPayload | MeetupPayload,
  idempotencyKey?: string
) {
  const access = await resolveCommunityAccess(communityId, userId);
  if (!canCreateCommand(access.role, access.active, access.community.status === 'ARCHIVED', 'command:create'))
    throw denied();
  const timezone = payload.timezone ?? 'UTC';
  if (!validTimezone(timezone)) throw new AppError(400, 'VALIDATION_ERROR', 'Use a valid IANA time zone.');
  const startAt = checkedDate(
    type === 'event' ? (payload as EventPayload).startAt : (payload as MeetupPayload).scheduledAt,
    timezone,
    !!payload.timezone
  );
  const endText = type === 'event' ? (payload as EventPayload).endAt : undefined;
  const endAt = endText
    ? checkedDate(endText, timezone, !!payload.timezone)
    : new Date(startAt.getTime() + 60 * 60 * 1000);
  schedule(startAt, endAt);
  if (idempotencyKey) {
    const existing = await CommunityActivity.findOne({ communityId, authorId: userId, idempotencyKey });
    if (existing) {
      if (existing.commandType !== type || JSON.stringify(existing.payload) !== JSON.stringify(payload))
        throw conflict('This submission key was already used.');
      return existing;
    }
  }
  try {
    return await transaction(async (session) => {
      const [activity] = await CommunityActivity.create(
        [
          {
            communityId,
            authorId: userId,
            commandType: type,
            payloadVersion: 1,
            payload,
            idempotencyKey,
            status: 'ACTIVE'
          }
        ],
        { session }
      );
      await ProfessionalEvent.create(
        [
          {
            communityId,
            activityId: activity._id,
            organizerId: userId,
            type,
            title: payload.title,
            description: payload.description,
            category: type === 'event' ? (payload as EventPayload).category : undefined,
            startAt,
            endAt,
            timezone,
            locationType: payload.locationType,
            venueName: payload.locationType === 'online' ? undefined : payload.locationOrUrl,
            onlineUrl: payload.locationType === 'online' ? payload.locationOrUrl : payload.onlineUrl,
            capacity: payload.capacity,
            registrationOpen: type === 'event' ? ((payload as EventPayload).registrationOpen ?? true) : true,
            confirmedCount: 0,
            interestedCount: 0,
            status: 'scheduled'
          }
        ],
        { session }
      );
      return activity;
    });
  } catch (error) {
    if (duplicate(error) && idempotencyKey) {
      const existing = await CommunityActivity.findOne({ communityId, authorId: userId, idempotencyKey });
      if (
        existing &&
        existing.commandType === type &&
        JSON.stringify(existing.payload) === JSON.stringify(payload)
      )
        return existing;
    }
    throw error;
  }
}

function cursorOf(record: { startAt: Date; _id: Types.ObjectId }) {
  return Buffer.from(`${record.startAt.getTime()}:${record._id.toString()}`).toString('base64url');
}
function parseCursor(value?: string) {
  if (!value) return null;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(value)) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  const raw = Buffer.from(value, 'base64url').toString('utf8');
  const match = /^(\d{13}):([0-9a-f]{24})$/.exec(raw);
  if (!match || Buffer.from(raw).toString('base64url') !== value)
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  return { startAt: new Date(Number(match[1])), _id: oid(match[2]) };
}
async function accessFor(event: { communityId: Types.ObjectId }, userId: string) {
  const access = await resolveCommunityAccess(event.communityId.toString(), userId);
  if (access.community.visibility === 'PRIVATE' && !access.active) throw denied();
  return access;
}
async function getEvent(eventId: string, userId: string) {
  const event = await ProfessionalEvent.findById(eventId);
  if (!event) throw missing();
  const access = await accessFor(event, userId);
  return { event, access };
}
async function dtoFor(
  records: HydratedDocument<ProfessionalEventRecord>[],
  userId: string
): Promise<ProfessionalEventDTO[]> {
  if (!records.length) return [];
  const eventIds = records.map((record) => record._id);
  const communityIds = [...new Set(records.map((record) => record.communityId.toString()))].map(oid);
  const [communities, memberships, authors, registrations, rsvps] = await Promise.all([
    Community.find({ _id: { $in: communityIds } })
      .select('name slug visibility status')
      .lean(),
    CommunityMembership.find({ communityId: { $in: communityIds }, userId, status: 'ACTIVE' })
      .select('communityId role')
      .lean(),
    safeAuthorsFor(records.map((record) => record.organizerId)),
    EventRegistration.find({ eventId: { $in: eventIds }, userId })
      .select('eventId status')
      .lean(),
    MeetupRSVP.find({ eventId: { $in: eventIds }, userId })
      .select('eventId response')
      .lean()
  ]);
  const communityMap = new Map(communities.map((item) => [item._id.toString(), item]));
  const membershipMap = new Map(memberships.map((item) => [item.communityId.toString(), item]));
  const registrationMap = new Map(registrations.map((item) => [item.eventId.toString(), item.status]));
  const rsvpMap = new Map(rsvps.map((item) => [item.eventId.toString(), item.response]));
  return records.flatMap((record) => {
    const community = communityMap.get(record.communityId.toString());
    const organizer = authors.get(record.organizerId.toString());
    if (!community || !organizer) return [];
    const member = membershipMap.get(record.communityId.toString());
    if (community.visibility === 'PRIVATE' && !member) return [];
    const canManage = !!member && (record.organizerId.toString() === userId || isManager(member.role));
    const myRegistration = registrationMap.get(record._id.toString()) ?? null;
    const myRSVP = rsvpMap.get(record._id.toString()) ?? null;
    const canParticipate =
      !!member &&
      community.status === 'ACTIVE' &&
      record.status === 'scheduled' &&
      record.startAt > new Date();
    const hasPrivateLink =
      canManage || (record.status === 'scheduled' && (myRegistration === 'registered' || myRSVP === 'going'));
    return [
      {
        id: record._id.toString(),
        activityId: record.activityId.toString(),
        community: { id: community._id.toString(), name: community.name, slug: community.slug },
        organizer,
        type: record.type,
        title: record.title,
        description: record.description,
        category: record.category ?? null,
        startAt: record.startAt.toISOString(),
        endAt: record.endAt.toISOString(),
        timezone: record.timezone,
        locationType: record.locationType,
        venueName: record.venueName ?? null,
        onlineUrl: hasPrivateLink ? (record.onlineUrl ?? null) : null,
        capacity: record.capacity ?? null,
        confirmedCount: record.confirmedCount,
        interestedCount: record.interestedCount,
        status: record.status === 'scheduled' && record.endAt <= new Date() ? 'completed' : record.status,
        registrationOpen: record.registrationOpen,
        myRegistration,
        myRSVP,
        canManage,
        canParticipate,
        canViewAttendees: canManage
      }
    ];
  });
}
export async function eventDetail(eventId: string, userId: string) {
  const { event } = await getEvent(eventId, userId);
  const [dto] = await dtoFor([event], userId);
  if (!dto) throw missing();
  return dto;
}
export async function listEvents(userId: string, query: EventListQuery): Promise<EventPage> {
  if (query.communityId) {
    const access = await resolveCommunityAccess(query.communityId, userId);
    if (access.community.visibility === 'PRIVATE' && !access.active) throw denied();
  }
  const activeMemberships = await CommunityMembership.find({ userId, status: 'ACTIVE' })
    .select('communityId')
    .lean();
  const publicCommunities = await Community.find({ visibility: 'PUBLIC', status: { $ne: 'CREATING' } })
    .select('_id')
    .lean();
  const visibleIds = [
    ...new Set(
      [...activeMemberships, ...publicCommunities].map((item) =>
        ('communityId' in item ? item.communityId : item._id).toString()
      )
    )
  ];
  const cursor = parseCursor(query.cursor);
  const upcoming = query.upcoming === 'true';
  const direction = upcoming ? 1 : -1;
  const startAt = { [upcoming ? '$gte' : '$lt']: new Date() };
  const cursorFilter = cursor
    ? {
        $or: [
          { startAt: { [upcoming ? '$gt' : '$lt']: cursor.startAt } },
          { startAt: cursor.startAt, _id: { [upcoming ? '$gt' : '$lt']: cursor._id } }
        ]
      }
    : {};
  let mineIds: Types.ObjectId[] | undefined;
  if (query.mine === 'participating') {
    const [registrations, rsvps] = await Promise.all([
      EventRegistration.find({ userId, status: 'registered' }).select('eventId').lean(),
      MeetupRSVP.find({ userId, response: { $in: ['going', 'interested'] } })
        .select('eventId')
        .lean()
    ]);
    mineIds = [...registrations.map((item) => item.eventId), ...rsvps.map((item) => item.eventId)];
  }
  const filter = {
    communityId: { $in: (query.communityId ? [query.communityId] : visibleIds).map(oid) },
    ...(query.mine ? {} : { status: { $ne: 'cancelled' } }),
    startAt,
    ...cursorFilter,
    ...(query.type ? { type: query.type } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.locationType ? { locationType: query.locationType } : {}),
    ...(query.mine === 'organized' ? { organizerId: oid(userId) } : {}),
    ...(mineIds ? { _id: { $in: mineIds } } : {})
  };
  const records = await ProfessionalEvent.find(filter)
    .sort({ startAt: direction, _id: direction })
    .limit(query.limit + 1);
  const visible = records.slice(0, query.limit);
  return {
    items: await dtoFor(visible, userId),
    hasMore: records.length > query.limit,
    nextCursor: records.length > query.limit ? cursorOf(visible[visible.length - 1]) : null
  };
}
function assertManage(
  record: { organizerId: Types.ObjectId },
  userId: string,
  access: Awaited<ReturnType<typeof resolveCommunityAccess>>
) {
  if (!access.active || (record.organizerId.toString() !== userId && !isManager(access.role))) throw denied();
}
export async function editEvent(eventId: string, userId: string, patch: EventPatch) {
  const { event, access } = await getEvent(eventId, userId);
  assertManage(event, userId, access);
  if (event.status !== 'scheduled' || event.startAt <= new Date() || access.community.status !== 'ACTIVE')
    throw conflict('This event cannot be edited.');
  const timezone = patch.timezone ?? event.timezone;
  if (!validTimezone(timezone)) throw new AppError(400, 'VALIDATION_ERROR', 'Use a valid IANA time zone.');
  const startAt = patch.startAt ? checkedDate(patch.startAt, timezone, !!patch.timezone) : event.startAt;
  const endAt = patch.endAt ? checkedDate(patch.endAt, timezone, !!patch.timezone) : event.endAt;
  schedule(startAt, endAt);
  const capacity = patch.capacity === null ? undefined : (patch.capacity ?? event.capacity);
  if (capacity !== undefined && capacity < event.confirmedCount)
    throw conflict('Capacity is below confirmed attendance.');
  const locationType = patch.locationType ?? event.locationType;
  const venueName = patch.venueName === null ? undefined : (patch.venueName ?? event.venueName);
  const onlineUrl = patch.onlineUrl === null ? undefined : (patch.onlineUrl ?? event.onlineUrl);
  if (locationType !== 'online' && !venueName)
    throw new AppError(400, 'VALIDATION_ERROR', 'Venue is required.');
  if (locationType !== 'in_person' && !onlineUrl)
    throw new AppError(400, 'VALIDATION_ERROR', 'HTTPS online link is required.');
  await transaction(async (session) => {
    const update = await ProfessionalEvent.updateOne(
      {
        _id: eventId,
        status: 'scheduled',
        startAt: { $gt: new Date() },
        confirmedCount: { $lte: capacity ?? 10000 }
      },
      {
        $set: {
          title: patch.title ?? event.title,
          description: patch.description ?? event.description,
          startAt,
          endAt,
          timezone,
          locationType,
          registrationOpen: patch.registrationOpen ?? event.registrationOpen,
          ...(patch.category !== null && (patch.category ?? event.category)
            ? { category: patch.category ?? event.category }
            : {}),
          ...(capacity !== undefined ? { capacity } : {}),
          ...(locationType !== 'online' ? { venueName } : {}),
          ...(locationType !== 'in_person' ? { onlineUrl } : {})
        },
        $unset: {
          ...(patch.category === null ? { category: 1 } : {}),
          ...(patch.capacity === null ? { capacity: 1 } : {}),
          ...(locationType === 'online' ? { venueName: 1 } : {}),
          ...(locationType === 'in_person' ? { onlineUrl: 1 } : {})
        }
      },
      { session, runValidators: true }
    );
    if (!update.matchedCount) throw conflict('Event changed while editing.');
    const current = await ProfessionalEvent.findById(eventId).session(session);
    if (!current) throw missing();
    await CommunityActivity.updateOne(
      { _id: event.activityId },
      {
        $set: {
          payload: {
            title: current.title,
            description: current.description,
            ...(current.type === 'event'
              ? {
                  startAt: current.startAt.toISOString(),
                  endAt: current.endAt.toISOString(),
                  category: current.category,
                  registrationOpen: current.registrationOpen
                }
              : { scheduledAt: current.startAt.toISOString() }),
            timezone: current.timezone,
            locationType: current.locationType,
            locationOrUrl: current.locationType === 'online' ? current.onlineUrl : current.venueName,
            ...(current.locationType === 'hybrid' ? { onlineUrl: current.onlineUrl } : {}),
            ...(current.capacity ? { capacity: current.capacity } : {})
          }
        }
      },
      { session }
    );
  });
  const changed = await ProfessionalEvent.findById(eventId).select('updatedAt type').lean();
  if (changed)
    await notifyEventAudience(
      eventId,
      userId,
      changed.type === 'meetup' ? 'MEETUP_UPDATED' : 'EVENT_UPDATED',
      changed.updatedAt.toISOString(),
      changed.type === 'meetup'
    );
  return eventDetail(eventId, userId);
}
export async function cancelEvent(eventId: string, userId: string) {
  const { event, access } = await getEvent(eventId, userId);
  assertManage(event, userId, access);
  if (event.status !== 'cancelled') {
    if (event.startAt <= new Date()) throw conflict('Past gatherings cannot be cancelled.');
    const changed = await ProfessionalEvent.updateOne(
      { _id: eventId, status: 'scheduled', startAt: { $gt: new Date() } },
      { $set: { status: 'cancelled', registrationOpen: false } }
    );
    if (changed.modifiedCount)
      await notifyEventAudience(eventId, userId, 'EVENT_CANCELLED', 'cancelled', event.type === 'meetup');
  }
  return eventDetail(eventId, userId);
}
async function assertParticipate(eventId: string, userId: string, type: 'event' | 'meetup') {
  const { event, access } = await getEvent(eventId, userId);
  if (event.type !== type)
    throw new AppError(400, 'EVENT_TYPE_MISMATCH', 'Wrong participation action for this gathering.');
  if (!access.active || access.community.status !== 'ACTIVE') throw denied();
  if (event.status !== 'scheduled' || event.startAt <= new Date())
    throw conflict('This gathering is no longer available.');
  if (type === 'event' && !event.registrationOpen) throw conflict('Registration is closed.');
  return event;
}
export async function register(eventId: string, userId: string) {
  const event = await assertParticipate(eventId, userId, 'event');
  try {
    await transaction(async (session) => {
      const existing = await EventRegistration.findOne({ eventId, userId }).session(session);
      if (existing?.status === 'registered') throw conflict('You are already registered.');
      const claimed = await ProfessionalEvent.updateOne(
        {
          _id: eventId,
          type: 'event',
          status: 'scheduled',
          startAt: { $gt: new Date() },
          registrationOpen: true,
          $expr: { $or: [{ $eq: ['$capacity', null] }, { $lt: ['$confirmedCount', '$capacity'] }] }
        },
        { $inc: { confirmedCount: 1 } },
        { session }
      );
      if (!claimed.matchedCount) throw conflict('Registration is full or closed.');
      if (existing)
        await EventRegistration.updateOne(
          { _id: existing._id },
          { $set: { status: 'registered', registeredAt: new Date() }, $unset: { cancelledAt: 1 } },
          { session }
        );
      else
        await EventRegistration.create(
          [{ eventId, userId, status: 'registered', registeredAt: new Date() }],
          { session }
        );
    });
  } catch (error) {
    if (duplicate(error)) throw conflict('You are already registered.');
    throw error;
  }
  await queueNotification({
    recipientId: event.organizerId.toString(),
    actorId: userId,
    type: 'EVENT_REGISTRATION_RECEIVED',
    entityType: 'event',
    entityId: eventId,
    deduplicationKey: `event:${eventId}:registration:${userId}`
  });
  return eventDetail(eventId, userId);
}
export async function cancelRegistration(eventId: string, userId: string) {
  const { event, access } = await getEvent(eventId, userId);
  if (event.type !== 'event' || !access.active) throw denied();
  await transaction(async (session) => {
    const changed = await EventRegistration.updateOne(
      { eventId, userId, status: 'registered' },
      { $set: { status: 'cancelled', cancelledAt: new Date() } },
      { session }
    );
    if (changed.modifiedCount)
      await ProfessionalEvent.updateOne({ _id: eventId }, { $inc: { confirmedCount: -1 } }, { session });
  });
  return eventDetail(eventId, userId);
}
export async function setRSVP(eventId: string, userId: string, response: RSVPResponse) {
  const event = await assertParticipate(eventId, userId, 'meetup');
  try {
    await transaction(async (session) => {
      const existing = await MeetupRSVP.findOne({ eventId, userId }).session(session);
      if (existing?.response === response) return;
      const goingDelta = Number(response === 'going') - Number(existing?.response === 'going');
      const interestedDelta = Number(response === 'interested') - Number(existing?.response === 'interested');
      const claimed = await ProfessionalEvent.updateOne(
        {
          _id: eventId,
          type: 'meetup',
          status: 'scheduled',
          startAt: { $gt: new Date() },
          ...(goingDelta > 0
            ? { $expr: { $or: [{ $eq: ['$capacity', null] }, { $lt: ['$confirmedCount', '$capacity'] }] } }
            : {})
        },
        { $inc: { confirmedCount: goingDelta, interestedCount: interestedDelta } },
        { session }
      );
      if (!claimed.matchedCount) throw conflict('Meetup is full or closed.');
      if (existing)
        await MeetupRSVP.updateOne(
          { _id: existing._id },
          { $set: { response, respondedAt: new Date() } },
          { session }
        );
      else await MeetupRSVP.create([{ eventId, userId, response, respondedAt: new Date() }], { session });
    });
  } catch (error) {
    if (duplicate(error)) throw conflict('RSVP changed concurrently. Please retry.');
    throw error;
  }
  if (response !== 'not_going')
    await queueNotification({
      recipientId: event.organizerId.toString(),
      actorId: userId,
      type: 'MEETUP_RSVP_RECEIVED',
      entityType: 'event',
      entityId: eventId,
      deduplicationKey: `event:${eventId}:rsvp:${userId}:${response}`
    });
  return eventDetail(eventId, userId);
}
export async function attendees(
  eventId: string,
  userId: string,
  query: AttendeeQuery
): Promise<EventAttendeePage> {
  const { event, access } = await getEvent(eventId, userId);
  assertManage(event, userId, access);
  let before: Types.ObjectId | undefined;
  if (query.cursor) {
    if (!/^[0-9a-f]{24}$/i.test(query.cursor)) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
    before = oid(query.cursor);
  }
  const filter = { eventId: oid(eventId), ...(before ? { _id: { $gt: before } } : {}) };
  const records =
    event.type === 'event'
      ? await EventRegistration.find({ ...filter, status: 'registered' })
          .sort({ _id: 1 })
          .limit(query.limit + 1)
          .lean()
      : await MeetupRSVP.find({
          ...filter,
          response: query.response ? query.response : { $in: ['going', 'interested'] }
        })
          .sort({ _id: 1 })
          .limit(query.limit + 1)
          .lean();
  const visible = records.slice(0, query.limit);
  const people = await safeAuthorsFor(visible.map((item) => item.userId));
  return {
    items: visible.flatMap((item) => {
      const profile = people.get(item.userId.toString());
      return profile
        ? [
            {
              userId: item.userId.toString(),
              profile,
              response: 'status' in item ? ('registered' as const) : (item.response as 'going' | 'interested')
            }
          ]
        : [];
    }),
    hasMore: records.length > query.limit,
    nextCursor: records.length > query.limit ? visible[visible.length - 1]._id.toString() : null
  };
}
