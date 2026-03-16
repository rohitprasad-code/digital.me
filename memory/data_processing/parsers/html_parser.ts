import fs from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import { log } from "../../../utils/logger";
import { EmbeddingPipeline } from "../../../jobs/embedding_pipeline";
import { processDocument } from "../index";
import { getLLMProvider } from "../../../model/llm/provider";

export class HtmlParser {
  /**
   * Extracts structured data from HTML text using an LLM.
   */
  static async extractStructuredData(
    text: string,
    filename: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const $ = cheerio.load(text);
      const structuredData: Record<string, unknown> = {};

      const title = $("title").text().trim();
      if (title) {
        structuredData.title = title;
      }

      const metaDescription = $('meta[name="description"]').attr("content");
      if (metaDescription) {
        structuredData.description = metaDescription;
      }

      const headings: { level: number; text: string }[] = [];
      $("h1, h2, h3, h4, h5, h6").each((_, el) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element = el as any;
        const hName = (element.name || element.tagName || "").toLowerCase();
        if (hName) {
          const level = parseInt(hName.replace("h", ""), 10);
          if (!isNaN(level)) {
            headings.push({ level, text: $(el).text().trim() });
          }
        }
      });
      
      if (headings.length > 0) {
        structuredData.headings = headings;
      }

      const provider = getLLMProvider();
      const prompt = `
      Extract key entities and summaries from this HTML content.
      Return a VALID JSON object with: title, summary, topics, and key_entities.
      
      HTML Content:
      ${text.substring(0, 4000)}
      `;

      const response = await provider.chat(
        [{ role: "user", content: prompt }],
        { format: "json" },
      );

      try {
        const llmData = JSON.parse(response.content);
        return { ...structuredData, ...llmData };
      } catch {
        return structuredData;
      }
    } catch (error) {
      log.error(
        `Error extracting structured data from ${filename}`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  }

  static async parse(filePath: string, pipeline: EmbeddingPipeline) {
    try {
      const filename = path.basename(filePath);
      const htmlContent = await fs.readFile(filePath, "utf-8");

      const $ = cheerio.load(htmlContent);

      // Clean up script and style tags
      $("script, style, noscript, nav, footer, header").remove();

      $("pre").each((_, el) => {
        const text = $(el).text().trim();
        $(el).replaceWith(`\n\`\`\`\n${text}\n\`\`\`\n`);
      });

      $("table").each((_, el) => {
        let mdTable = "\n";
        $(el)
          .find("tr")
          .each((rowIndex, tr) => {
            let rowText = "|";
            $(tr)
              .find("th, td")
              .each((_, td) => {
                const cellText = $(td).text().trim().replace(/\n/g, " ");
                rowText += ` ${cellText} |`;
              });
            mdTable += rowText + "\n";
            if (rowIndex === 0) {
              let sep = "|";
              $(tr)
                .find("th, td")
                .each(() => {
                  sep += "---|";
                });
              mdTable += sep + "\n";
            }
          });
        mdTable += "\n";
        $(el).replaceWith(mdTable);
      });

      $("h1, h2, h3, h4, h5, h6").each((_, el) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element = el as any;
        const hName = (element.name || element.tagName || "").toLowerCase();
        if (hName) {
          const level = parseInt(hName.replace("h", ""), 10);
          if (!isNaN(level)) {
            const hashes = "#".repeat(level);
            $(el).replaceWith(`\n${hashes} ${$(el).text()}\n`);
          }
        }
      });

      const cleanText = $("body")
        .text()
        .replace(/\n\s*\n/g, "\n\n")
        .trim();

      const chunks = processDocument(cleanText, filename);

      for (const chunk of chunks) {
        if (chunk.content.trim().length > 0) {
          await pipeline.syncDocument(chunk.content, {
            source: filename,
            type: "html_document",
            fallback: false,
            ...chunk.metadata,
          });
        }
      }

      log.success(
        `Ingested ${filename} via structure-aware chunking (${chunks.length} chunks)`,
      );
    } catch (error) {
      log.error(
        `Error processing HTML ${filePath}`,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }
}
