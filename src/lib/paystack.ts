const BASE = 'https://api.paystack.co';

function key() {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error('PAYSTACK_SECRET_KEY is not set');
  return k;
}

export async function paystackInitialize(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}) {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo, // Paystack already expects kobo
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      currency: 'NGN',
    }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || !json.status) throw new Error(json.message ?? 'Paystack initialize failed');
  return json.data as { authorization_url: string; access_code: string; reference: string };
}

export async function paystackVerify(reference: string) {
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${key()}` },
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || !json.status) throw new Error(json.message ?? 'Paystack verify failed');
  return json.data as {
    status: string;            // 'success' when paid
    amount: number;            // kobo
    reference: string;
    channel: string;
    paid_at: string | null;
    metadata: Record<string, unknown> | null;
  };
}

/**
 * Issue a refund. Omit amountKobo for a full refund; pass it for a partial one (the
 * refund-less-production-costs case).
 *
 * Never throws — the caller has already decided to cancel, and a Paystack outage must not
 * leave the order in limbo. A failure comes back as { ok: false } so the cancellation is
 * still recorded and ops is told to finish the refund by hand.
 */
export async function paystackRefund(reference: string, amountKobo?: number): Promise<
  | { ok: true; status: string }
  | { ok: false; message: string }
> {
  if (!process.env.PAYSTACK_SECRET_KEY) return { ok: false, message: 'Paystack is not configured.' };
  try {
    const res = await fetch(`${BASE}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction: reference,
        ...(amountKobo != null ? { amount: amountKobo } : {}),
      }),
      cache: 'no-store',
    });
    const json = await res.json();
    if (!res.ok || !json.status) return { ok: false, message: json.message ?? 'Paystack refused the refund.' };
    return { ok: true, status: (json.data?.status as string) ?? 'pending' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not reach Paystack.' };
  }
}
