import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Profile from '../profiles/model/Profile.js';
import Community from '../communities/model/Community.js';
import CommunityMembership from '../memberships/model/CommunityMembership.js';
import CommunityActivity from '../commands/model/CommunityActivity.js';
import ReferralApplication from './model/ReferralApplication.js';
import ReferralOffer from './model/ReferralOffer.js';

let mongo: MongoMemoryServer;
let owner: { id: string; cookie: string };
let member: { id: string; cookie: string };
let helper: { id: string; cookie: string };
let outsider: { id: string; cookie: string };
let publicId = '';
let privateId = '';
let opportunityId = '';
let needId = '';
let appId = '';
let offerId = '';
let counter = 0;
const opportunity = {
  jobTitle: 'Frontend Engineer',
  company: 'Example Co',
  location: 'Pune',
  workMode: 'hybrid',
  jobUrl: 'https://example.com/jobs/1',
  description: 'A frontend engineering opportunity.',
  experienceMin: 2,
  experienceMax: 4,
  requiredSkills: ['React', 'TypeScript']
};
const need = {
  jobTitle: 'Backend Engineer',
  company: 'Example Co',
  jobUrl: 'https://example.com/jobs/2',
  experienceLevel: 'mid',
  skills: ['Node.js'],
  message: 'I would appreciate a referral for this role.'
};
const application = {
  introduction: 'I have relevant frontend engineering experience.',
  relevantSkills: ['React'],
  portfolioUrl: 'https://example.com/portfolio'
};
const offer = {
  introduction: 'I can help with this professional referral.',
  offerDetails: 'I can submit a referral through our employee portal.',
  employerRelationship: 'I work at Example Co'
};
async function signup(name: string) {
  const result = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name, email: `referral-${++counter}@example.test`, password: 'password-123' });
  expect(result.status).toBe(201);
  const id = result.body.data.user.id as string;
  await User.updateOne({ _id: id }, { $set: { onboardingStatus: 'COMPLETED' } });
  return { id, cookie: String(result.headers['set-cookie']?.[0]).split(';')[0] };
}
const publish = (communityId: string, cookie: string, command: string, payload: unknown) =>
  request(app)
    .post(`/api/v1/communities/${communityId}/commands`)
    .set('Cookie', cookie)
    .send({ command, payloadVersion: 1, payload });
