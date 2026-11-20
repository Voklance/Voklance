import { createServer, type Server as HttpServer } from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { attachSocketServer } from '../../realtime/socketServer.js';
import User from '../users/model/User.js';
import Profile from '../profiles/model/Profile.js';
import Connection from '../connections/model/Connection.js';
import Conversation from './model/Conversation.js';
import ConversationParticipantState from './model/ConversationParticipantState.js';
import Message from './model/Message.js';
import MessageReport from './model/MessageReport.js';
import UserBlock from './model/UserBlock.js';
import Session from '../auth/model/Session.js';

let mongo: MongoMemoryServer;
let http: HttpServer;
let socketServer: ReturnType<typeof attachSocketServer>;
let port = 0;
const accounts: { id: string; cookie: string; username: string }[] = [];
const clients: ClientSocket[] = [];
const auth = (index: number) => ({ Cookie: accounts[index].cookie });
function connect(index: number, cookie = accounts[index].cookie) {
  const socket = ioClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    reconnection: false,
    extraHeaders: { Origin: 'http://localhost:5173', Cookie: cookie }
  });
  clients.push(socket);
  return socket;
}
function connected(socket: ClientSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}
function denied(socket: ClientSocket) {
  return new Promise<void>((resolve) => socket.once('connect_error', () => resolve()));
}
function emitAck<T>(socket: ClientSocket, event: string, payload: unknown) {
  return new Promise<{ ok: boolean; data?: T; code?: string }>((resolve) =>
    socket.emit(event, payload, resolve)
  );
}
async function makeConversation() {
  const response = await request(app)
    .post('/api/v1/conversations')
    .set(auth(0))
    .send({ recipientId: accounts[1].id });
  expect(response.status).toBe(201);
  return response.body.data.conversation.id as string;
}
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    Connection.init(),
    Conversation.init(),
    ConversationParticipantState.init(),
    Message.init(),
    MessageReport.init(),
    UserBlock.init()
  ]);
  for (let index = 0; index < 4; index++) {
    const result = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: `Message User ${index}`,
        email: `message${index}@example.test`,
        password: 'password-123'
      });
    const id = result.body.data.user.id as string;
    accounts.push({
      id,
      cookie: String(result.headers['set-cookie']?.[0]).split(';')[0],
      username: `message-user-${index}`
    });
    await User.updateOne({ _id: id }, { $set: { onboardingStatus: 'COMPLETED' } });
    await Profile.create({
      userId: id,
      username: accounts[index].username,
      fullName: `Message User ${index}`,
      headline: 'Engineer',
      country: 'India',
      visibility: 'PUBLIC'
    });
  }
  const [low, high] = [accounts[0].id, accounts[1].id].sort();
  await Connection.create({
    userLowId: low,
    userHighId: high,
    requesterId: accounts[0].id,
    recipientId: accounts[1].id,
    status: 'accepted',
    requestedAt: new Date(),
    respondedAt: new Date()
  });
  http = createServer(app);
  socketServer = attachSocketServer(http);
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', () => resolve()));
  port = (http.address() as { port: number }).port;
}, 120_000);
beforeEach(async () => {
  await Promise.all([
    Conversation.deleteMany({}),
    ConversationParticipantState.deleteMany({}),
    Message.deleteMany({}),
    MessageReport.deleteMany({}),
    UserBlock.deleteMany({})
  ]);
  await Connection.updateMany({}, { $set: { status: 'accepted' } });
  await Profile.updateMany(
    {},
    { $set: { allowDirectMessages: true, showReadReceipts: false, showOnlineStatus: true } }
  );
});
afterEach(() => {
  for (const socket of clients.splice(0)) socket.disconnect();
});
afterAll(async () => {
  await new Promise<void>((resolve) => socketServer.close(() => resolve()));
  if (http.listening) await new Promise<void>((resolve) => http.close(() => resolve()));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('direct messaging REST and sockets', () => {
  it('requires an accepted pair, creates one conversation, and restricts access', async () => {
    expect(
      (await request(app).post('/api/v1/conversations').send({ recipientId: accounts[1].id })).status
    ).toBe(401);
    expect(
      (await request(app).post('/api/v1/conversations').set(auth(0)).send({ recipientId: accounts[2].id }))
        .status
    ).toBe(404);
    const id = await makeConversation();
    expect(
      (await request(app).post('/api/v1/conversations').set(auth(1)).send({ recipientId: accounts[0].id }))
        .body.data.conversation.id
    ).toBe(id);
    expect(await Conversation.countDocuments()).toBe(1);
    expect((await request(app).get(`/api/v1/conversations/${id}`).set(auth(2))).status).toBe(404);
    expect(
      (await request(app).get('/api/v1/conversations').set(auth(0))).body.data.items[0].person.name
    ).toBe('Message User 1');
  });
  it('persists idempotent text, pages history, counts unread, and moves read position forward', async () => {
    const id = await makeConversation();
    const firstId = crypto.randomUUID();
    const first = await request(app)
      .post(`/api/v1/conversations/${id}/messages`)
      .set(auth(0))
      .send({ body: 'Hello', clientMessageId: firstId });
    expect(first.status).toBe(201);
    expect(
      (
        await request(app)
          .post(`/api/v1/conversations/${id}/messages`)
          .set(auth(0))
          .send({ body: 'Hello', clientMessageId: firstId })
      ).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/v1/conversations/${id}/messages`)
          .set(auth(0))
          .send({ body: 'Changed', clientMessageId: firstId })
      ).status
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`/api/v1/conversations/${id}/messages`)
          .set(auth(0))
          .send({ body: 'x'.repeat(2001), clientMessageId: crypto.randomUUID() })
      ).status
    ).toBe(400);
    const second = await request(app)
      .post(`/api/v1/conversations/${id}/messages`)
      .set(auth(0))
      .send({ body: 'Second', clientMessageId: crypto.randomUUID() });
    const page = await request(app).get(`/api/v1/conversations/${id}/messages?limit=1`).set(auth(1));
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.hasMore).toBe(true);
    expect((await request(app).get('/api/v1/conversations/unread-count').set(auth(1))).body.data.count).toBe(
      2
    );
    expect(
      (
        await request(app)
          .post(`/api/v1/conversations/${id}/read`)
          .set(auth(0))
          .send({ messageId: first.body.data.message.id })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`/api/v1/conversations/${id}/read`)
          .set(auth(1))
          .send({ messageId: second.body.data.message.id })
      ).status
    ).toBe(200);
    expect((await request(app).get('/api/v1/conversations/unread-count').set(auth(1))).body.data.count).toBe(
      0
    );
    const backward = await request(app)
      .post(`/api/v1/conversations/${id}/read`)
      .set(auth(1))
      .send({ messageId: first.body.data.message.id });
    expect(backward.body.data.changed).toBe(false);
  });
  it('authenticates sockets, authorizes rooms, sends privately and emits an acknowledgement', async () => {
    const id = await makeConversation();
    const invalid = connect(2, 'voklance_session=bad');
    await denied(invalid);
    const a = connect(0),
      b = connect(1),
      outsider = connect(2);
    await Promise.all([connected(a), connected(b), connected(outsider)]);
    expect((await emitAck(outsider, 'conversation:join', { conversationId: id })).ok).toBe(false);
    expect((await emitAck(a, 'conversation:join', { conversationId: id })).ok).toBe(true);
    expect((await emitAck(b, 'conversation:join', { conversationId: id })).ok).toBe(true);
    let leaked = false;
    outsider.on('message:new', () => {
      leaked = true;
    });
    const incoming = new Promise<{ body: string }>((resolve) => b.once('message:new', resolve));
    const result = await emitAck<{ message: { body: string } }>(a, 'message:send', {
      conversationId: id,
      body: 'Live hello',
      clientMessageId: crypto.randomUUID()
    });
    expect(result.ok).toBe(true);
    expect(result.data?.message.body).toBe('Live hello');
    expect((await incoming).body).toBe('Live hello');
    expect(leaked).toBe(false);
    expect(await Message.countDocuments()).toBe(1);
  });
  it('enforces blocking, preferences, reporting, and connection removal', async () => {
    const id = await makeConversation();
    const muted = await request(app)
      .patch(`/api/v1/conversations/${id}/preferences`)
      .set(auth(1))
      .send({ muted: true });
    expect(muted.body.data.preferences.muted).toBe(true);
    const message = await request(app)
      .post(`/api/v1/conversations/${id}/messages`)
      .set(auth(0))
      .send({ body: 'Reportable', clientMessageId: crypto.randomUUID() });
    expect((await request(app).get('/api/v1/conversations/unread-count').set(auth(1))).body.data.count).toBe(
      1
    );
    expect(
      (
        await request(app)
          .post(`/api/v1/messages/${message.body.data.message.id}/report`)
          .set(auth(1))
          .send({ reason: 'spam' })
      ).status
    ).toBe(201);
    expect(
      (
        await request(app)
          .post(`/api/v1/messages/${message.body.data.message.id}/report`)
          .set(auth(2))
          .send({ reason: 'spam' })
      ).status
    ).toBe(404);
    expect((await request(app).post(`/api/v1/users/${accounts[0].id}/block`).set(auth(1))).status).toBe(200);
    expect((await request(app).get('/api/v1/conversations/unread-count').set(auth(1))).body.data.count).toBe(
      0
    );
    expect(
      (
        await request(app)
          .post(`/api/v1/conversations/${id}/messages`)
          .set(auth(0))
          .send({ body: 'Blocked', clientMessageId: crypto.randomUUID() })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post('/api/v1/connections/requests')
          .set(auth(0))
          .send({ recipientId: accounts[1].id })
      ).status
    ).toBe(404);
    expect((await request(app).delete(`/api/v1/users/${accounts[0].id}/block`).set(auth(1))).status).toBe(
      200
    );
    expect((await request(app).get('/api/v1/conversations/unread-count').set(auth(1))).body.data.count).toBe(
      1
    );
    await Connection.updateOne({}, { $set: { status: 'removed' } });
    expect((await request(app).get('/api/v1/conversations/unread-count').set(auth(1))).body.data.count).toBe(
      0
    );
    expect((await request(app).get(`/api/v1/conversations/${id}/messages`).set(auth(0))).status).toBe(404);
  });
  it('keeps typing and presence private across multiple sockets', async () => {
    const id = await makeConversation();
    const a = connect(0),
      b1 = connect(1),
      b2 = connect(1),
      outsider = connect(2);
    await Promise.all([connected(a), connected(b1), connected(b2), connected(outsider)]);
    expect(
      (await emitAck<{ online: boolean }>(a, 'presence:subscribe', { userId: accounts[1].id })).data?.online
    ).toBe(true);
    expect((await emitAck(outsider, 'presence:subscribe', { userId: accounts[1].id })).ok).toBe(false);
    await Promise.all([
      emitAck(a, 'conversation:join', { conversationId: id }),
      emitAck(b1, 'conversation:join', { conversationId: id })
    ]);
    let leaked = false;
    outsider.on('typing:started', () => {
      leaked = true;
    });
    const typing = new Promise<{ conversationId: string }>((resolve) => b1.once('typing:started', resolve));
    expect((await emitAck(a, 'typing:start', { conversationId: id })).ok).toBe(true);
    expect((await typing).conversationId).toBe(id);
    expect(leaked).toBe(false);
    b1.disconnect();
    const offline = new Promise<{ online: boolean }>((resolve) => a.once('presence:changed', resolve));
    b2.disconnect();
    expect((await offline).online).toBe(false);
  });
  it('publishes read receipts only when enabled and keeps muted unread state', async () => {
    const id = await makeConversation();
    await Profile.updateOne({ userId: accounts[1].id }, { $set: { showReadReceipts: true } });
    await request(app).patch(`/api/v1/conversations/${id}/preferences`).set(auth(1)).send({ muted: true });
    const a = connect(0),
      b = connect(1);
    await Promise.all([connected(a), connected(b)]);
    let notified = false;
    b.on('notification:new', () => {
      notified = true;
    });
    const incoming = new Promise<{ id: string }>((resolve) => b.once('message:new', resolve));
    const sent = await emitAck<{ message: { id: string } }>(a, 'message:send', {
      conversationId: id,
      body: 'Read me',
      clientMessageId: crypto.randomUUID()
    });
    expect(sent.ok).toBe(true);
    const message = await incoming;
    expect(notified).toBe(false);
    expect((await request(app).get('/api/v1/conversations/unread-count').set(auth(1))).body.data.count).toBe(
      1
    );
    const receipt = new Promise<{ messageId: string }>((resolve) => a.once('message:read', resolve));
    expect((await emitAck(b, 'message:read', { conversationId: id, messageId: message.id })).ok).toBe(true);
    expect((await receipt).messageId).toBe(message.id);
    expect((await request(app).get('/api/v1/conversations/unread-count').set(auth(1))).body.data.count).toBe(
      0
    );
  });
  it('rejects socket sends after privacy change and reconnects with missed history', async () => {
    const id = await makeConversation();
    const a = connect(0),
      b = connect(1);
    await Promise.all([connected(a), connected(b)]);
    await emitAck(a, 'conversation:join', { conversationId: id });
    a.disconnect();
    await request(app)
      .post(`/api/v1/conversations/${id}/messages`)
      .set(auth(1))
      .send({ body: 'While away', clientMessageId: crypto.randomUUID() });
    const again = connect(0);
    await connected(again);
    expect((await emitAck(again, 'conversation:join', { conversationId: id })).ok).toBe(true);
    expect(
      (await request(app).get(`/api/v1/conversations/${id}/messages`).set(auth(0))).body.data.items[0].body
    ).toBe('While away');
    await request(app)
      .patch('/api/v1/profiles/me/messaging-settings')
      .set(auth(1))
      .send({ allowDirectMessages: false });
    expect(
      (
        await emitAck(again, 'message:send', {
          conversationId: id,
          body: 'Denied',
          clientMessageId: crypto.randomUUID()
        })
      ).ok
    ).toBe(false);
    expect((await request(app).get(`/api/v1/conversations/${id}`).set(auth(0))).status).toBe(404);
  });
  it('disconnects a socket on logout and rejects an expired session', async () => {
    const socket = connect(0);
    await connected(socket);
    const disconnected = new Promise<void>((resolve) => socket.once('disconnect', () => resolve()));
    expect((await request(app).post('/api/v1/auth/logout').set(auth(0))).status).toBe(200);
    await disconnected;
    const rejected = connect(0);
    await denied(rejected);
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'Expired User', email: 'expired-message@example.test', password: 'password-123' });
    const id = signup.body.data.user.id as string;
    const cookie = String(signup.headers['set-cookie']?.[0]).split(';')[0];
    await User.updateOne({ _id: id }, { $set: { onboardingStatus: 'COMPLETED' } });
    await Session.updateOne({ userId: id }, { $set: { expiresAt: new Date('2020-01-01') } });
    const expired = connect(2, cookie);
    await denied(expired);
  });
});
