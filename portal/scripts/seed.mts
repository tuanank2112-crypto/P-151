import { config } from "dotenv";
import { createDb } from "../src/db/client";
import { seed } from "../src/db/seed";

config({ path: ".env.local" });

const reset = process.argv.includes("--reset");
if (reset && process.env.NODE_ENV === "production") throw new Error("seed --reset is not allowed in production");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

const { db, pool } = createDb(url);
const result = await seed(db, { reset });
await pool.end();
console.log(result === "seeded" ? "seeded demo data" : "skipped: users table is not empty (use --reset to reseed)");
