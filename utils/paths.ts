import path from "path";

export const DATA_DIR = path.resolve(process.cwd(), "data");

export const VECTOR_DIR = path.join(DATA_DIR, "vector");

export const PROCESSED_DIR = path.join(DATA_DIR, "processed");
export const STATIC_DIR = path.join(PROCESSED_DIR, "static");
export const DYNAMIC_DIR = path.join(PROCESSED_DIR, "dynamic");
export const EPISODIC_DIR = path.join(PROCESSED_DIR, "episodic");

export const REPORTS_DIR = path.join(DATA_DIR, "reports");
