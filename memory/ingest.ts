import fs from "fs/promises";
import path from "path";
import { logEvent } from "../utils/logger";
const { PDFParse } = require("pdf-parse");
import { VectorStore } from "./vector_store/index";
import { getLLMProvider } from "../model/llm/provider";
import { integrators } from "../integrations";
import { processDocument } from "./data_processing/index";
import {
  crawlDirectory,
  determineFileRole,
} from "./data_processing/directory_crawler";
import { UnstructuredConverter } from "./data_processing/unstructured_converter";

// Interface for structured resume data
interface ResumeData {
  education: any[];
  experience: {
    company: string;
    role: string;
    duration: string;
    details: string[];
  }[];
  projects: {
    name: string;
    technologies: string[];
    description: string;
  }[];
  skills: {
    category: string;
    items: string[];
  }[];
}

async function parseResumeWithLLM(text: string): Promise<ResumeData | null> {
  console.log("Parsing resume with LLM...");
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
    const response = await provider.chat([{ role: "user", content: prompt }], {
      format: "json",
    });

    const content = response.content;
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = content.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonStr);
    }
    return JSON.parse(content);
  } catch (error) {
    console.error("LLM Parsing failed:", error);
    return null;
  }
}

async function processStaticJson(filePath: string, vectorStore: VectorStore) {
  try {
    const filename = path.basename(filePath);
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);

    // We can assume format of me.json style or just add whole JSON string
    if (data.profile) {
      await vectorStore.addDocument(
        `Profile: ${JSON.stringify(data.profile)}`,
        { source: filename, type: "profile" },
      );
    }
    if (data.skills) {
      await vectorStore.addDocument(`Skills: ${data.skills.join(", ")}`, {
        source: filename,
        type: "skills",
      });
    }
    if (data.interests) {
      await vectorStore.addDocument(`Interests: ${data.interests.join(", ")}`, {
        source: filename,
        type: "interests",
      });
    }
    if (data.goals) {
      await vectorStore.addDocument(`Goals: ${data.goals.join(", ")}`, {
        source: filename,
        type: "goals",
      });
    }

    // Save to memory/static for representing state
    const targetPath = path.resolve(
      process.cwd(),
      `memory/memory_type/static/${filename}`,
    );
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, JSON.stringify(data, null, 2));

    console.log(`Successfully ingested ${filename}`);
    await logEvent("ingest", `Successfully ingested ${filename} (Static JSON)`);
  } catch (error) {
    console.error(`Error ingesting static JSON ${filePath}:`, error);
  }
}

async function processStaticPdf(filePath: string, vectorStore: VectorStore) {
  try {
    const filename = path.basename(filePath);
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text || result;

    const structuredData = await parseResumeWithLLM(text);

    if (structuredData) {
      console.log(`Successfully parsed ${filename} into structured data.`);

      // Save structured data to JSON file
      const jsonName = filename.replace(/\.pdf$/i, ".json");
      const resumeJsonPath = path.resolve(
        process.cwd(),
        `memory/memory_type/static/${jsonName}`,
      );
      await fs.mkdir(path.dirname(resumeJsonPath), { recursive: true });
      await fs.writeFile(
        resumeJsonPath,
        JSON.stringify(structuredData, null, 2),
      );
      console.log(`Saved structured data to ${resumeJsonPath}`);
      await logEvent(
        "ingest",
        `Saved structured data to ${resumeJsonPath} (Static PDF)`,
      );

      // Ingest Experience
      if (structuredData.experience) {
        for (const exp of structuredData.experience) {
          const content = `Experience at ${exp.company} as ${exp.role} (${exp.duration}):\n${exp.details.join("\n")}`;
          await vectorStore.addDocument(content, {
            source: filename,
            type: "experience",
            company: exp.company,
          });
          const summary = `Work History: Employed at ${exp.company} as ${exp.role} since ${exp.duration.split("-")[0].trim()}.`;
          await vectorStore.addDocument(summary, {
            source: filename,
            type: "experience_summary",
            company: exp.company,
          });
        }
      }

      // Ingest Projects
      if (structuredData.projects) {
        for (const proj of structuredData.projects) {
          const content = `Project: ${proj.name}\nTech Stack: ${proj.technologies.join(", ")}\nDescription: ${proj.description}`;
          await vectorStore.addDocument(content, {
            source: filename,
            type: "project",
            name: proj.name,
          });
        }
      }

      // Ingest Education
      if (structuredData.education) {
        for (const edu of structuredData.education) {
          const content = `Education: ${JSON.stringify(edu)}`;
          await vectorStore.addDocument(content, {
            source: filename,
            type: "education",
          });
        }
      }

      // Ingest Skills
      if (structuredData.skills) {
        for (const skillCat of structuredData.skills) {
          const content = `Resume Skills (${skillCat.category}): ${skillCat.items.join(", ")}`;
          await vectorStore.addDocument(content, {
            source: filename,
            type: "skills",
          });
        }
      }
    } else {
      console.warn(
        `LLM parsing failed for ${filename}, falling back to structure-aware chunking.`,
      );
      const chunks = processDocument(text, filename);

      for (const chunk of chunks) {
        if (chunk.content.trim().length > 0) {
          await vectorStore.addDocument(chunk.content, {
            source: filename,
            fallback: true,
            ...chunk.metadata,
          });
        }
      }
      console.log(
        `Ingested ${filename} via structure-aware fallback (${chunks.length} chunks)`,
      );
      await logEvent(
        "ingest",
        `Ingested ${filename} via structure-aware fallback (${chunks.length} chunks)`,
      );
    }
  } catch (error) {
    console.error(`Error ingesting static PDF ${filePath}:`, error);
  }
}

