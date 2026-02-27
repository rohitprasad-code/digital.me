import * as readline from "readline";
import chalk from "chalk";

const DEFAULT_API_URL = "http://localhost:7000/api";

export async function startChat(apiUrl: string = DEFAULT_API_URL) {
  console.log(
    chalk.blue("Starting chat with Digital Me... (Type 'exit' to quit)"),
  );
  console.log(
    chalk.yellow("Ensure the Next.js server is running at " + apiUrl),
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green("You: "),
  });

  // The API handles the system prompt and context injection.
  // We only need to maintain the conversation history of the user and assistant.
  const messages: { role: "user" | "assistant"; content: string }[] = [];

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    if (!input) {
      rl.prompt();
      return;
    }

    messages.push({ role: "user", content: input });

    try {
      process.stdout.write(chalk.cyan("AI: "));

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        throw new Error(
          `API returned ${response.status}: ${response.statusText}`,
        );
      }

      if (!response.body) {
        throw new Error("No response body received");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        process.stdout.write(chunk);
        fullResponse += chunk;
      }
      console.log();
      console.log();

      messages.push({ role: "assistant", content: fullResponse });
    } catch (error) {
      console.error(chalk.red("\nError calling API:"), error);
      console.error(
        chalk.yellow("Make sure the server is running with `npm run dev`"),
      );
    }

    rl.prompt();
  }).on("close", () => {
    console.log(chalk.blue("\nChat ended."));
    process.exit(0);
  });
}
