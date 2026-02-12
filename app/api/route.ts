import { NextRequest } from 'next/server';
import { ollama } from '@/model/llm/ollama/client';
import { systemPrompt } from '@/model/prompts/core';
import { VectorStore } from '@/memory/vector_store';

const vectorStore = new VectorStore();

export async function GET() {
  try {
    await ollama.list();
    return new Response("Digital-Me is running");
  } catch (error) {
    console.error("Health check failed:", error);
    return new Response("Service Unavailable: AI Backend is offline", { 
      status: 503,
      statusText: "Service Unavailable"
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    let contextString = "";
    if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'user') {
            try {
                await vectorStore.load(); 
                const results = await vectorStore.search(lastMessage.content, 10);
                
                if (results.length > 0) {
                    const retrievedContent = results.map(r => r.doc.content).join('\n---\n');
                    contextString = `\n\nRelevant Context:\n${retrievedContent}`;
                    console.log(`Retrieved ${results.length} relevant documents for context.`);
                }
            } catch (err) {
                console.error("Failed to retrieve context:", err);
            }
        }
    }

    const allMessages = [
      { role: 'system', content: systemPrompt + contextString },
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
