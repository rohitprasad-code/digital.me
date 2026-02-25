import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  LLMProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
} from "../provider";
import type { EmbeddingProvider } from "../embeddings";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Get one from https://aistudio.google.com/apikey",
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

const DEFAULT_MODEL = "gemini-2.0-flash";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-004";

/**
 * Convert our unified ChatMessage[] into Gemini's format.
 * Gemini uses { role: 'user' | 'model', parts: [{ text }] } and a separate systemInstruction.
 */
function toGeminiMessages(messages: ChatMessage[]) {
  const systemMessages = messages.filter((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const systemInstruction =
    systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join("\n")
      : undefined;

  const history = chatMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  return { systemInstruction, history };
}

export class GeminiProvider implements LLMProvider {
  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const genAI = getGenAI();
    const modelName =
      options?.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const { systemInstruction, history } = toGeminiMessages(messages);

    const model = genAI.getGenerativeModel({
      model: modelName,
      ...(systemInstruction ? { systemInstruction } : {}),
    });

    // Pull the last user message as the prompt; everything else is history
    const lastMessage = history.pop();
    if (!lastMessage) throw new Error("No messages provided");

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const text = result.response.text();

    return { content: text };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncIterable<string> {
    const genAI = getGenAI();
    const modelName =
      options?.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const { systemInstruction, history } = toGeminiMessages(messages);

    const model = genAI.getGenerativeModel({
      model: modelName,
      ...(systemInstruction ? { systemInstruction } : {}),
    });

    const lastMessage = history.pop();
    if (!lastMessage) throw new Error("No messages provided");

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage.parts[0].text);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }

  async healthCheck(): Promise<void> {
    const genAI = getGenAI();
    const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const model = genAI.getGenerativeModel({ model: modelName });

    // Lightweight call to verify connectivity
    await model.generateContent("ping");
  }
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: DEFAULT_EMBEDDING_MODEL });

    const result = await model.embedContent(text);
    return result.embedding.values;
  }
}
