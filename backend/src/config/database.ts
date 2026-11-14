import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.info('MONGODB_URI is not set; starting API without a database connection.');
    return;
  }

  try {
    await mongoose.connect(uri);
    console.info('Connected to MongoDB.');
  } catch (error: unknown) {
    console.error(
      'MongoDB connection failed:',
      error instanceof Error ? error.message : error
    );
  }
}
