import { ollama } from '@/model/llm/ollama/client';

export async function GET() {
  try {
    const models = await ollama.list();
    console.log("Ollama is running:", models);
    return new Response("Digital-Me is running");
  } catch (error) {
    console.error("Ollama health check failed:", error);
    return new Response("Service Unavailable: AI Backend is offline", { 
      status: 503,
      statusText: "Service Unavailable"
    });
  }
}