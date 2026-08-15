import { getLLMProvider } from "../providers/provider";

export async function verifyGrounding(
  context: string,
  response: string,
  providerName?: string
): Promise<{ safe: boolean; feedback?: string }> {
  if (!context || !context.trim()) {
    return { safe: true };
  }

  const provider = getLLMProvider(providerName);

  const systemPrompt = `You are a strict factual grounding checker. Your job is to verify if the Assistant's Response is fully grounded in and supported by the provided Context.
Analyze each claim in the response carefully.

Guidelines:
- Do not flag natural conversational bridge assumptions as unsafe (e.g., assuming the user is on their Mac/computer when the context shows active desktop apps like 'Brave Browser', or using default pronouns/names).
- Only flag concrete factual contradictions or entirely unsupported specific external facts (like claiming a job, project, or sport activity not supported by the context).

Context:
${context}

Assistant's Response:
${response}

Respond in the following format:
If the response is fully supported and contains no hallucinations or outside info, output:
SAFE

If the response contains any facts, years, technologies, stats, or assertions NOT supported by the Context, output:
UNSAFE: <1-sentence description of the hallucinated or unsupported fact>

Do not include any other text, reasoning, or markdown. Output only the exact required prefix.`;

  try {
    const result = await provider.chat([
      { role: "system", content: systemPrompt }
    ]);

    const content = result.content.trim();
    if (content.toUpperCase().startsWith("SAFE")) {
      return { safe: true };
    }

    if (content.toUpperCase().startsWith("UNSAFE:")) {
      const feedback = content.substring(7).trim();
      return { safe: false, feedback };
    }

    // Default fallback if response doesn't match expected pattern but isn't explicitly SAFE
    return { safe: false, feedback: "Response may contain unsupported claims." };
  } catch (error) {
    console.error("Grounding check failed:", error);
    return { safe: true };
  }
}
