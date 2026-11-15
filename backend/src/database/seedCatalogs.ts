import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Interest from '../modules/interests/model/Interest.js';
import Skill from '../modules/skills/model/Skill.js';
import { catalogUpserts, interestSeeds, skillSeeds } from './catalogSeeds.js';

if (!env.mongoUri) throw new Error('MONGODB_URI is required to seed catalogs.');

try {
  await mongoose.connect(env.mongoUri);
  await Skill.bulkWrite(catalogUpserts(skillSeeds));
  await Interest.bulkWrite(catalogUpserts(interestSeeds));
  console.info('Skill and interest catalogs are ready.');
} finally {
  await mongoose.disconnect();
}
