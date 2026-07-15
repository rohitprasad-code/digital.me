import { ChatMiddleware } from "./middleware";
import { ChatResponse } from "../providers/provider";
import crypto from "crypto";

export function createCacheMiddleware(): ChatMiddleware {
  const cache = new Map<string, ChatResponse>();

  return async (messages, options, next) => {
    // Generate a cache key from prompt/history and key options
    const rawKey = JSON.stringify({ messages, options });
    const hashKey = crypto.createHash("sha256").update(rawKey).digest("hex");

    if (cache.has(hashKey)) {
      return cache.get(hashKey)!;
    }

    const response = await next(messages, options);
    cache.set(hashKey, response);
    return response;
  };
}