async function processGenericText(
  filePath: string,
  role: string,
  vectorStore: VectorStore,
) {
  try {
    const filename = path.basename(filePath);
    const content = await fs.readFile(filePath, "utf-8");

    if (role === "unstructured") {
      const structuredData = await UnstructuredConverter.extractStructuredData(
        content,
        filename,
      );
      if (structuredData) {
        const jsonName = filename + ".json";
        const staticPath = path.resolve(
          process.cwd(),
          `memory/memory_type/static/${jsonName}`,
        );
        await fs.mkdir(path.dirname(staticPath), { recursive: true });
        await fs.writeFile(staticPath, JSON.stringify(structuredData, null, 2));
        console.log(
          `Saved extracted structure for ${filename} to ${staticPath}`,
        );
        await logEvent(
          "ingest",
          `Saved extracted structure for ${filename} to ${staticPath}`,
        );

        const metaContent = `Metadata for ${filename}:\nTitle: ${structuredData.title}\nSummary: ${structuredData.summary}\nTopics: ${(structuredData.topics || []).join(", ")}`;
        await vectorStore.addDocument(metaContent, {
          source: filename,
          type: "metadata",
        });
      }
    }

    const chunks = processDocument(content, filename);

    for (const chunk of chunks) {
      if (chunk.content.trim().length > 0) {
        await vectorStore.addDocument(chunk.content, {
          source: filename,
          type: role === "code" ? "code" : "document",
          fallback: false,
          ...chunk.metadata,
        });
      }
    }

    console.log(
      `Ingested ${filename} via structure-aware chunking (${chunks.length} chunks)`,
    );
    await logEvent(
      "ingest",
      `Ingested ${filename} via structure-aware chunking (${chunks.length} chunks)`,
    );
  } catch (error) {
    console.error(`Error processing generic text ${filePath}:`, error);
  }
}

async function ingest() {
  const vectorStore = new VectorStore();

  console.log("Clearing existing vector store...");
  await logEvent("ingest", "Clearing existing vector store...");
  await vectorStore.clear();

  // 1. Process all static documents in `public/`
  console.log("Processing static files in public/...");
  await logEvent("ingest", "Processing static files in public/...");
  const publicPath = path.resolve(process.cwd(), "public");

  try {
    const files = await crawlDirectory(publicPath);
    for (const filePath of files) {
      const role = determineFileRole(filePath);
      const ext = path.extname(filePath).toLowerCase();

      if (role === "pdf") {
        await processStaticPdf(filePath, vectorStore);
      } else if (role === "structured" && ext === ".json") {
        await processStaticJson(filePath, vectorStore);
      } else if (
        role === "code" ||
        role === "unstructured" ||
        (role === "structured" && ext !== ".json")
      ) {
        await processGenericText(filePath, role, vectorStore);
      } else {
        console.log(`Skipping unknown or unsupported file format: ${filePath}`);
      }
    }
  } catch (err) {
    console.warn(
      "Could not read public directory. Might not exist or is empty.",
    );
  }

  // 2. Process all dynamic integrations
  console.log("Processing dynamic integrations...");
  await logEvent("ingest", "Processing dynamic integrations...");
  for (const integrator of integrators) {
    try {
      console.log(`Triggering integrator: ${integrator.name}`);
      await integrator.ingest(vectorStore);
    } catch (err) {
      console.error(`Intgrator ${integrator.name} failed:`, err);
      await logEvent("ingest", `Integrator ${integrator.name} failed`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("Ingestion complete!");
  await logEvent("ingest", "Ingestion complete!");
}

export { ingest };

if (require.main === module) {
  ingest().catch(console.error);
}
