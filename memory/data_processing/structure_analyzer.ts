import { ContentBlock } from './document_parser';

export interface Section {
  heading: ContentBlock;
  level: number;
  children: ContentBlock[];
}

export interface StructuredDocument {
  title: string;
  preamble: ContentBlock[];
  sections: Section[];
}

export class StructureAnalyzer {
  /**
   * Enriches ContentBlocks with hierarchy and grouping information.
   * Creates parent-child relationships where headings own subsequent content blocks.
   */
  static analyze(blocks: ContentBlock[], defaultTitle: string = 'Document'): StructuredDocument {
    const doc: StructuredDocument = {
      title: defaultTitle,
      preamble: [],
      sections: [],
    };

    let currentSection: Section | null = null;
    let titleSet = false;

    for (const block of blocks) {
      if (block.type === 'heading') {
        const headingText = block.content.replace(/^#+\s*/, '').trim();
        
        if (!titleSet && block.level === 1) {
          doc.title = headingText;
          titleSet = true;
        }

        currentSection = {
          heading: block,
          level: block.level || 1,
          children: [],
        };
        doc.sections.push(currentSection);
      } else {
        if (currentSection) {
          currentSection.children.push(block);
        } else {
          doc.preamble.push(block);
        }
      }
    }

    return doc;
  }
}
