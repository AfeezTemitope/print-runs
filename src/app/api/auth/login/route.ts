import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { createSession } from '@/lib/auth';

const schema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
  }

  const rows = await db().select().from(tables.users).where(eq(tables.users.email, parsed.data.email)).limit(1);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) {
    return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
  }

  await createSession({ uid: user.id, role: user.role });
  return NextResponse.json({ ok: true, role: user.role });
}
