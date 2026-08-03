import { NextResponse } from "next/server";
import { VectorStore } from "@/memory/vector_store";

const vectorStore = new VectorStore();

export async function GET() {
  try {
    await vectorStore.load();
    const documents = await vectorStore.getAllDocuments();
    // Return document chunks, stripping embeddings to save size/bandwidth
    const docsWithoutEmbeddings = documents.map(({ id, filePath, content, metadata, lastUpdatedAt, occurredAt }) => ({
      id,
      filePath,
      content,
      metadata,
      lastUpdatedAt,
      occurredAt,
    }));
    return NextResponse.json({ documents: docsWithoutEmbeddings });
  } catch (error) {
    console.error("Failed to fetch documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
