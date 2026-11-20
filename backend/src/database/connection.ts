import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Skill from '../modules/skills/model/Skill.js';
import { catalogUpserts, skillSeeds } from './catalogSeeds.js';

export async function connectDatabase() {
  if (!env.mongoUri) {
    console.info('MongoDB is not configured; account routes will be unavailable.');
    return;
  }
  try {
    await mongoose.connect(env.mongoUri);
    await Skill.bulkWrite(catalogUpserts(skillSeeds));
    console.info('Connected to MongoDB.');
  } catch (error) {
    console.error('MongoDB connection failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
