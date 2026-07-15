import { LLMProvider, ChatMessage, ChatOptions, ChatResponse } from "./provider";

export type NextFn = (
  messages: ChatMessage[],
  options?: ChatOptions
) => Promise<ChatResponse>;

export type ChatMiddleware = (
  messages: ChatMessage[],
  options: ChatOptions | undefined,
  next: NextFn
) => Promise<ChatResponse>;

export class MiddlewareLLMProvider implements LLMProvider {
  private baseProvider: LLMProvider;
  private middlewares: ChatMiddleware[] = [];

  constructor(baseProvider: LLMProvider, middlewares: ChatMiddleware[] = []) {
    this.baseProvider = baseProvider;
    this.middlewares = middlewares;
  }

  use(middleware: ChatMiddleware) {
    this.middlewares.push(middleware);
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const chain = this.composeMiddlewares(this.middlewares, async (msgs, opts) => {
      return this.baseProvider.chat(msgs, opts);
    });
    return chain(messages, options);
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncIterable<string> {
    // Middlwares are run for the initial setup/chat. For streaming, we can execute the middleware chain
    // but streaming yields intermediate chunks. To keep it clean and simple, streaming delegates to base provider.
    yield* this.baseProvider.chatStream(messages, options);
  }

  async healthCheck(): Promise<void> {
    return this.baseProvider.healthCheck();
  }

  private composeMiddlewares(
    middlewares: ChatMiddleware[],
    finalHandler: NextFn
  ): NextFn {
    return (messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> => {
      let index = -1;

      const dispatch = async (i: number, msgs: ChatMessage[], opts?: ChatOptions): Promise<ChatResponse> => {
        if (i <= index) {
          throw new Error("next() called multiple times in middleware chain");
        }
        index = i;
        if (i === middlewares.length) {
          return finalHandler(msgs, opts);
        }
        const middleware = middlewares[i];
        return middleware(msgs, opts, (nextMsgs, nextOpts) =>
          dispatch(i + 1, nextMsgs, nextOpts)
        );
      };

      return dispatch(0, messages, options);
    };
  }
}
