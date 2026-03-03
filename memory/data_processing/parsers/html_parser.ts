import fs from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import { log } from "../../../utils/logger";
import { EmbeddingPipeline } from "../../../jobs/embedding_pipeline";
import { processDocument } from "../index";

export class HtmlParser {
  static async parse(filePath: string, pipeline: EmbeddingPipeline) {
    try {
      const filename = path.basename(filePath);
      const htmlContent = await fs.readFile(filePath, "utf-8");

      const $ = cheerio.load(htmlContent);

      // Clean up script and style tags
      $("script, style, noscript, nav, footer, header").remove();

      // Convert <pre> tags and tables cleanly to markdown format before getting text
      // so the processDocument can pick them up cleanly as code blocks / tables

      $("pre").each((_, el) => {
        const text = $(el).text().trim();
        $(el).replaceWith(`\n\`\`\`\n${text}\n\`\`\`\n`);
      });

      $("table").each((_, el) => {
        // Attempt to create a basic markdown table
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
            // Add separator after first row assuming it's header
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

      // Extract remaining text, it will be mostly unstructured or headings
      $("h1, h2, h3, h4, h5, h6").each((_, el) => {
        const hName = (el as any).tagName.toLowerCase();
        const level = parseInt(hName.replace("h", ""), 10);
        const hashes = "#".repeat(level);
        $(el).replaceWith(`\n${hashes} ${$(el).text()}\n`);
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
