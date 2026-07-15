import { ChatMiddleware } from "./middleware";

export interface TraceSpan {
  id: string;
  timestamp: string;
  durationMs: number;
  messages: any[];
  options?: any;
  response?: any;
  error?: string;
}

export const activeTraces: TraceSpan[] = [];

export function createObservabilityMiddleware(): ChatMiddleware {
  return async (messages, options, next) => {
    const start = Date.now();
    const id = Math.random().toString(36).substring(7);

    try {
      const response = await next(messages, options);
      const durationMs = Date.now() - start;

      activeTraces.push({
        id,
        timestamp: new Date().toISOString(),
        durationMs,
        messages,
        options,
        response,
      });

      return response;
    } catch (err) {
      const durationMs = Date.now() - start;
      activeTraces.push({
        id,
        timestamp: new Date().toISOString(),
        durationMs,
        messages,
        options,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}
