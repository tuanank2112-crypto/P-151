import { config } from "dotenv";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { createDb } from "../src/db/client";

config({ path: ".env.local" });

const url = process.argv.includes("--test") ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL / TEST_DATABASE_URL is not set (see .env.example)");
const name = new URL(url).pathname.slice(1);

// A fresh Postgres volume (docker compose) has no "portal" database yet: create it through the maintenance DB
async function ensureDatabase() {
  const probe = new Client({ connectionString: url });
  try {
    await probe.connect();
  } catch (e) {
    if ((e as { code?: string }).code !== "3D000") throw e; // 3D000 = database does not exist
    const admin = new URL(url!);
    admin.pathname = "/postgres";
    const c = new Client({ connectionString: admin.toString() });
    await c.connect();
    await c.query(`create database "${name.replace(/"/g, '""')}"`);
    await c.end();
    console.log(`created database ${name}`);
    return;
  } finally {
    await probe.end().catch(() => {});
  }
}

await ensureDatabase();
const { db, pool } = createDb(url);
await migrate(db, { migrationsFolder: "drizzle" });
await pool.end();
console.log(`migrated ${name}`);
