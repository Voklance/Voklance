import { createServer, type Server as HttpServer } from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { attachSocketServer } from '../../realtime/socketServer.js';
import User from '../users/model/User.js';
import Notification from './model/Notification.js';
import NotificationPreference from './model/NotificationPreference.js';
import NotificationOutboxEvent from './model/NotificationOutboxEvent.js';
import { createNotification } from './service/notificationService.js';
import { queueNotification, drainNotificationOutbox } from './service/notificationOutbox.js';
let mongo: MongoMemoryServer;
let http: HttpServer;
let sockets: ReturnType<typeof attachSocketServer>;
let port: number;
const accounts: { id: string; cookie: string }[] = [];
const auth = (index: number) => ({ Cookie: accounts[index].cookie });
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Notification.init(),
    NotificationPreference.init(),
    NotificationOutboxEvent.init()
  ]);
  for (let index = 0; index < 3; index++) {
    const result = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: `Notify ${index}`, email: `notify${index}@example.test`, password: 'password-123' });
    accounts.push({
      id: result.body.data.user.id,
      cookie: String(result.headers['set-cookie']?.[0]).split(';')[0]
    });
    await User.updateOne({ _id: accounts[index].id }, { $set: { onboardingStatus: 'COMPLETED' } });
  }
  http = createServer(app);
  sockets = attachSocketServer(http);
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', () => resolve()));
  port = (http.address() as { port: number }).port;
}, 120_000);
beforeEach(async () => {
  await Promise.all([
    Notification.deleteMany({}),
    NotificationPreference.deleteMany({}),
    NotificationOutboxEvent.deleteMany({})
  ]);
});
afterAll(async () => {
  await new Promise<void>((resolve) => sockets.close(() => resolve()));
  if (http.listening) await new Promise<void>((resolve) => http.close(() => resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});
describe('persistent notifications', () => {
  it('queues an event once and safely replays it', async () => {
    const input = {
      recipientId: accounts[1].id,
      actorId: accounts[0].id,
      type: 'CONNECTION_REQUEST_RECEIVED' as const,
      entityType: 'connection_request' as const,
      entityId: new mongoose.Types.ObjectId().toString(),
      deduplicationKey: 'queued-once'
    };
    await queueNotification(input);
    await queueNotification(input);
    await drainNotificationOutbox();
    expect(await NotificationOutboxEvent.countDocuments()).toBe(1);
    expect(await Notification.countDocuments()).toBe(1);
    expect((await NotificationOutboxEvent.findOne().lean())?.status).toBe('processed');
  });
  it('deduplicates, pages, filters, counts, and protects ownership', async () => {
    const input = {
      recipientId: accounts[1].id,
      actorId: accounts[0].id,
      type: 'CONNECTION_REQUEST_RECEIVED' as const,
      entityType: 'connection_request' as const,
      entityId: new mongoose.Types.ObjectId().toString(),
      deduplicationKey: 'connection:1:received'
    };
    expect(await createNotification(input)).toBeTruthy();
    expect(await createNotification(input)).toBeNull();
    expect(
      (await request(app).get('/api/v1/notifications/unread-count').set(auth(1))).body.data.unreadCount
    ).toBe(1);
    expect(
      (await request(app).get('/api/v1/notifications?category=network&limit=1').set(auth(1))).body.data.items
    ).toHaveLength(1);
    expect((await request(app).get('/api/v1/notifications').set(auth(2))).body.data.items).toHaveLength(0);
    const id = (await Notification.findOne({ recipientId: accounts[1].id }).lean())!._id.toString();
    expect((await request(app).patch(`/api/v1/notifications/${id}/read`).set(auth(2))).status).toBe(404);
    expect(
      (await request(app).patch(`/api/v1/notifications/${id}/read`).set(auth(1))).body.data.notification
        .readAt
    ).toBeTruthy();
    expect((await request(app).patch(`/api/v1/notifications/${id}/read`).set(auth(1))).status).toBe(200);
    expect(
      (await request(app).get('/api/v1/notifications/unread-count').set(auth(1))).body.data.unreadCount
    ).toBe(0);
  });
  it('respects category preferences and marks only the current user’s notifications read', async () => {
    const preference = await request(app)
      .patch('/api/v1/notifications/preferences')
      .set(auth(1))
      .send({ preferences: { network: false } });
    expect(preference.body.data.preferences.network).toBe(false);
    const base = {
      recipientId: accounts[1].id,
      actorId: accounts[0].id,
      entityType: 'connection_request' as const,
      entityId: new mongoose.Types.ObjectId().toString()
    };
    expect(
      await createNotification({
        ...base,
        type: 'CONNECTION_REQUEST_RECEIVED',
        deduplicationKey: 'suppressed'
      })
    ).toBeNull();
    await createNotification({
      ...base,
      type: 'MESSAGE_RECEIVED',
      entityType: 'conversation',
      deduplicationKey: 'message-1'
    });
    expect(
      (await request(app).patch('/api/v1/notifications/read-all').set(auth(1)).send({ category: 'messages' }))
        .body.data.affectedCount
    ).toBe(1);
    expect(
      (
        await request(app)
          .patch('/api/v1/notifications/preferences')
          .set(auth(1))
          .send({ preferences: { bad: true } })
      ).status
    ).toBe(400);
  });
  it('delivers a private socket event after persistence', async () => {
    const connect = (index: number) =>
      ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: { Origin: 'http://localhost:5173', Cookie: accounts[index].cookie }
      });
    const recipient: ClientSocket = connect(1),
      outsider: ClientSocket = connect(2);
    try {
      await Promise.all(
        [recipient, outsider].map(
          (socket) => new Promise<void>((resolve) => socket.once('connect', () => resolve()))
        )
      );
      let leaked = false;
      outsider.on('notification:new', () => {
        leaked = true;
      });
      const delivered = new Promise<{ id: string }>((resolve) => recipient.once('notification:new', resolve));
      await createNotification({
        recipientId: accounts[1].id,
        actorId: accounts[0].id,
        type: 'CONNECTION_REQUEST_RECEIVED',
        entityType: 'connection_request',
        entityId: new mongoose.Types.ObjectId().toString(),
        deduplicationKey: 'live-1'
      });
      const result = await delivered;
      expect(await Notification.exists({ _id: result.id })).toBeTruthy();
      expect(leaked).toBe(false);
    } finally {
      recipient.disconnect();
      outsider.disconnect();
    }
  });
});
