import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { seedAll13Collections } from '../utils/seedDatabase.js';

dotenv.config();

const run = async () => {
  console.log('🚀 [TrekMap Database Seeder CLI]');
  await connectDB();
  await seedAll13Collections();
  console.log('✨ Database seeding process completed successfully!');
  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Seeder script failed:', err);
  process.exit(1);
});
