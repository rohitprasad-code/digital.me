import me from "@/public/codes/me.json";

/**
 * Constructs the verification context for the factual grounding checker by
 * combining profile system metadata, database retrieval context, and live tool execution outputs.
 *
 * @param contextString - The retrieved RAG context from the vector database.
 * @param toolOutputs - The live tool outputs collected during the agent execution loop.
 * @returns The structured context string for verifyGrounding.
 */
export function buildGroundingContext(contextString: string, toolOutputs: string[]): string {
  const meRecord = me as Record<string, unknown>;
  const systemMeta = meRecord.system && typeof meRecord.system === "object"
    ? `[System Metadata]: The user (Rohit) uses a ${(meRecord.system as Record<string, string>).device || "Mac"} running ${(meRecord.system as Record<string, string>).os || "macOS"}.\n\n`
    : "";

  return systemMeta + (toolOutputs.length > 0
    ? `${contextString}\n\nReal-time Tool Outputs:\n${toolOutputs.join("\n")}`
    : contextString);
}
