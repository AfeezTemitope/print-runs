/* Apply every migration to a scratch database and report the first failure.
   Usage:  npm run db:verify -- postgres://user:pass@host/scratch_db

   This exists because the QA-round migration 0007 shipped a bug that no amount of type
   checking could catch: valid-looking SQL that Postgres rejects at execution. Reading a
   migration is not the same as running one. */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function main() {
  const url = process.argv[2] ?? process.env.SCRATCH_DATABASE_URL;
  if (!url) {
    console.error('\nUsage: npm run db:verify -- <scratch database url>');
    console.error('Or set SCRATCH_DATABASE_URL in .env.\n');
    console.error('Use a THROWAWAY database — a Neon branch is ideal. This applies every');
    console.error('migration from scratch and will fail on anything that already exists.\n');
    process.exit(1);
  }
  if (process.env.DATABASE_URL && url === process.env.DATABASE_URL) {
    console.error('\nThat is your real DATABASE_URL. Point this at a throwaway database.\n');
    process.exit(1);
  }

  // The tagged-template `neon()` helper cannot take a plain string, and these are raw DDL
  // statements read off disk. Client.query() is the right tool for that.
  const { Client } = await import('@neondatabase/serverless');
  const client = new Client(url);
  await client.connect();

  const dir = join(process.cwd(), 'drizzle');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  console.log(`\nApplying ${files.length} migrations…\n`);

  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf8');
    // drizzle splits on this marker; each chunk is one statement batch.
    const statements = raw.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    try {
      for (const statement of statements) await client.query(statement);
      console.log(`  ok      ${file}`);
    } catch (e) {
      console.log(`  FAILED  ${file}`);
      console.log(`\n${e instanceof Error ? e.message : String(e)}\n`);
      process.exit(1);
    }
  }

  console.log('\nAll migrations applied cleanly.\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
