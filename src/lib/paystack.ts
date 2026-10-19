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

/* ------------------------------------------------------------------ */
/* Transfers — paying printers (Round 3b)                              */
/* ------------------------------------------------------------------ */

/**
 * Whether money may leave automatically. Paystack gates Transfers behind a separate approval,
 * so this is OFF until the founder confirms it is enabled on the business account. While off,
 * payouts are recorded as due and an admin marks them paid by hand — the flow is identical,
 * only the last step is manual, so switching on is a variable change rather than a rewrite.
 */
export function transfersEnabled(): boolean {
  return process.env.PAYSTACK_TRANSFERS_ENABLED === 'true';
}

type PaystackResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function paystackCall<T>(path: string, init?: RequestInit): Promise<PaystackResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
    const json = await res.json();
    if (!res.ok || !json.status) return { ok: false, message: json.message ?? `Paystack returned ${res.status}` };
    return { ok: true, data: json.data as T };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not reach Paystack.' };
  }
}

export type Bank = { name: string; code: string };

/** Nigerian banks Paystack can pay out to. */
export async function listBanks(): Promise<PaystackResult<Bank[]>> {
  const res = await paystackCall<{ name: string; code: string; active: boolean }[]>('/bank?country=nigeria&perPage=200');
  if (!res.ok) return res;
  return { ok: true, data: res.data.filter((b) => b.active !== false).map((b) => ({ name: b.name, code: b.code })) };
}

/**
 * Confirm an account number belongs to a real account, and get the name on it. A printer
 * typing one wrong digit would otherwise have their earnings sent to a stranger.
 */
export async function resolveAccount(accountNumber: string, bankCode: string) {
  return paystackCall<{ account_number: string; account_name: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  );
}

/** Register a printer's account as a transfer recipient. Done once; the code is reused. */
export async function createRecipient(input: { name: string; accountNumber: string; bankCode: string }) {
  return paystackCall<{ recipient_code: string }>('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: 'nuban',
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: 'NGN',
    }),
  });
}

/**
 * Send money. The reference is OURS and unique per payout, so a retry after a timeout cannot
 * pay twice — Paystack rejects a reused reference rather than sending the transfer again.
 */
export async function initiateTransfer(input: {
  amountKobo: number;
  recipientCode: string;
  reference: string;
  reason: string;
}) {
  return paystackCall<{ transfer_code: string; status: string }>('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reference: input.reference,
      reason: input.reason,
    }),
  });
}
