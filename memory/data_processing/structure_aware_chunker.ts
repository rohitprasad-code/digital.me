import { StructuredDocument } from './structure_analyzer';
import { ContentBlock } from './document_parser';

export interface ChunkingConfig {
  maxChunkTokens: number;
  minChunkTokens: number;
  overlapTokens: number;
  preserveTables: boolean;
  preserveCodeBlocks: boolean;
}

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  maxChunkTokens: 512,
  minChunkTokens: 50,
  overlapTokens: 64,
  preserveTables: true,
  preserveCodeBlocks: true,
};

export interface ChunkMetadata {
  sectionHeading?: string;
  blockTypes: string[];
  sourceFile?: string;
}

export interface Chunk {
  content: string;
  index: number;
  metadata: ChunkMetadata;
}

export class StructureAwareChunker {
  private config: ChunkingConfig;
  private currentChunkIndex: number = 0;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = { ...DEFAULT_CHUNKING_CONFIG, ...config };
  }

  // Rough estimation: 1 token ≈ 0.75 words -> words / 0.75
  private estimateTokens(text: string): number {
    const words = text.trim().split(/\s+/).length;
    return Math.ceil(words / 0.75);
  }

  public chunk(doc: StructuredDocument, sourceFile?: string): Chunk[] {
    const chunks: Chunk[] = [];
    this.currentChunkIndex = 0;

    if (doc.preamble.length > 0) {
      chunks.push(...this.processBlocks(doc.preamble, undefined, sourceFile));
    }

    for (const section of doc.sections) {
      chunks.push(...this.processBlocks(section.children, section.heading, sourceFile));
    }

    return chunks;
  }

  private processBlocks(blocks: ContentBlock[], heading?: ContentBlock, sourceFile?: string): Chunk[] {
    const chunks: Chunk[] = [];
    let currentContent = heading ? heading.content + '\n\n' : '';
    let currentTokens = this.estimateTokens(currentContent);
    let blockTypes = new Set<string>();
    
    if (heading) {
        blockTypes.add('heading');
    }

    const finalizeChunk = () => {
      if (currentContent.trim().length > 0) {
        chunks.push({
          content: currentContent.trim(),
          index: this.currentChunkIndex++,
          metadata: {
            sectionHeading: heading ? heading.content.replace(/^#+\s*/, '').trim() : undefined,
            blockTypes: Array.from(blockTypes),
            sourceFile,
          },
        });
      }
    };

    for (const block of blocks) {
      const blockTokens = this.estimateTokens(block.content);

      // Rule 1: Table & Code Preserver
      const isUnsplittable = 
        (block.type === 'table' && this.config.preserveTables) ||
        (block.type === 'code' && this.config.preserveCodeBlocks);

      if (isUnsplittable) {
        // If current chunk + this block is too big, flush current chunk first
        if (currentTokens + blockTokens > this.config.maxChunkTokens && currentTokens > (heading ? this.estimateTokens(heading.content) : 0)) {
          finalizeChunk();
          currentContent = heading ? heading.content + '\n\n' : '';
          currentTokens = this.estimateTokens(currentContent);
          blockTypes = new Set<string>();
          if (heading) blockTypes.add('heading');
        }

        // Add the unsplittable block
        currentContent += block.content + '\n\n';
        currentTokens += blockTokens;
        blockTypes.add(block.type);

        // If the block itself pushed us over max, flush immediately
        if (currentTokens >= this.config.maxChunkTokens) {
          finalizeChunk();
          currentContent = heading ? heading.content + '\n\n' : '';
          currentTokens = this.estimateTokens(currentContent);
          blockTypes = new Set<string>();
          if (heading) blockTypes.add('heading');
        }
        continue;
      }

      // Rule 3: Natural Boundaries (Paragraphs)
      if (currentTokens + blockTokens <= this.config.maxChunkTokens) {
        currentContent += block.content + '\n\n';
        currentTokens += blockTokens;
        blockTypes.add(block.type);
      } else {
        // Simple sentence-level splitting if paragraph is too large
        const sentences = block.content.split(/(?<=[.?!])\s+/);
        for (const sentence of sentences) {
          const sentenceTokens = this.estimateTokens(sentence);
          
          if (currentTokens + sentenceTokens > this.config.maxChunkTokens && currentTokens > (heading ? this.estimateTokens(heading.content) : 0)) {
            finalizeChunk();
            
            // Overlap logic
            const prevWords = chunks[chunks.length - 1].content.split(/\s+/);
            const overlapWordCount = Math.ceil(this.config.overlapTokens * 0.75);
            const overlapContent = prevWords.slice(-overlapWordCount).join(' ');

            currentContent = heading ? heading.content + '\n\n' : '';
            if (overlapContent) {
              currentContent += overlapContent + ' ';
            }
            
            currentTokens = this.estimateTokens(currentContent);
            blockTypes = new Set<string>();
            if (heading) blockTypes.add('heading');
          }
          
          currentContent += sentence + ' ';
          currentTokens += sentenceTokens;
          blockTypes.add(block.type);
        }
        currentContent += '\n\n';
      }
    }

    // Flush remaining
    if (currentTokens > (heading ? this.estimateTokens(heading.content) : 0)) {
        // Only flush if we have more than just a heading
        if (currentContent.trim() !== (heading ? heading.content.trim() : '')) {
            finalizeChunk();
        }
    }

    return chunks;
  }
}
