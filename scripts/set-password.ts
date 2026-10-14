/* Set a new password for any account:  npm run set-password -- you@example.com "NewPassword123"

   There is no self-service password reset in the platform yet, so this is the way back in
   when an admin (or anyone) forgets theirs. Uses the same bcrypt cost as registration, so
   the login route cannot tell the difference. */

import { readFileSync, existsSync } from 'node:fs';
import bcrypt from 'bcryptjs';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  const password = process.argv[3] ?? '';

  if (!email || !password) {
    console.error('\nUsage: npm run set-password -- you@example.com "NewPassword123"\n');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('\nUse at least 8 characters.\n');
    process.exit(1);
  }

  const { db, tables } = await import('../src/db');
  const { eq } = await import('drizzle-orm');

  const [user] = await db().select().from(tables.users).where(eq(tables.users.email, email)).limit(1);
  if (!user) {
    console.error(`\nNo account found for ${email}.\n`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db().update(tables.users).set({ passwordHash }).where(eq(tables.users.id, user.id));

  console.log(`\nPassword updated for ${email} (${user.role}).`);
  console.log('Log in with the new password now.\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
