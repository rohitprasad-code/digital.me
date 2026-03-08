import { getLLMProvider } from "@/model/llm/provider";

export async function GET() {
  try {
    const provider = getLLMProvider();
    await provider.healthCheck();
    return new Response("Digital-Me is running");
  } catch (error) {
    console.error("Health check failed:", error);
    return new Response("Service Unavailable: AI Backend is offline", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}