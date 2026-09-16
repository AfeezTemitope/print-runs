/**
 * Transactional email over the Resend REST API — no SDK, matching how Cloudinary is wired.
 *
 * Designed to be INERT until configured. With no RESEND_API_KEY the send is skipped and
 * logged, so every trigger point can be built and merged now and the DNS work done whenever.
 * Nothing in the order flow depends on an email succeeding.
 */

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

type SendArgs = { to: string; subject: string; heading: string; body: string[]; cta?: { label: string; url: string } };

const BRAND = { blue: '#0000FF', navy: '#00000A', pale: '#FFFBB5' };

/**
 * One layout for every email. Inline styles only and a table-based shell, because Gmail and
 * Outlook strip <style> blocks and ignore most modern CSS.
 */
function render({ heading, body, cta }: Omit<SendArgs, 'to' | 'subject'>): string {
  const paragraphs = body
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2a2a2a">${p}</p>`)
    .join('');
  const button = cta
    ? `<a href="${cta.url}" style="display:inline-block;margin-top:8px;padding:12px 22px;border-radius:999px;background:${BRAND.blue};color:#fff;font-weight:700;font-size:14px;text-decoration:none">${cta.label}</a>`
    : '';

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f4;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:${BRAND.navy};padding:18px 24px">
<span style="color:${BRAND.pale};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">PrintRuns</span>
</td></tr>
<tr><td style="padding:26px 24px">
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:${BRAND.navy}">${heading}</h1>
${paragraphs}${button}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px dashed #d8d8d4">
<p style="margin:0;font-size:12px;color:#8a8a86">You're getting this because you placed an order on printruns.ng.</p>
</td></tr>
</table></body></html>`;
}

/**
 * Never throws and never blocks. A failed receipt must not take down a paid order — the
 * order is already recorded, and a missing email is a support question, not a lost sale.
 */
export async function sendEmail(args: SendArgs): Promise<{ sent: boolean; reason?: string }> {
  if (!emailConfigured()) {
    console.log(`[email] skipped (not configured): "${args.subject}" → ${args.to}`);
    return { sent: false, reason: 'not_configured' };
  }
  if (!args.to.includes('@')) return { sent: false, reason: 'no_address' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [args.to],
        subject: args.subject,
        html: render(args),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[email] failed (${res.status}): ${text}`);
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('[email] threw:', e);
    return { sent: false, reason: 'threw' };
  }
}

const site = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://printruns.ng';

/* ------------------------------------------------------------------ */
/* The four emails                                                     */
/* ------------------------------------------------------------------ */

export function orderConfirmed(to: string, o: { code: string; total: string; printer: string }) {
  return sendEmail({
    to,
    subject: `Order ${o.code} confirmed`,
    heading: 'Your order is confirmed',
    body: [
      `We've received your payment of <strong>${o.total}</strong> and sent your job to <strong>${o.printer}</strong>.`,
      `Your order number is <strong>${o.code}</strong> — quote it if you need to contact us.`,
      `Delivery is arranged after printing. A PrintRuns representative will call to confirm the delivery fee, which you pay the rider in cash when they arrive.`,
    ],
    cta: { label: 'Track your order', url: `${site()}/track?code=${encodeURIComponent(o.code)}` },
  });
}

export function orderReady(to: string, o: { code: string; printer: string; collection: boolean }) {
  return sendEmail({
    to,
    subject: `Order ${o.code} is ready`,
    heading: 'Your order is ready',
    body: [
      `<strong>${o.printer}</strong> has finished printing order <strong>${o.code}</strong>.`,
      o.collection
        ? `You're sending your own rider for this one. The printer will only release it to the person you named with us, so please make sure they go.`
        : `We'll call shortly to confirm the delivery fee with you. Once you agree it, the printer dispatches, and you pay the rider in cash on arrival.`,
    ],
    cta: { label: 'View your order', url: `${site()}/track?code=${encodeURIComponent(o.code)}` },
  });
}

export function orderOnTheWay(to: string, o: { code: string; fee: string }) {
  return sendEmail({
    to,
    subject: `Order ${o.code} is on the way`,
    heading: 'Your order is on the way',
    body: [
      `Order <strong>${o.code}</strong> has left the printer.`,
      `Please have <strong>${o.fee}</strong> in cash ready for the rider. This is the delivery fee you agreed — it hasn't been charged to your card.`,
    ],
    cta: { label: 'Track your order', url: `${site()}/track?code=${encodeURIComponent(o.code)}` },
  });
}

