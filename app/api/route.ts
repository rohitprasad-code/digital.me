import { NextResponse } from "next/server";
import { getLLMProvider } from "@/model/llm/provider";

export async function GET() {
  try {
    const provider = getLLMProvider();
    await provider.healthCheck();
    return NextResponse.json({ status: "running", message: "Digital-Me is running" });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { error: "Service Unavailable: AI Backend is offline" },
      {
        status: 503,
        statusText: "Service Unavailable",
      }
    );
  }
}