// ============================================================================
// run-sql-tests.mjs — the DB half of `npm run verify` (#19).
//
// Applies supabase/*.sql migrations in order, then runs every
// supabase/tests/*.test.sql. Each test uses ON_ERROR_STOP + `raise exception`,
// so psql exits non-zero on any failed assertion and fails the build.
//
// Requires `psql` on PATH and $DATABASE_URL pointing at a Supabase Postgres
// (local via `supabase start`, or CI) — the tests rely on the auth/storage
// schemas, the `authenticated` role, and `auth.uid()` that a plain Postgres
// does not have.
//
// If $DATABASE_URL is unset it SKIPS with a notice (exit 0) so `verify` still
// passes locally without a DB. CI sets DATABASE_URL to enforce the tests.
// ============================================================================

import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("db:test — DATABASE_URL not set; skipping SQL tests (CI sets it).");
  process.exit(0);
}

const MIGR_DIR = "supabase";
const TEST_DIR = join(MIGR_DIR, "tests");

function run(file) {
  execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-f", file], { stdio: "inherit" });
}

const migrations = readdirSync(MIGR_DIR)
  .filter((f) => /^\d.*\.sql$/.test(f))
  .sort();
for (const m of migrations) {
  console.log(`apply  ${m}`);
  run(join(MIGR_DIR, m));
}

const tests = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith(".test.sql"))
  .sort();
for (const t of tests) {
  console.log(`test   ${t}`);
  run(join(TEST_DIR, t));
}

console.log(`db:test — ${migrations.length} migrations applied, ${tests.length} test files passed.`);
