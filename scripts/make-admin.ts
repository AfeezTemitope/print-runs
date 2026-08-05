/* Promote an account to admin: npm run make-admin -- you@example.com
   Falls back to the ADMIN_EMAIL env var when no argument is given.

   The account must already exist — register normally first, then run this. Deliberately not
   part of the seed: creating an admin login with a known password on a deployed database
   would be a standing security hole. */

import { readFileSync, existsSync } from 'node:fs';

// tsx doesn't autoload .env
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function main() {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (!email) {
    console.error('\nNo email given.\n  npm run make-admin -- you@example.com\nor set ADMIN_EMAIL in .env\n');
    process.exit(1);
  }

  const { db, tables } = await import('../src/db');
  const { eq } = await import('drizzle-orm');

  const [user] = await db().select().from(tables.users).where(eq(tables.users.email, email)).limit(1);
  if (!user) {
    console.error(`\nNo account found for ${email}.`);
    console.error('Register that email on the site first, then run this again.\n');
    process.exit(1);
  }

  if (user.role === 'admin') {
    console.log(`\n${email} is already an admin. Nothing to do.\n`);
    return;
  }

  const previous = user.role;
  await db().update(tables.users).set({ role: 'admin' }).where(eq(tables.users.id, user.id));
  console.log(`\n${email} promoted from ${previous} to admin.`);
  console.log('Log out and back in — the role is baked into the session cookie.\n');

  if (previous === 'printer') {
    console.log('Note: that account was a printer. Its shop still exists and it keeps dashboard access.\n');
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
