import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { AiKnowledgeModel } from '../models/AiKnowledge.js';
import { masterKnowledgeDataset } from '../data/trekkerKnowledgeDataset.js';

async function seedKnowledgeBase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trekmap';
  console.log('Connecting to MongoDB:', mongoUri);
  await mongoose.connect(mongoUri);

  console.log(`Clearing existing and seeding ${masterKnowledgeDataset.length} knowledge items...`);
  await AiKnowledgeModel.deleteMany({});

  const docs = masterKnowledgeDataset.map((item) => ({
    category: item.category,
    trailId: item.trailId,
    trailName: item.trailName,
    question: item.question,
    keywords: item.keywords,
    answer: item.answer,
    difficultyLevel: item.difficultyLevel,
    sourceOrHotline: item.sourceOrHotline,
    isActive: true,
    viewCount: 0,
  }));

  const inserted = await AiKnowledgeModel.insertMany(docs);
  console.log(`✅ Successfully stored ${inserted.length} knowledge records into MongoDB Database!`);

  await mongoose.disconnect();
}

seedKnowledgeBase().catch((err) => {
  console.error('Seed Error:', err);
  process.exit(1);
});
