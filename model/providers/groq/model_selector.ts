import Groq from "groq-sdk";

let cachedModel: string | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

interface GroqModel {
  id: string;
  active?: boolean;
  supported_features?: string[];
  context_window?: number;
  context_length?: number;
}

const PREFERRED_MODEL_PATTERNS = [
  /llama-3\.3-70b/i,
  /llama-3\.1-70b/i,
  /qwen-3\.6-27b/i,
  /qwen-3.*-27b/i,
  /qwen.*-72b/i,
  /qwen.*-27b/i,
  /llama-3\.1-8b/i,
  /llama3-70b/i,
  /llama3-8b/i,
];

/**
 * Automatically selects the best available Groq model that supports tool calling.
 * Falls back to a default if the auto-selection fails.
 */
export async function getBestGroqModel(groq: Groq): Promise<string> {
  const configModel = process.env.GROQ_CHAT_MODEL;
  if (configModel && configModel !== "auto") {
    return configModel;
  }

  const now = Date.now();
  if (cachedModel && (now - lastFetchTime < CACHE_TTL)) {
    return cachedModel;
  }

  try {
    const modelsList = await groq.models.list();
    
    // Cast list data to GroqModel[]
    const models = modelsList.data as unknown as GroqModel[];

    // Filter active models that explicitly support tool calling
    const candidates = models.filter((m: GroqModel) => {
      // Ignore inactive models
      if (m.active === false) return false;
      
      const features = m.supported_features || [];
      return features.includes("tools");
    });

    if (candidates.length > 0) {
      // Sort candidates by preference list first, then context window size
      candidates.sort((a: GroqModel, b: GroqModel) => {
        const getPreferenceIndex = (modelId: string) => {
          const index = PREFERRED_MODEL_PATTERNS.findIndex(pattern => pattern.test(modelId));
          return index === -1 ? PREFERRED_MODEL_PATTERNS.length : index;
        };

        const prefA = getPreferenceIndex(a.id);
        const prefB = getPreferenceIndex(b.id);

        if (prefA !== prefB) {
          return prefA - prefB;
        }

        const aWindow = a.context_window || a.context_length || 0;
        const bWindow = b.context_window || b.context_length || 0;
        return bWindow - aWindow;
      });

      cachedModel = candidates[0].id;
      lastFetchTime = now;
      console.log(`🤖 Auto-selected Groq model: ${cachedModel}`);
      return cachedModel;
    }
  } catch (error) {
    console.error("Failed to auto-detect Groq models:", error);
  }

  // Safe fallback if listing fails or no tool-capable model is found
  return "qwen/qwen3.6-27b";
}
