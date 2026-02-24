export type BlockType = 'heading' | 'paragraph' | 'table' | 'code' | 'list' | 'image_ref';

export interface ContentBlock {
  type: BlockType;
  content: string;
  level?: number;
  metadata?: Record<string, any>;
}

export class DocumentParser {
  /**
   * Parses raw text into an array of structured ContentBlock objects.
   * Recognizes Markdown constructs like headings, code blocks, lists, and tables.
   */
  static parse(text: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    const lines = text.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      
      // Skip empty lines
      if (line.trim() === '') {
        i++;
        continue;
      }

      // 1. Code Blocks
      if (line.trim().startsWith('```')) {
        let content = line + '\n';
        const lang = line.trim().substring(3).trim();
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          content += lines[i] + '\n';
          i++;
        }
        if (i < lines.length) {
          content += lines[i] + '\n';
          i++; // Consume closing backticks
        }
        blocks.push({
          type: 'code',
          content: content.trim(),
          metadata: { language: lang || 'unknown' },
        });
        continue;
      }

      // 2. Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        blocks.push({
          type: 'heading',
          content: line.trim(),
          level: headingMatch[1].length,
        });
        i++;
        continue;
      }

      // 3. Tables (simple markdown tables)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        let content = line + '\n';
        i++;
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          content += lines[i] + '\n';
          i++;
        }
        blocks.push({
          type: 'table',
          content: content.trim(),
        });
        continue;
      }

      // 4. Lists
      // Matches bullet points (*, -, +) or numbered lists (1.)
      if (line.match(/^(\s*)([-*+]|\d+\.)\s/)) {
        let content = line + '\n';
        i++;
        while (
          i < lines.length &&
          (lines[i].match(/^(\s*)([-*+]|\d+\.)\s/) || (lines[i].trim() !== '' && Object.is(lines[i][0], ' ')))
        ) {
          content += lines[i] + '\n';
          i++;
        }
        blocks.push({
          type: 'list',
          content: content.trim(),
        });
        continue;
      }

      // 5. Paragraphs (Accumulate until blank line or start of new block)
      let content = line + '\n';
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].trim().startsWith('```') &&
        !lines[i].match(/^(#{1,6})\s+/) &&
        !lines[i].match(/^(\s*)([-*+]|\d+\.)\s/) &&
        !lines[i].trim().startsWith('|')
      ) {
        content += lines[i] + '\n';
        i++;
      }
      blocks.push({
        type: 'paragraph',
        content: content.trim(),
      });
    }

    return blocks;
  }
}
