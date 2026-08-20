import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { AiKnowledgeModel } from '../models/AiKnowledge.js';

async function testDatabaseCount() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trekmap';
  await mongoose.connect(mongoUri);

  const count = await AiKnowledgeModel.countDocuments();
  console.log(`\n========================================`);
  console.log(`📊 TỔNG SỐ BẢN GHI TRI THỨC TRONG CSDL MONGODB: ${count} BẢN GHI`);

  const sample = await AiKnowledgeModel.findOne({ trailName: 'Lảo Thẩn' }).lean();
  console.log(`\n🔍 MẪU DỮ LIỆU ĐÃ NẠP TRONG DATABASE (ĐỈNH LẢO THẨN):`);
  console.log('ID:', sample?._id);
  console.log('Question:', sample?.question);
  console.log('Answer:\n', sample?.answer);

  // Test full-text search directly on MongoDB
  console.log(`\n⚡ TEST TÌM KIẾM TEXT SEARCH TRÊN MONGODB CHO TỪ KHÓA: "sốc độ cao ams"`);
  const searchResults = await AiKnowledgeModel.find(
    { $text: { $search: 'sốc độ cao ams' } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(2)
    .lean();

  console.log(`Tìm thấy: ${searchResults.length} kết quả phù hợp!`);
  searchResults.forEach((r, idx) => {
    console.log(`\n[Kết quả ${idx + 1}] (${r.category}) - ${r.question}`);
    console.log(`-> ${r.answer.slice(0, 150)}...`);
  });

  await mongoose.disconnect();
}

testDatabaseCount().catch(console.error);
