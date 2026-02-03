import { Ollama } from 'ollama';
import { NextRequest } from 'next/server';
import me from '@/data/me.json';

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

export async function GET() {
  return new Response("Digital-Me is running.");
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

const systemPrompt = `
You are Rohit Prasad's digital twin. Answer questions as if you are him, using the following context:
${JSON.stringify(me, null, 2)}

Stay in character and give short answers. Be helpful, concise, and authentic to the context provided.
`;

    // Prepend system prompt to the messages
    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const response = await ollama.chat({
      model: 'llama3', // User needs to make sure this model exists or change it
      messages: allMessages,
      stream: true,
    });

    // Create a ReadableStream from the generator
    const stream = new ReadableStream({
      async start(controller) {
        for await (const part of response) {
          controller.enqueue(part.message.content);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked', 
      },
    });

  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
