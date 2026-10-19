import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { runSettlement } from '@/lib/payouts';

/**
 * Scheduled settlement (brief item #9: "settlement is automatically triggered 48 hours after
 * delivery if no dispute is raised"). Called by Vercel Cron — see vercel.json.
 *
 * Protected by CRON_SECRET. This route moves money, so an open endpoint would let anyone on
 * the internet trigger payouts; Vercel sends the secret as a bearer token on scheduled calls.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 501 });

  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const result = await runSettlement();
  return NextResponse.json({ ok: true, ...result });
}
