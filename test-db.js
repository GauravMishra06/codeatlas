import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected Successfully");
    process.exit(0);
  } catch (err) {
    console.error("MongoDB Error:", err);
    process.exit(1);
  }
}
test();
