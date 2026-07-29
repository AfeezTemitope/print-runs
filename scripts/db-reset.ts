/* Wipe the database and rebuild it from migrations: npm run db:reset
 *
 * DESTRUCTIVE. Drops every table, type and row in the public schema, then re-runs all
 * migrations from 0000. Intended for a development database holding test data only.
 *
 * Guarded twice on purpose: it refuses to run unless CONFIRM_RESET=yes is set, and it
 * prints the database host first so you can see which one you are about to destroy.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.log('\nDATABASE_URL is not set. Check your .env file.\n'); process.exit(1); }

  const host = (() => { try { return new URL(url).host; } catch { return '(unparseable)'; } })();

  console.log('\n=====================================================');
  console.log('  DATABASE RESET — this destroys all data');
  console.log(`  Target: ${host}`);
  console.log('=====================================================\n');

  if (process.env.CONFIRM_RESET !== 'yes') {
    console.log('  Refusing to run without confirmation.\n');
    console.log('  If that host is correct and the data is disposable, run:\n');
    console.log('      CONFIRM_RESET=yes npm run db:reset\n');
    process.exit(1);
  }

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);

  try {
    await sql`SELECT 1`;
  } catch (e) {
    console.log(`  Cannot connect: ${e instanceof Error ? e.message : String(e)}`);
    console.log('  Fix the connection first (see: npm run db:check)\n');
    process.exit(1);
  }

  console.log('  Dropping the public schema…');
  // CASCADE takes the tables, the enum types and Drizzle's own bookkeeping with it.
  await sql`DROP SCHEMA IF EXISTS public CASCADE`;
  await sql`CREATE SCHEMA public`;
  // Drizzle records applied migrations in its own schema — drop that too, or it will think
  // 0000 and 0001 have already run and skip them, leaving an empty database.
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
  console.log('  Schema dropped and recreated.');

  console.log('\n  Re-running migrations from 0000…');
  execSync('npx drizzle-kit migrate', { stdio: 'inherit' });

  console.log('\n  Done. The database is now at the latest migration, with no rows.');
  console.log('  To load demo printers and products, run:  npm run seed\n');
}

main().catch((e) => { console.error('\nFailed:', e.message, '\n'); process.exit(1); });