const api = (cookie: string) => ({
  get: (path: string) => request(app).get(`/api/v1${path}`).set('Cookie', cookie),
  post: (path: string, body: unknown = {}) =>
    request(app).post(`/api/v1${path}`).set('Cookie', cookie).send(body),
  patch: (path: string, body: unknown) =>
    request(app).patch(`/api/v1${path}`).set('Cookie', cookie).send(body),
  delete: (path: string) => request(app).delete(`/api/v1${path}`).set('Cookie', cookie)
});
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    Community.init(),
    CommunityMembership.init(),
    CommunityActivity.init(),
    ReferralApplication.init(),
    ReferralOffer.init()
  ]);
  owner = await signup('Referral Owner');
  member = await signup('Referral Member');
  helper = await signup('Referral Helper');
  outsider = await signup('Referral Outsider');
  await Profile.create({
    userId: member.id,
    username: 'referral-member',
    fullName: 'Referral Member',
    headline: 'Engineer',
    country: 'India',
    visibility: 'PUBLIC'
  });
  const body = (name: string, visibility: string) => ({
    name,
    description: `A professional community for ${name}.`,
    category: 'software-development',
    visibility
  });
  publicId = (await api(owner.cookie).post('/communities', body('Referral Guild', 'PUBLIC'))).body.data
    .community.id;
  privateId = (await api(owner.cookie).post('/communities', body('Private Referral Guild', 'PRIVATE'))).body
    .data.community.id;
  await api(member.cookie).post(`/communities/${publicId}/join`);
  await api(helper.cookie).post(`/communities/${publicId}/join`);
  await api(member.cookie).post(`/communities/${privateId}/join`);
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('referral workflows', () => {
  it('uses command submission as the only creation path and lists real public records', async () => {
    const first = await publish(publicId, owner.cookie, 'referral', opportunity);
    const second = await publish(publicId, owner.cookie, 'needreferral', need);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    opportunityId = first.body.data.activity.id;
    needId = second.body.data.activity.id;
    expect(first.body.data.activity.referralStatus).toBe('OPEN');
    const listed = await api(member.cookie).get(`/communities/${publicId}/referrals?limit=1`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.items[0].details.requiredSkills).toEqual(['React', 'TypeScript']);
    expect(listed.body.data.items[0].author).not.toHaveProperty('email');
    expect(
      (await api(member.cookie).get(`/communities/${publicId}/referral-needs`)).body.data.items[0].id
    ).toBe(needId);
    expect(
      (await api(member.cookie).get(`/referrals/opportunities/${opportunityId}`)).body.data.opportunity.status
    ).toBe('OPEN');
    expect((await api(member.cookie).get(`/referrals/needs/${needId}`)).body.data.need.status).toBe('OPEN');
    expect(
      (
        await publish(publicId, owner.cookie, 'referral', {
          ...opportunity,
          jobUrl: 'http://example.com/job'
        })
      ).status
    ).toBe(400);
    expect((await publish(publicId, outsider.cookie, 'referral', opportunity)).status).toBe(403);
  });

  it('protects private community and pending member access', async () => {
    const privateOpportunity = await publish(privateId, owner.cookie, 'referral', opportunity);
    expect(privateOpportunity.status).toBe(201);
    const privateOpportunityId = privateOpportunity.body.data.activity.id;
    expect((await api(outsider.cookie).get(`/communities/${privateId}/referrals`)).status).toBe(403);
    expect((await api(outsider.cookie).get(`/referrals/opportunities/${privateOpportunityId}`)).status).toBe(
      403
    );
    expect((await api(member.cookie).get(`/referrals/opportunities/${privateOpportunityId}`)).status).toBe(
      403
    );
    expect(
      (
        await api(member.cookie).post(
          `/referrals/opportunities/${privateOpportunityId}/applications`,
          application
        )
      ).status
    ).toBe(403);
  });

  it('creates one private application, protects review, and enforces the state machine', async () => {
    expect(
      (await api(owner.cookie).post(`/referrals/opportunities/${opportunityId}/applications`, application))
        .status
    ).toBe(403);
    const created = await api(member.cookie).post(
      `/referrals/opportunities/${opportunityId}/applications`,
      application
    );
    expect(created.status).toBe(201);
    appId = created.body.data.application.id;
    expect(created.body.data.application).not.toHaveProperty('applicantId');
    expect(
      (await api(member.cookie).post(`/referrals/opportunities/${opportunityId}/applications`, application))
        .status
    ).toBe(409);
    expect(
      (await api(outsider.cookie).get(`/referrals/opportunities/${opportunityId}/applications`)).status
    ).toBe(403);
    expect(
      (await api(member.cookie).get(`/referrals/opportunities/${opportunityId}/applications`)).status
    ).toBe(403);
    const ownerView = await api(owner.cookie).get(
      `/referrals/opportunities/${opportunityId}/applications?limit=1`
    );
    expect(ownerView.body.data.items[0].applicant.username).toBe('referral-member');
    expect(ownerView.body.data.items[0].introduction).toBe(application.introduction);
    expect(
      (await api(member.cookie).patch(`/referrals/applications/${appId}/status`, { status: 'ACCEPTED' }))
        .status
    ).toBe(403);
    expect(
      (await api(owner.cookie).patch(`/referrals/applications/${appId}/status`, { status: 'SUBMITTED' }))
        .status
    ).toBe(403);
    expect(
      (await api(owner.cookie).patch(`/referrals/applications/${appId}/status`, { status: 'ACCEPTED' })).body
        .data.application.status
    ).toBe('ACCEPTED');
    expect(
      (await api(owner.cookie).patch(`/referrals/applications/${appId}/status`, { status: 'SUBMITTED' })).body
        .data.application.status
    ).toBe('SUBMITTED');
    expect(
      (await api(owner.cookie).patch(`/referrals/applications/${appId}/status`, { status: 'COMPLETED' })).body
        .data.application.status
    ).toBe('COMPLETED');
    expect(
      (await api(owner.cookie).patch(`/referrals/applications/${appId}/status`, { status: 'ACCEPTED' }))
        .status
    ).toBe(403);
    expect(
      (await api(member.cookie).get(`/referrals/opportunities/${opportunityId}`)).body.data.opportunity
        .myApplication.status
    ).toBe('COMPLETED');
    expect((await api(member.cookie).get('/referrals/applications/me')).body.data.items[0].target.id).toBe(
      opportunityId
    );
    expect(
      (await api(owner.cookie).delete(`/communities/${publicId}/activities/${opportunityId}`)).status
    ).toBe(409);
  });

  it('creates one private offer and keeps acceptance separate from submission', async () => {
    expect((await api(owner.cookie).post(`/referrals/needs/${needId}/offers`, offer)).status).toBe(403);
    const created = await api(helper.cookie).post(`/referrals/needs/${needId}/offers`, offer);
    expect(created.status).toBe(201);
    offerId = created.body.data.offer.id;
    expect((await api(helper.cookie).post(`/referrals/needs/${needId}/offers`, offer)).status).toBe(409);
    expect((await api(member.cookie).get(`/referrals/needs/${needId}/offers`)).status).toBe(403);
    expect((await api(owner.cookie).get(`/referrals/needs/${needId}/offers`)).body.data.items[0].id).toBe(
      offerId
    );
    expect(
      (await api(helper.cookie).patch(`/referrals/offers/${offerId}/status`, { status: 'ACCEPTED' })).status
    ).toBe(403);
    expect(
      (await api(owner.cookie).patch(`/referrals/offers/${offerId}/status`, { status: 'ACCEPTED' })).body.data
        .offer.status
    ).toBe('ACCEPTED');
    expect((await api(owner.cookie).post(`/referrals/needs/${needId}/fulfill`)).status).toBe(409);
    expect(
      (await api(helper.cookie).patch(`/referrals/offers/${offerId}/status`, { status: 'SUBMITTED' })).body
        .data.offer.status
    ).toBe('SUBMITTED');
    expect((await api(owner.cookie).post(`/referrals/needs/${needId}/fulfill`)).body.data.need.status).toBe(
      'FULFILLED'
    );
    expect((await api(helper.cookie).get('/referrals/offers/me')).body.data.items[0].target.id).toBe(needId);
    expect((await api(helper.cookie).get(`/referrals/needs/${needId}`)).body.data.need.myOffer.status).toBe(
      'SUBMITTED'
    );
  });

  it('supports owner updates, closure, status filters, and paginated dashboard lists', async () => {
    const extra = await publish(publicId, owner.cookie, 'referral', {
      ...opportunity,
      jobTitle: 'Platform Engineer'
    });
    const extraId = extra.body.data.activity.id;
    expect(
      (await api(member.cookie).patch(`/referrals/opportunities/${extraId}`, { details: opportunity })).status
    ).toBe(403);
    expect(
      (
        await api(owner.cookie).patch(`/referrals/opportunities/${extraId}`, {
          details: { ...opportunity, jobTitle: 'Senior Platform Engineer' }
        })
      ).body.data.opportunity.details.jobTitle
    ).toBe('Senior Platform Engineer');
    expect(
      (await api(owner.cookie).post(`/referrals/opportunities/${extraId}/close`)).body.data.opportunity.status
    ).toBe('CLOSED');
    expect(
      (await api(member.cookie).post(`/referrals/opportunities/${extraId}/applications`, application)).status
    ).toBe(409);
    expect(
      (await api(owner.cookie).patch(`/referrals/opportunities/${extraId}`, { details: opportunity })).status
    ).toBe(409);
    const closed = await api(member.cookie).get(`/communities/${publicId}/referrals?status=CLOSED`);
    expect(closed.body.data.items.map((item: { id: string }) => item.id)).toContain(extraId);
    const dashboard = await api(owner.cookie).get('/referrals/opportunities/me?limit=1');
    expect(dashboard.body.data.hasMore).toBe(true);
    const next = await api(owner.cookie).get(
      `/referrals/opportunities/me?limit=1&cursor=${dashboard.body.data.nextCursor}`
    );
    expect(next.body.data.items[0].id).not.toBe(dashboard.body.data.items[0].id);
    expect((await api(owner.cookie).get('/referrals/needs/me')).body.data.items[0].status).toBe('FULFILLED');
  });

  it('rejects stale concurrent status updates atomically', async () => {
    const other = await publish(publicId, owner.cookie, 'referral', {
      ...opportunity,
      jobTitle: 'Data Engineer'
    });
    const otherId = other.body.data.activity.id;
    const created = await api(helper.cookie).post(
      `/referrals/opportunities/${otherId}/applications`,
      application
    );
    const responseId = created.body.data.application.id;
    const outcomes = await Promise.all([
      api(owner.cookie).patch(`/referrals/applications/${responseId}/status`, { status: 'ACCEPTED' }),
      api(owner.cookie).patch(`/referrals/applications/${responseId}/status`, { status: 'DECLINED' })
    ]);
    expect(outcomes.map((result) => result.status).sort()).toEqual([200, 409]);
  });
});
