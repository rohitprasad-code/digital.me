import { ChatMiddleware } from "./middleware";

export interface RateLimiterOptions {
  maxTokensPerMinute?: number;
  maxRequestsPerMinute?: number;
  inputTokenCostPer1K?: number;
  outputTokenCostPer1K?: number;
}

let totalCost = 0;
let totalTokensUsed = 0;

export function createRateLimiterMiddleware(options: RateLimiterOptions = {}): ChatMiddleware {
  const maxTPM = options.maxTokensPerMinute || 50000;
  const maxRPM = options.maxRequestsPerMinute || 100;
  const costPer1KInput = options.inputTokenCostPer1K || 0.0015;
  const costPer1KOutput = options.outputTokenCostPer1K || 0.002;

  let requestTimestamps: number[] = [];
  let tokenTransactions: { timestamp: number; tokens: number }[] = [];

  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

  return async (messages, chatOpts, next) => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Filter windows
    requestTimestamps = requestTimestamps.filter((t) => t > oneMinuteAgo);
    tokenTransactions = tokenTransactions.filter((t) => t.timestamp > oneMinuteAgo);

    // Check RPM
    if (requestTimestamps.length >= maxRPM) {
      throw new Error("Rate limit exceeded: Requests Per Minute (RPM) limit reached.");
    }

    // Estimate input tokens
    const inputContent = messages.map((m) => m.content).join(" ");
    const inputTokens = estimateTokens(inputContent);

    // Check TPM
    const currentTPM = tokenTransactions.reduce((acc, t) => acc + t.tokens, 0);
    if (currentTPM + inputTokens > maxTPM) {
      throw new Error("Rate limit exceeded: Tokens Per Minute (TPM) limit reached.");
    }

    // Call downstream
    requestTimestamps.push(now);
    const response = await next(messages, chatOpts);

    const outputTokens = estimateTokens(response.content);
    const totalRequestTokens = inputTokens + outputTokens;

    tokenTransactions.push({ timestamp: Date.now(), tokens: totalRequestTokens });

    const cost = (inputTokens * costPer1KInput + outputTokens * costPer1KOutput) / 1000;
    totalCost += cost;
    totalTokensUsed += totalRequestTokens;

    return response;
  };
}
export { totalCost, totalTokensUsed };
