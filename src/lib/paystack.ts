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
