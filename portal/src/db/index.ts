import "server-only";
import type { Pool } from "pg";
import { createDb, type Db } from "./client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see portal/.env.example)");

// Reuse one pool across hot reloads in dev
const g = globalThis as unknown as { __portalDb?: { db: Db; pool: Pool } };
const conn = g.__portalDb ?? createDb(url);
if (process.env.NODE_ENV !== "production") g.__portalDb = conn;

export const db = conn.db;
export type { Db };
