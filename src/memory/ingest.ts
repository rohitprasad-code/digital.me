import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
import { VectorStore } from './vector_store/index';

async function ingest() {
  const vectorStore = new VectorStore();
  
  console.log('Clearing existing vector store...');
  await vectorStore.clear();

  // 1. Ingest me.json
  try {
    const meJsonPath = path.resolve(process.cwd(), 'src/memory/static/me.json');
    const meJsonContent = await fs.readFile(meJsonPath, 'utf-8');
    const meData = JSON.parse(meJsonContent);

    // Chunking strategy for JSON: Key-Value pairs or sections
    // Profile
    if (meData.profile) {
      await vectorStore.addDocument(`Profile: ${JSON.stringify(meData.profile)}`, { source: 'me.json', type: 'profile' });
    }
    // Skills
    if (meData.skills) {
       await vectorStore.addDocument(`Skills: ${meData.skills.join(', ')}`, { source: 'me.json', type: 'skills' });
    }
    // Interests
    if (meData.interests) {
       await vectorStore.addDocument(`Interests: ${meData.interests.join(', ')}`, { source: 'me.json', type: 'interests' });
    }
    // Goals
    if (meData.goals) {
       await vectorStore.addDocument(`Goals: ${meData.goals.join(', ')}`, { source: 'me.json', type: 'goals' });
    }

    console.log('Successfully ingested me.json');
  } catch (error) {
    console.error('Error ingesting me.json:', error);
  }

  // 2. Ingest resume.pdf
  try {
    const resumePath = path.resolve(process.cwd(), 'src/memory/static/resume.pdf');
    const resumeBuffer = await fs.readFile(resumePath);
    
    // Convert Buffer to Uint8Array/ArrayBuffer if needed, but PDFParse accepts Buffer in data usually
    // The types say data?: string | number[] | ArrayBuffer | TypedArray
    // node fs.readFile returns Buffer which is Uint8Array subclass in Node.
    
    const parser = new PDFParse({ data: resumeBuffer });
    const result = await parser.getText();
    const text = result.text;
    await parser.destroy();
    
    // Simple chunking by paragraphs (double newlines)
    const paragraphs = text.split(/\n\s*\n/);
    
    for (const paragraph of paragraphs) {
      const cleanPara = paragraph.trim();
      if (cleanPara.length > 50) { // Filter out very short lines/artifacts
        await vectorStore.addDocument(cleanPara, { source: 'resume.pdf' });
      }
    }

    console.log(`Successfully ingested resume.pdf (${paragraphs.length} chunks)`);
  } catch (error) {
    console.error('Error ingesting resume.pdf:', error);
  }

  console.log('Ingestion complete!');
}

ingest().catch(console.error);
