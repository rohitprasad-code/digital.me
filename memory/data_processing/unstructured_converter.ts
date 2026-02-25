import { getLLMProvider } from "../../model/llm/provider";

export class UnstructuredConverter {
  /**
   * Converts highly unstructured text into a structured JSON representation
   * using an LLM. This is useful for unstructured notes, logs, or plain text
   * that lacks semantic headers.
   */
  static async extractStructuredData(
    text: string,
    filename: string,
  ): Promise<any> {
    console.log(
      `Extracting structured entities for unstructured file: ${filename}`,
    );
    const prompt = `
    You are an expert data extractor for a JSON-based vector database.
    Extract the key entities, summaries, and intents from the following unstructured text, and return a VALID JSON object.
    Do not include any markdown formatting or introductory text. Just the raw JSON string.

    Ensure your response exactly follows this structure:
    {
      "title": "A short descriptive title",
      "summary": "1-2 sentence summary of this text",
      "topics": ["topic1", "topic2"],
      "key_entities": [
        { "name": "entity name", "type": "Person/Organization/Concept/Tool", "description": "brief description" }
      ],
      "action_items": ["action 1", "action 2"]
    }

    Text:
    ${text}
    `;

    try {
      const provider = getLLMProvider();
      const response = await provider.chat(
        [{ role: "user", content: prompt }],
        { format: "json" },
      );

      let content = response.content;
      // Clean up markdown block if the model returned it despite being told not to
      const jsonStart = content.indexOf("{");
      const jsonEnd = content.lastIndexOf("}");

      if (jsonStart !== -1 && jsonEnd !== -1) {
        content = content.substring(jsonStart, jsonEnd + 1);
      }

      return JSON.parse(content);
    } catch (error) {
      console.error(`LLM Structure Extraction failed for ${filename}:`, error);
      return null;
    }
  }
}
