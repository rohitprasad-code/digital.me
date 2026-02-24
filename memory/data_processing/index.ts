import { DocumentParser, ContentBlock, BlockType } from './document_parser';
import { StructureAnalyzer, StructuredDocument, Section } from './structure_analyzer';
import { StructureAwareChunker, ChunkingConfig, Chunk, ChunkMetadata } from './structure_aware_chunker';

export { DocumentParser };
export type { BlockType, ContentBlock };
export { StructureAnalyzer };
export type { StructuredDocument, Section };
export { StructureAwareChunker };
export type { ChunkMetadata, ChunkingConfig, Chunk };

/**
 * Orchestrates the full unstructured parsing pipeline:
 * Raw Text -> ContentBlocks -> StructuredHierarchal Doc -> Structure-Aware Chunks
 */
export function processDocument(rawText: string, filename: string, config?: Partial<ChunkingConfig>): Chunk[] {
    const blocks = DocumentParser.parse(rawText);
    const doc = StructureAnalyzer.analyze(blocks, filename);
    const chunker = new StructureAwareChunker(config);
    return chunker.chunk(doc, filename);
}
