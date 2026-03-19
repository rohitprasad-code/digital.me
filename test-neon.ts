import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { VectorStore } from "./memory/vector_store/index";

async function runTest() {
  console.log("Testing Neon Postgres connection and initialization...");
  const store = new VectorStore();
  
  try {
    // This will trigger the CREATE EXTENSION and CREATE TABLE logic
    await store.load();
    console.log("✅ Successfully connected to Neon Postgres and initialized schemas!");
    
    // Optional: Fetch any existing documents to prove it's connected
    const docs = await store.getAllDocuments();
    console.log(`✅ Loaded ${docs.length} documents from the database.`);
  } catch (error) {
    console.error("❌ Failed to connect to Neon Postgres:", error);
  }
  process.exit(0);
}

runTest();
