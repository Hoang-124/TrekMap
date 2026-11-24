import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import { seedAll13Collections } from '../utils/seedDatabase.js';

dotenv.config();

const run = async () => {
  console.log('[LOST Database Seeder CLI]');
  const connected = await connectDB();
  if (!connected) {
    console.error('[Seeder] Failed to connect to MongoDB. Aborting.');
    process.exit(1);
  }
  const ok = await seedAll13Collections();
  await disconnectDB();
  if (!ok) {
    console.error('[Seeder] Database seeding encountered errors.');
    process.exit(1);
  }
  console.log('[Seeder] Database seeding process completed successfully.');
  process.exit(0);
};

run().catch((err) => {
  console.error('[Seeder] Script failed:', err);
  process.exit(1);
});
