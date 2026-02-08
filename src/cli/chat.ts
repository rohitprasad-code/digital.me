import { ollama } from '../model/llm/ollama/client';
import { systemPrompt } from '../model/prompts/core';
import * as readline from 'readline';
import chalk from 'chalk';

export async function startChat() {
    console.log(chalk.blue('Starting chat with Digital Me... (Type "exit" to quit)'));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.green('You: '),
    });

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
    ];

    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();
        if (input.toLowerCase() === 'exit') {
            rl.close();
            return;
        }

        if (!input) {
            rl.prompt();
            return;
        }

        messages.push({ role: 'user', content: input });

        try {
            // console.log(chalk.gray('Sending request to Ollama...'));
            
            process.stdout.write(chalk.cyan('AI: '));

            const response = await ollama.chat({
                model: 'llama3', 
                messages: messages,
                stream: true,
            });

            let fullResponse = '';
            for await (const part of response) {
                process.stdout.write(part.message.content);
                fullResponse += part.message.content;
            }
            console.log(); // Newline after stream

            
            // Add a new line after the stream finishes
            console.log(); 
            
            messages.push({ role: 'assistant', content: fullResponse });

        } catch (error) {
            console.error(chalk.red('\nError calling Ollama:'), error);
        }

        rl.prompt();
    }).on('close', () => {
        console.log(chalk.blue('\nChat ended.'));
        process.exit(0);
    });
}
