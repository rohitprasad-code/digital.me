import { EmbeddingPipeline } from "../jobs/embedding_pipeline";
import { ingestGitHub } from "./github/index";
import { ingestStrava } from "./strava/index";
import { ingestLinkedIn } from "./linkedin/index";

export interface Integrator {
  name: string;
  ingest: (pipeline: EmbeddingPipeline) => Promise<void>;
}

export const integrators: Integrator[] = [
  {
    name: "github",
    ingest: ingestGitHub,
  },
  {
    name: "strava",
    ingest: ingestStrava,
  },
  {
    name: "linkedin",
    ingest: ingestLinkedIn,
  },
];
