import { VectorStore } from "../memory/vector_store";
import { getLLMProvider } from "../model/providers/provider";
import { EmbeddingPipeline } from "./embedding_pipeline";
import { log } from "../utils/logger";

export async function runCorrectionLoop() {
  log.info("Starting Hallucination Self-Correction Loop...");
  const vectorStore = new VectorStore();
  await vectorStore.load();

  const logs = await vectorStore.getHallucinations();
  const uncorrected = logs.filter((log) => !log.isSafe && !log.corrected);

  if (uncorrected.length === 0) {
    log.info("No uncorrected hallucination logs found.");
    return { count: 0 };
  }

  log.info(`Found ${uncorrected.length} uncorrected hallucination logs. Processing...`);
  const llm = getLLMProvider();
  const pipeline = new EmbeddingPipeline(vectorStore);
  let processedCount = 0;

  for (const item of uncorrected) {
    try {
      log.info(`Generating correction for log ID: ${item.id}...`);

      const prompt = `You are a factual correction assistant. Your task is to write a concise, one-paragraph grounding statement to correct a mistake.
      
Here is the context:
- User Query: "${item.query}"
- Hallucinated Output: "${item.response}"
- Fact Check Error Details: "${item.feedback}"

Based on the Fact Check Error Details, write a correct factual statement (1-3 sentences) that establishes the ground truth. This statement will be added as a permanent grounding document to the digital twin's memory, ensuring that future queries about this topic are answered correctly. Do not include any meta-commentary, intros, or outs. Just state the facts.`;

      const response = await llm.chat([
        {
          role: "system",
          content: "You are a precise facts-only correction engine. Write only the corrected grounding statement."
        },
        {
          role: "user",
          content: prompt
        }
      ]);

      const correctedFactText = response.content.trim();
      if (correctedFactText.length > 0) {
        log.info(`Corrected statement: "${correctedFactText}"`);
        // Sync into vector store
        await pipeline.syncDocument(correctedFactText, {
          source: `system:correction:${item.id}`,
          category: "system",
          title: `Fact Correction for "${item.query.substring(0, 30)}..."`,
          occurredAt: new Date().toISOString(),
        });

        // Mark corrected
        await vectorStore.markHallucinationCorrected(item.id);
        processedCount++;
      }
    } catch (err) {
      log.error(`Failed to process correction for log ID ${item.id}:`, err instanceof Error ? err.message : String(err));
    }
  }

  if (processedCount > 0) {
    log.info("Saving updated vector store...");
    await vectorStore.save();
  }

  log.info(`Hallucination correction loop completed. Processed ${processedCount} logs.`);
  return { count: processedCount };
}
