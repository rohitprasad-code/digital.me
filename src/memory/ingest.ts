import fs from 'fs/promises';
import path from 'path';
const { PDFParse } = require('pdf-parse');
import { VectorStore } from './vector_store/index';


import { ollama } from '../model/llm/ollama/client';
import { GitHubClient } from '../integrations/github/client';

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
    const response = await ollama.chat({
      model: 'llama3', 
      messages: [{ role: 'user', content: prompt }],
      format: 'json', // Force JSON mode if supported or just prompt
      stream: false,
    });

    const content = response.message.content;
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
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

async function ingestGitHub(vectorStore: VectorStore) {
    console.log("Ingesting GitHub data...");
    try {
        const github = new GitHubClient();
        
        // 1. Profile
        const profile = await github.getProfile();
        if (profile) {
            const content = `GitHub Profile: ${profile.name} (@${profile.login})\nBio: ${profile.bio}\nStats: ${profile.public_repos} repos, ${profile.followers} followers\nURL: ${profile.html_url}`;
            await vectorStore.addDocument(content, { source: 'github', type: 'github_profile' });
        }

        // 2. Repos
        const repos = await github.getRecentRepos(5);
        for (const repo of repos) {
            const content = `GitHub Repository: ${repo.name}\nDescription: ${repo.description}\nLanguage: ${repo.language}\nStars: ${repo.stars}\nUpdated: ${repo.updated_at}\nURL: ${repo.html_url}`; // Fixed access 
            await vectorStore.addDocument(content, { source: 'github', type: 'github_repo', name: repo.name });
        }

        // 3. Activity
        const activities = await github.getRecentActivity(10);
        if (activities.length > 0) {
             const activitySummary = activities.map(a => `- ${a.type} on ${a.repo} at ${a.created_at}`).join('\n');
             const content = `Recent GitHub Activity:\n${activitySummary}`;
             await vectorStore.addDocument(content, { source: 'github', type: 'github_activity' });
        }
        
        console.log("Successfully ingested GitHub data.");

    } catch (error) {
        console.warn("Skipping GitHub ingestion:", error instanceof Error ? error.message : "Unknown error");
    }
}

async function ingest() {
  const vectorStore = new VectorStore();
  
  console.log('Clearing existing vector store...');
  await vectorStore.clear();

  // 1. Ingest me.json
  try {
    const meJsonPath = path.resolve(process.cwd(), 'src/memory/static/me.json');
    const meJsonContent = await fs.readFile(meJsonPath, 'utf-8');
    const meData = JSON.parse(meJsonContent);

    if (meData.profile) {
      await vectorStore.addDocument(`Profile: ${JSON.stringify(meData.profile)}`, { source: 'me.json', type: 'profile' });
    }
    if (meData.skills) {
       await vectorStore.addDocument(`Skills: ${meData.skills.join(', ')}`, { source: 'me.json', type: 'skills' });
    }
    if (meData.interests) {
       await vectorStore.addDocument(`Interests: ${meData.interests.join(', ')}`, { source: 'me.json', type: 'interests' });
    }
    if (meData.goals) {
       await vectorStore.addDocument(`Goals: ${meData.goals.join(', ')}`, { source: 'me.json', type: 'goals' });
    }

    console.log('Successfully ingested me.json');
  } catch (error) {
    console.error('Error ingesting me.json:', error);
  }

  // 2. Ingest resume.pdf
  try {
    const resumePath = path.resolve(process.cwd(), 'src/memory/static/resume.pdf');
    const resumeBuffer = await fs.readFile(resumePath);
    const parser = new PDFParse({ data: resumeBuffer });
    const result = await parser.getText();
    const text = result.text || result;
    
    const structuredData = await parseResumeWithLLM(text);

    if (structuredData) {
        console.log("Successfully parsed resume into structured data.");
        
        // Ingest Experience
        if (structuredData.experience) {
            for (const exp of structuredData.experience) {
                const content = `Experience at ${exp.company} as ${exp.role} (${exp.duration}):\n${exp.details.join('\n')}`;
                await vectorStore.addDocument(content, { source: 'resume.pdf', type: 'experience', company: exp.company });

                const summary = `Work History: Employed at ${exp.company} as ${exp.role} since ${exp.duration.split('-')[0].trim()}.`;
                await vectorStore.addDocument(summary, { source: 'resume.pdf', type: 'experience_summary', company: exp.company });
            }
        }

        // Ingest Projects
        if (structuredData.projects) {
            for (const proj of structuredData.projects) {
                const content = `Project: ${proj.name}\nTech Stack: ${proj.technologies.join(', ')}\nDescription: ${proj.description}`;
                await vectorStore.addDocument(content, { source: 'resume.pdf', type: 'project', name: proj.name });
            }
        }
        
        // Ingest Education
         if (structuredData.education) {
            for (const edu of structuredData.education) {
                 const content = `Education: ${JSON.stringify(edu)}`;
                 await vectorStore.addDocument(content, { source: 'resume.pdf', type: 'education' });
            }
        }

         // Ingest Skills from Resume (complementary to me.json)
         if (structuredData.skills) {
             for (const skillCat of structuredData.skills) {
                 const content = `Resume Skills (${skillCat.category}): ${skillCat.items.join(', ')}`;
                 await vectorStore.addDocument(content, { source: 'resume.pdf', type: 'skills' });
             }
         }

    } else {
        console.warn("LLM parsing failed, falling back to chunking.");
        // Fallback to simple chunking if LLM fails
        // Chunking strategy: 
        // Split by newlines first to preserve line structure, but group them into chunks of ~500 chars with overlap.
        const lines = text.split('\n');
        const chunks: string[] = [];
        let currentChunk = '';
        const CHUNK_SIZE = 500;
        const OVERLAP = 100;

        for (const line of lines) {
            if ((currentChunk + line).length > CHUNK_SIZE) {
                chunks.push(currentChunk.trim());
                currentChunk = currentChunk.slice(-OVERLAP) + '\n' + line; 
            } else {
                currentChunk += (currentChunk ? '\n' : '') + line;
            }
        }
        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
        }
        
        for (const chunk of chunks) {
          if (chunk.length > 50) {
            await vectorStore.addDocument(chunk, { source: 'resume.pdf', fallback: true });
          }
        }
         console.log(`Ingested resume.pdf via fallback (${chunks.length} chunks)`);
    }

  } catch (error) {
    console.error('Error ingesting resume.pdf:', error);
  }

  // 3. Ingest GitHub
  await ingestGitHub(vectorStore);

  console.log('Ingestion complete!');
}

// Export ingest function for CLI usage
export { ingest };

// Only run if executed directly
if (require.main === module) {
  ingest().catch(console.error);
}
