import { NextResponse } from "next/server";
import { VectorStore } from "@/memory/vector_store";

const vectorStore = new VectorStore();

export async function GET() {
  try {
    await vectorStore.load();
    const logs = await vectorStore.getHallucinations();
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Failed to fetch hallucination logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
