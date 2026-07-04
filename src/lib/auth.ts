import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';

const COOKIE = 'pr_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Session = { uid: string; role: 'customer' | 'printer' | 'designer' | 'admin' };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(s);
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<Session>(token, secret());
    return { uid: payload.uid, role: payload.role };
  } catch {
    return null;
  }
});

/** Current printer's shop, or null. */
export const getMyShop = cache(async () => {
  const s = await getSession();
  if (!s || (s.role !== 'printer' && s.role !== 'admin')) return null;
  const rows = await db().select().from(tables.shops).where(eq(tables.shops.userId, s.uid)).limit(1);
  return rows[0] ?? null;
});
