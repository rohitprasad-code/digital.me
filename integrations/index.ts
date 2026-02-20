import { VectorStore } from "../memory/vector_store";
import { ingestGitHub } from "./github/index";

export interface Integrator {
  name: string;
  ingest: (vectorStore: VectorStore) => Promise<void>;
}

export const integrators: Integrator[] = [
  {
    name: "github",
    ingest: ingestGitHub,
  },
];