export function newJobForPrinter(to: string, o: { code: string; summary: string }) {
  return sendEmail({
    to,
    subject: `New job — ${o.code}`,
    heading: 'You have a new job',
    body: [
      `A customer has paid for <strong>${o.summary}</strong>.`,
      `Order <strong>${o.code}</strong> is waiting in your queue. Accept it or mark it as one you can't fulfil, so we can reassign it quickly if needed.`,
    ],
    cta: { label: 'Open your queue', url: `${site()}/dashboard/queue` },
  });
}

export function designOrderConfirmed(
  to: string,
  o: { code: string; total: string; studio: string; reviewMode: 'review' | 'direct' },
) {
  return sendEmail({
    to,
    subject: `Design order ${o.code} confirmed`,
    heading: 'Your designer is starting work',
    body: [
      `We've received your payment of <strong>${o.total}</strong> and sent your brief to <strong>${o.studio}</strong>.`,
      o.reviewMode === 'review'
        ? `You'll get an email when your first proof is ready. Nothing goes to print until you approve it.`
        : `You chose direct to print, so your design goes straight to production once it's finished — there's no proof step.`,
      `Your reference is <strong>${o.code}</strong>.`,
    ],
    cta: { label: 'View your design order', url: `${site()}/orders/design/${o.code}` },
  });
}

export function newDesignBrief(to: string, o: { code: string; service: string }) {
  return sendEmail({
    to,
    subject: `New brief — ${o.code}`,
    heading: 'You have a new design brief',
    body: [
      `A customer has paid for <strong>${o.service}</strong>.`,
      `Brief <strong>${o.code}</strong> is waiting in your studio.`,
    ],
    cta: { label: 'Open your studio', url: `${site()}/studio/jobs` },
  });
}

export function proofReady(to: string, o: { code: string; round: number; studio: string }) {
  return sendEmail({
    to,
    subject: `Proof ${o.round} ready — ${o.code}`,
    heading: 'Your proof is ready to review',
    body: [
      `<strong>${o.studio}</strong> has sent proof ${o.round} for order <strong>${o.code}</strong>.`,
      `Check it carefully. Once you approve it, that version goes to print, and errors visible in an approved proof can't be refunded.`,
    ],
    cta: { label: 'Review your proof', url: `${site()}/orders/design/${o.code}` },
  });
}

export function revisionRequested(to: string, o: { code: string; note: string }) {
  return sendEmail({
    to,
    subject: `Revision requested — ${o.code}`,
    heading: 'The customer has asked for changes',
    body: [`On order <strong>${o.code}</strong>:`, o.note],
    cta: { label: 'Open your studio', url: `${site()}/studio/jobs` },
  });
}

export function designApproved(to: string, o: { code: string }) {
  return sendEmail({
    to,
    subject: `Approved — ${o.code}`,
    heading: 'Your design was approved',
    body: [
      `The customer has approved the final design on order <strong>${o.code}</strong>.`,
      `This job is complete and will be included in your next settlement.`,
    ],
    cta: { label: 'Open your studio', url: `${site()}/studio/jobs` },
  });
}

export function quoteReady(
  to: string,
  o: { code: string; printer: string; amount: number; note: string },
) {
  const naira = `₦${(o.amount / 100).toLocaleString('en-NG')}`;
  return sendEmail({
    to,
    subject: `Your quote for ${o.code}`,
    heading: 'Your printer has sent a price',
    body: [
      `<strong>${o.printer}</strong> has quoted <strong>${naira}</strong> for order <strong>${o.code}</strong>.`,
      ...(o.note ? [o.note] : []),
      `Nothing has been charged. Review the quote and pay only if you're happy with it.`,
    ],
    cta: { label: 'Review your quote', url: `${site()}/orders` },
  });
}

export function preflightPassed(to: string, o: { code: string; printer: string }) {
  return sendEmail({
    to,
    subject: `File check passed — ${o.code}`,
    heading: 'Your file passed our print check',
    body: [
      `Good news — your file is print-ready, and order <strong>${o.code}</strong> has been sent to <strong>${o.printer}</strong>.`,
      `They'll start work shortly. You'll hear from us again when it's ready.`,
    ],
    cta: { label: 'Track your order', url: `${site()}/orders` },
  });
}

export function preflightFailed(to: string, o: { code: string; issues: string[]; note: string }) {
  return sendEmail({
    to,
    subject: `Your file needs a fix — ${o.code}`,
    heading: 'We found a problem with your file',
    body: [
      `We checked the file on order <strong>${o.code}</strong> before sending it to your printer, and it isn't quite print-ready:`,
      ...o.issues.map((i) => `• ${i}`),
      ...(o.note ? [o.note] : []),
      `Nothing has been printed yet. You can upload a corrected file — we'll check it again free — or send this one anyway if you're happy to.`,
    ],
    cta: { label: 'Fix or send anyway', url: `${site()}/orders` },
  });
}
