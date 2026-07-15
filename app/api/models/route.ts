import { NextResponse } from "next/server";
import { getLLMProvider, AVAILABLE_PROVIDERS } from "@/model/providers/provider";

export async function GET() {
  const availableModels = [];

  for (const model of AVAILABLE_PROVIDERS) {
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
