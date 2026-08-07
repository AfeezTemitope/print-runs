import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { createSession } from '@/lib/auth';
import { slugify, vendorCode } from '@/lib/format';

const schema = z.object({
  role: z.enum(['customer', 'printer', 'designer']),
  firstName: z.string().min(1).max(80),
  surname: z.string().min(1).max(80),
  email: z.string().email().toLowerCase(),
  phone: z.string().min(7).max(20),
  password: z.string().min(8).max(100),
  // printer-only
  businessName: z.string().max(120).optional(),
  addressLine1: z.string().max(160).optional(),
  addressLine2: z.string().max(160).optional(),
  addressCity: z.string().max(80).optional(),
  addressState: z.string().max(80).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the form — some fields are invalid.' }, { status: 400 });
  }
  const d = parsed.data;
  if (d.role === 'printer' && !d.businessName) {
    return NextResponse.json({ error: 'Business name is required for a printer account.' }, { status: 400 });
  }
  // Designers name their studio inside /studio rather than at signup: the studio row carries
  // a portfolio, prices and a verification state, and creating an empty one here would put a
  // half-built profile into the review queue before the designer has touched it.

  const existing = await db().select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.email, d.email)).limit(1);
  if (existing.length) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(d.password, 10);
  const [user] = await db().insert(tables.users).values({
    role: d.role,
    firstName: d.firstName,
    surname: d.surname,
    email: d.email,
    phone: d.phone,
    passwordHash,
  }).returning({ id: tables.users.id, role: tables.users.role });

  if (d.role === 'printer') {
    const base = slugify(d.businessName!);
    await db().insert(tables.shops).values({
      userId: user.id,
      code: vendorCode(),
      businessName: d.businessName!,
      slug: `${base}-${user.id.slice(0, 6)}`,
      addressLine1: d.addressLine1,
      addressLine2: d.addressLine2,
      addressCity: d.addressCity,
      addressState: d.addressState,
      lat: d.lat,
      lng: d.lng,
    });
  }

  await createSession({ uid: user.id, role: user.role });
  return NextResponse.json({ ok: true, role: user.role });
}
