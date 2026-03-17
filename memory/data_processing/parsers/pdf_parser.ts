import fs from "fs/promises";
import path from "path";
import { log } from "../../../utils/logger";
import { STATIC_DIR } from "../../../utils/paths";
import { EmbeddingPipeline } from "../../../jobs/embedding_pipeline";
import { getLLMProvider } from "../../../model/llm/provider";
import { processDocument } from "../index";

import { PDFParse } from "pdf-parse";

export interface ResumeData {
  education?: { institution: string; degree: string; year: string }[];
  experience?: {
    company: string;
    role: string;
    duration: string;
    details: string[];
  }[];
  projects?: {
    name: string;
    technologies: string[];
    description: string;
  }[];
  skills?: {
    category: string;
    items: string[];
  }[];
}

export class PdfParser {
  private static async extractStructuredData(
    text: string,
  ): Promise<ResumeData | null> {
    const prompt = `
    You are an expert resume parser for a JSON-based vector database.
    Extract the following structured data from the resume text below and return it as a VALID JSON object.
    Do not include any markdown formatting (like \`\`\`json). Just the raw JSON string.
    
    Structure:
    {
      "education": [{ "institution": "...", "degree": "...", "year": "..." }],
      "experience": [
        { "company": "...", "role": "...", "duration": "...", "details": ["..."] }
      ],
      "projects": [
        { "name": "...", "technologies": ["..."], "description": "..." }
      ],
      "skills": [
        { "category": "Languages/Frameworks/Tools", "items": ["..."] }
      ]
    }
  
    Resume Text:
    ${text}
    `;

    try {
      const provider = getLLMProvider();
      const response = await provider.chat(
        [{ role: "user", content: prompt }],
        {
          format: "json",
        },
      );

      const content = response.content;
      const jsonStart = content.indexOf("{");
      const jsonEnd = content.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = content.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(jsonStr) as ResumeData;
      }
      return JSON.parse(content) as ResumeData;
    } catch (error) {
      console.error("LLM Parsing failed:", error);
      return null;
    }
  }

  static async parse(filePath: string, pipeline: EmbeddingPipeline) {
    try {
      const filename = path.basename(filePath);
      const buffer = await fs.readFile(filePath);
      
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      const text = data.text;

      const structuredData = await this.extractStructuredData(text);

      if (structuredData) {
        const jsonName = filename.replace(/\.pdf$/i, ".json");
        const resumeJsonPath = path.join(STATIC_DIR, jsonName);
        await fs.mkdir(path.dirname(resumeJsonPath), { recursive: true });
        await fs.writeFile(
          resumeJsonPath,
          JSON.stringify(structuredData, null, 2),
        );

        if (structuredData.experience) {
          for (const exp of structuredData.experience) {
            const content = `Experience at ${exp.company} as ${exp.role} (${exp.duration}):\n${(exp.details || []).join("\n")}`;
            await pipeline.syncDocument(
              content,
              {
                source: filename,
                type: "experience",
                company: exp.company,
              },
              text,
            );
            const summary = `Work History: Employed at ${exp.company} as ${exp.role} since ${exp.duration.split("-")[0].trim()}.`;
            await pipeline.syncDocument(
              summary,
              {
                source: filename,
                type: "experience_summary",
                company: exp.company,
              },
              text,
            );
          }
        }

        if (structuredData.projects) {
          for (const proj of structuredData.projects) {
            const content = `Project: ${proj.name}\nTech Stack: ${(proj.technologies || []).join(", ")}\nDescription: ${proj.description}`;
            await pipeline.syncDocument(
              content,
              {
                source: filename,
                type: "project",
                name: proj.name,
              },
              text,
            );
          }
        }

        if (structuredData.education) {
          for (const edu of structuredData.education) {
            const content = `Education: ${JSON.stringify(edu)}`;
            await pipeline.syncDocument(
              content,
              {
                source: filename,
                type: "education",
              },
              text,
            );
          }
        }

        if (structuredData.skills) {
          for (const skillCat of structuredData.skills) {
            const content = `Resume Skills (${skillCat.category}): ${(skillCat.items || []).join(", ")}`;
            await pipeline.syncDocument(
              content,
              {
                source: filename,
                type: "skills",
              },
              text,
            );
          }
        }

        log.success("Successfully ingested " + filename);
      } else {
        log.warn(
          "LLM parsing failed for " +
            filename +
            ", falling back to structure-aware chunking.",
        );
        const chunks = processDocument(text, filename);

        for (const chunk of chunks) {
          if (chunk.content.trim().length > 0) {
            await pipeline.syncDocument(chunk.content, {
              source: filename,
              fallback: true,
              ...chunk.metadata,
            });
          }
        }
        log.success(
          `Ingested ${filename} via structure-aware fallback (${chunks.length} chunks)`,
        );
      }
    } catch (error) {
      log.error(
        `Error ingesting static PDF ${filePath}`,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }
}

