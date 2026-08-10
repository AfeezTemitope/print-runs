import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { paystackInitialize } from '@/lib/paystack';
import { getPlatformFeeKobo } from '@/lib/pricing';
import { computeDesignTotals } from '@/lib/design-orders';
import { designOrderCode } from '@/lib/format';
import { LEGAL_VERSION } from '@/lib/legal';
import type { PendingDesignMetadata } from '@/lib/settle';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in to continue.' }, { status: 401 });

  const body = (await req.json()) as Record<string, string>;
  const brief = (body.brief ?? '').trim();
  const contactEmail = (body.contactEmail ?? '').trim();
  const contactPhone = (body.contactPhone ?? '').trim();
  const reviewMode = body.reviewMode === 'direct' ? 'direct' : 'review';

  if (brief.length < 20) {
    return NextResponse.json({ error: 'Tell the designer what you need — at least a couple of sentences.' }, { status: 400 });
  }
  if (!contactEmail.includes('@')) return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });
  if (contactPhone.replace(/\D/g, '').length < 7) return NextResponse.json({ error: 'Enter a phone number.' }, { status: 400 });
  if (body.legalAccepted !== 'true') {
    return NextResponse.json({ error: 'Please accept the Terms and policies to continue.' }, { status: 400 });
  }

  const [service] = await db().select().from(tables.designerServices)
    .where(eq(tables.designerServices.id, body.service ?? '')).limit(1);
  if (!service?.isActive) return NextResponse.json({ error: 'That service is no longer available.' }, { status: 404 });

  const [studio] = await db().select().from(tables.designerStudios)
    .where(eq(tables.designerStudios.id, service.studioId)).limit(1);
  // Same rule as printers: an unverified studio can never take an order, even by direct post.
  if (!studio || studio.verification !== 'verified' || !studio.isActive) {
    return NextResponse.json({ error: 'That designer is not taking work right now.' }, { status: 404 });
  }

  const platformFeeKobo = await getPlatformFeeKobo((key) =>
    db().select().from(tables.platformSettings).where(eq(tables.platformSettings.key, key)).limit(1)
      .then((rows) => rows[0]),
  );

  const totals = computeDesignTotals(service.priceKobo, platformFeeKobo);
  const reference = designOrderCode();

  const metadata: PendingDesignMetadata = {
    kind: 'design',
    customerId: session.uid,
    studioId: studio.id,
    serviceId: service.id,
    serviceTitle: service.title,
    reviewMode,
    brief,
    briefFileUrl: body.briefFile || null,
    contactEmail,
    contactPhone,
    ...totals,
    revisionsIncluded: service.revisionsIncluded,
    extraRevisionKobo: service.extraRevisionKobo,
    legalVersionAccepted: LEGAL_VERSION,
  };

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  try {
    const init = await paystackInitialize({
      email: contactEmail,
      amountKobo: totals.amountPaidKobo,
      reference,
      callbackUrl: `${origin}/checkout/callback`,
      metadata: metadata as unknown as Record<string, unknown>,
    });
    return NextResponse.json({ ok: true, authorizationUrl: init.authorization_url });
  } catch {
    return NextResponse.json({ error: 'Could not start payment. Try again.' }, { status: 502 });
  }
}
