/* Check what actually happened to the database: npx tsx scripts/db-check.ts
   Prints straight to the terminal — no browser, no local.drizzle.studio, no DNS involved. */

import { readFileSync, existsSync } from 'node:fs';

// tsx doesn't autoload .env
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function main() {
  const { neon } = await import('@neondatabase/serverless');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('\nDATABASE_URL is not set. Check your .env file.\n');
    process.exit(1);
  }
  const sql = neon(url);

  // Connect FIRST, before anything else. Without this, a network failure gets swallowed by
  // the try/catch below and misreported as "nothing has been migrated" — which is a very
  // different (and much scarier) conclusion than "your laptop can't reach the database".
  console.log('\n=== Can we reach the database? ===');
  const host = (() => { try { return new URL(url).host; } catch { return '(unparseable DATABASE_URL)'; } })();
  console.log(`  host: ${host}`);
  try {
    await sql`SELECT 1`;
    console.log('  connected OK');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  CANNOT CONNECT — ${msg}`);
    console.log(`
  This is a connection problem, not a database problem. Nothing below can be
  checked until it is fixed. Most likely causes, in order:

    1. No internet, or DNS trouble on this machine. Test with:
           ping google.com
       (If local.drizzle.studio also failed to resolve, this is the likely cause.)

    2. The Neon project is paused, or the connection string is stale/rotated.
       Open the Neon console, copy the connection string fresh, and update .env

    3. .env is missing or DATABASE_URL is wrong. Check with:
           cat .env | grep DATABASE_URL

    4. A firewall or your ISP is blocking the connection.

  IMPORTANT: because this failed, we do NOT know whether the migration ran.
  Do not assume either way — fix the connection and run this script again.
`);
    process.exit(1);
  }

  console.log('\n=== Which migrations have run? ===');
  try {
    const applied = await sql`
      SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
    ` as { hash: string; created_at: string }[];
    if (!applied.length) console.log('  none — the database has never been migrated');
    else applied.forEach((r, i) => console.log(`  ${i + 1}. applied ${new Date(Number(r.created_at)).toISOString()}`));
  } catch {
    console.log('  no migration table found — nothing has been migrated yet');
  }

  console.log('\n=== Has the V2 migration landed? ===');
  const cols = await sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'
  ` as { column_name: string }[];
  const names = cols.map((c) => c.column_name);
  const v2Markers = ['selling_price_kobo', 'platform_fee_kobo', 'handover_at', 'contact_email'];
  const v1Markers = ['price_kobo', 'completed_at'];
  const hasV2 = v2Markers.filter((c) => names.includes(c));
  const hasV1 = v1Markers.filter((c) => names.includes(c));

  if (hasV2.length === v2Markers.length && hasV1.length === 0) {
    console.log('  YES — V2 schema is in place, old V1 columns are gone.');
    console.log('  This means the live V1 site WILL error until Part 3 is deployed.');
  } else if (hasV2.length === 0 && hasV1.length > 0) {
    console.log('  NO — still on the V1 schema. The migration has not run.');
  } else {
    console.log('  PARTIAL — this is unexpected. Found V2 columns:', hasV2.join(', ') || 'none');
    console.log('  Found leftover V1 columns:', hasV1.join(', ') || 'none');
  }

  console.log('\n=== Platform settings (should hold the 500 naira fee) ===');
  try {
    const rows = await sql`SELECT key, value_kobo FROM platform_settings` as { key: string; value_kobo: number }[];
    if (!rows.length) console.log('  empty');
    else rows.forEach((r) => console.log(`  ${r.key} = ${r.value_kobo} kobo (₦${r.value_kobo / 100})`));
  } catch {
    console.log('  table does not exist yet');
  }

  console.log('\n=== Row counts ===');
  const counters: [string, () => Promise<unknown>][] = [
    ['users',    () => sql`SELECT COUNT(*)::int AS n FROM users`],
    ['shops',    () => sql`SELECT COUNT(*)::int AS n FROM shops`],
    ['products', () => sql`SELECT COUNT(*)::int AS n FROM products`],
    ['orders',   () => sql`SELECT COUNT(*)::int AS n FROM orders`],
    ['payments', () => sql`SELECT COUNT(*)::int AS n FROM payments`],
  ];
  for (const [name, run] of counters) {
    try {
      const r = (await run()) as { n: number }[];
      console.log(`  ${name.padEnd(10)} ${r[0].n}`);
    } catch {
      console.log(`  ${name.padEnd(10)} (missing)`);
    }
  }

  console.log('\n=== Order statuses in use ===');
  try {
    const r = await sql`SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status` as { status: string; n: number }[];
    if (!r.length) console.log('  no orders');
    else r.forEach((x) => console.log(`  ${x.status.padEnd(22)} ${x.n}`));
  } catch {
    console.log('  could not read orders');
  }
  console.log('');
}

main().catch((e) => { console.error('\nFailed:', e.message, '\n'); process.exit(1); });
