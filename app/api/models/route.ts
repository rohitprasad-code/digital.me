import { NextResponse } from "next/server";
import { getLLMProvider } from "@/model/llm/provider";

export async function GET() {
  const models = [
    { id: "ollama", name: "Ollama (Local)" },
    { id: "groq", name: "Groq (Fast)" },
    { id: "gemini", name: "Gemini (Google)" },
  ];

  const availableModels = [];

  for (const model of models) {
    try {
      const provider = getLLMProvider(model.id);
      await provider.healthCheck();
      availableModels.push(model);
    } catch (error) {
      console.log(
        `Model ${model.id} is not available:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return NextResponse.json({ models: availableModels });
}
