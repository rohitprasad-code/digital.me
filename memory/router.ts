import { getLLMProvider } from "@/model/llm/provider";
import { ContextMode } from "@/model/prompts/core";

export enum MemoryType {
  DYNAMIC = "DYNAMIC_MEMORY", // Strava, Health, etc.
  STATIC = "STATIC_MEMORY", // Resume, Projects, etc.
  CONVERSATIONAL = "CONVERSATIONAL_MEMORY", // Chat history
}

export class MemoryRouter {
  private useLLM: boolean;

  constructor(useLLM: boolean = false) {
    this.useLLM = useLLM;
  }

  // ---------- Memory routing (which store to search) ----------

  async route(query: string): Promise<MemoryType> {
    if (this.useLLM) {
      return this.routeWithLLM(query);
    } else {
      return this.routeWithKeywords(query);
    }
  }

  private async routeWithKeywords(query: string): Promise<MemoryType> {
    const lowerQuery = query.toLowerCase();

    // Conversational keywords
    const conversationalKeywords = [
      "hi",
      "hello",
      "hey",
      "how are you",
      "good morning",
      "good evening",
      "thanks",
      "thank you",
    ];
    if (
      conversationalKeywords.some(
        (k) => lowerQuery.startsWith(k) || lowerQuery === k,
      )
    ) {
      return MemoryType.CONVERSATIONAL;
    }

    // Dynamic memory keywords (Strava, Health, etc.)
    const dynamicKeywords = [
      "run",
      "running",
      "ran",
      "swim",
      "swimming",
      "swam",
      "bike",
      "biking",
      "cycled",
      "activity",
      "workout",
      "heart rate",
      "pace",
      "calories",
      "strava",
      "health",
    ];
    if (dynamicKeywords.some((k) => lowerQuery.includes(k))) {
      return MemoryType.DYNAMIC;
    }

    // Default to Static memory (Resume, Projects, Knowledge)
    return MemoryType.STATIC;
  }

  private async routeWithLLM(query: string): Promise<MemoryType> {
    const prompt = `
    You are a router. Classify the user's intent into one of three categories:
    1. DYNAMIC_MEMORY: Questions about recent physical activities, Strava, health metrics, workouts.
    2. CONVERSATIONAL_MEMORY: Greetings, small talk, referencing previous immediate context in current chat.
    3. STATIC_MEMORY: Questions about professional background, skills, projects, resume, technical knowledge, opinions, or general facts about the user.

    Input: "${query}"

    Return ONLY the category name (DYNAMIC_MEMORY, CONVERSATIONAL_MEMORY, or STATIC_MEMORY). Do not add any explanation.
    `;

    try {
      const provider = getLLMProvider();
      const response = await provider.chat([{ role: "user", content: prompt }]);

      const content = response.content.trim().toUpperCase();
      if (content.includes("DYNAMIC_MEMORY")) return MemoryType.DYNAMIC;
      if (content.includes("CONVERSATIONAL_MEMORY"))
        return MemoryType.CONVERSATIONAL;
      if (content.includes("STATIC_MEMORY")) return MemoryType.STATIC;

      // Fallback
      return MemoryType.STATIC;
    } catch (error) {
      console.error("Router LLM failed, falling back to keywords", error);
      return this.routeWithKeywords(query);
    }
  }

  // ---------- Intent detection (which personality to use) ----------

  async detectIntent(query: string): Promise<ContextMode> {
    if (this.useLLM) {
      return this.detectIntentWithLLM(query);
    } else {
      return this.detectIntentWithKeywords(query);
    }
  }

  private detectIntentWithKeywords(query: string): ContextMode {
    const lowerQuery = query.toLowerCase();

    const recruiterKeywords = [
      "hire",
      "hiring",
      "resume",
      "cv",
      "experience",
      "salary",
      "job",
      "interview",
      "portfolio",
      "skills",
      "work history",
      "position",
      "technical",
      "tech stack",
      "qualifications",
      "candidate",
      "role",
      "company",
      "years of experience",
    ];

    const socialKeywords = [
      "hobby",
      "hobbies",
      "fun",
      "weekend",
      "travel",
      "trip",
      "personal",
      "friend",
      "life",
      "interests",
      "free time",
      "hang out",
      "favorite",
      "movie",
      "music",
      "book",
      "food",
      "vibe",
      "chill",
      "what do you do for fun",
    ];

    if (recruiterKeywords.some((k) => lowerQuery.includes(k))) {
      return "recruiter";
    }
    if (socialKeywords.some((k) => lowerQuery.includes(k))) {
      return "social";
    }

    return "default";
  }

  private async detectIntentWithLLM(query: string): Promise<ContextMode> {
    const prompt = `
    You are a classifier. Based on the user's message, determine who is likely asking:
    1. RECRUITER: The message sounds like a recruiter, hiring manager, or someone evaluating professional fit (e.g. skills, experience, projects, tech stack).
    2. SOCIAL: The message sounds like a friend or someone curious about personal life (e.g. hobbies, travel, interests, lifestyle).
    3. DEFAULT: The message is neutral or unclear.

    Input: "${query}"

    Return ONLY one word: RECRUITER, SOCIAL, or DEFAULT.
    `;

    try {
      const provider = getLLMProvider();
      const response = await provider.chat([{ role: "user", content: prompt }]);

      const content = response.content.trim().toUpperCase();
      if (content.includes("RECRUITER")) return "recruiter";
      if (content.includes("SOCIAL")) return "social";
      return "default";
    } catch (error) {
      console.error(
        "Intent detection LLM failed, falling back to keywords",
        error,
      );
      return this.detectIntentWithKeywords(query);
    }
  }
}
