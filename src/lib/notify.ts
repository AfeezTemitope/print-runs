import { db, tables } from '@/db';
import { sendEmail } from '@/lib/email';

/**
 * THE NOTIFICATION INTERFACE (September brief: "Notification Stack — Build Without Termii").
 *
 * Every event in the platform is sent through deliver(), never straight to a channel. Each
 * channel decides for itself whether it can reach the recipient, and runs independently:
 *
 *   email     — Resend. Live.
 *   in-app    — a row in `notifications`, shown in the bell. Live.
 *   whatsapp  — Termii. Built as a channel, OFF until onboarding completes.
 *
 * Turning WhatsApp on is a change to THIS FILE ONLY. No call site anywhere in the app needs
 * touching, because they all pass a Recipient and an event — never a channel.
 *
 * A failing channel never stops the others and never throws: the order or payment that
 * triggered it is already recorded, and a missed notification is a support question, not a
 * lost sale.
 */

/**
 * Who to tell. Pass whatever is known: a userId reaches the in-app inbox, an email reaches
 * the inbox, a phone will reach WhatsApp. A bare string is accepted as an email address, so
 * a guest checkout with no account still gets its receipt.
 */
export type Recipient =
  | string
  | { userId?: string | null; email?: string | null; phone?: string | null };

export type Message = {
  subject: string;
  heading: string;
  body: string[];
  cta?: { label: string; url: string };
};

type Resolved = { userId: string | null; email: string | null; phone: string | null };

function resolve(r: Recipient): Resolved {
  if (typeof r === 'string') return { userId: null, email: r || null, phone: null };
  return { userId: r.userId ?? null, email: r.email ?? null, phone: r.phone ?? null };
}

/** HTML is fine in an email; in the inbox and on WhatsApp it must be plain text. */
export function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

const site = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://printruns.ng';

/** The in-app link is stored as a path, so it survives a domain change and works on preview. */
function toPath(url: string | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).pathname + new URL(url).search; } catch { return url.startsWith('/') ? url : null; }
}

/* ------------------------------------------------------------------ */
/* Channels                                                            */
/* ------------------------------------------------------------------ */

type ChannelResult = { channel: string; sent: boolean; reason?: string };

async function emailChannel(to: Resolved, m: Message): Promise<ChannelResult> {
  if (!to.email) return { channel: 'email', sent: false, reason: 'no_address' };
  const r = await sendEmail({ to: to.email, subject: m.subject, heading: m.heading, body: m.body, cta: m.cta });
  return { channel: 'email', ...r };
}

async function inAppChannel(to: Resolved, m: Message): Promise<ChannelResult> {
  if (!to.userId) return { channel: 'inapp', sent: false, reason: 'no_account' };
  try {
    await db().insert(tables.notifications).values({
      userId: to.userId,
      title: m.heading,
      body: plainText(m.body[0] ?? ''),
      href: toPath(m.cta?.url),
    });
    return { channel: 'inapp', sent: true };
  } catch (e) {
    console.error('[notify] in-app failed:', e);
    return { channel: 'inapp', sent: false, reason: 'threw' };
  }
}

/**
 * WhatsApp via Termii. Present as a real channel so switching it on touches nothing else —
 * it simply declines to send until WHATSAPP_ENABLED is set. Meta requires every business
 * message to use a pre-approved template, so the send itself is filled in once Termii hands
 * over the approved template IDs; writing it before then would be guessing at their shape.
 */
async function whatsappChannel(to: Resolved, _m: Message): Promise<ChannelResult> {
  if (process.env.WHATSAPP_ENABLED !== 'true') return { channel: 'whatsapp', sent: false, reason: 'not_enabled' };
  if (!to.phone) return { channel: 'whatsapp', sent: false, reason: 'no_phone' };
  return { channel: 'whatsapp', sent: false, reason: 'templates_pending' };
}

const CHANNELS = [emailChannel, inAppChannel, whatsappChannel];

/**
 * Send one event to one person on every channel that can reach them. Channels run in parallel
 * and independently — Resend being down does not stop the bell, and vice versa.
 */
export async function deliver(recipient: Recipient, message: Message): Promise<ChannelResult[]> {
  const to = resolve(recipient);
  const results = await Promise.allSettled(CHANNELS.map((ch) => ch(to, message)));
  return results.map((r, i) => (r.status === 'fulfilled'
    ? r.value
    : { channel: ['email', 'inapp', 'whatsapp'][i], sent: false, reason: 'threw' }));
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */


export function orderConfirmed(
  to: Recipient, o: { code: string; total: string; printer: string }) {
  return deliver(to, {
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

export function orderReady(
  to: Recipient, o: { code: string; printer: string; collection: boolean }) {
  return deliver(to, {
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

export function orderOnTheWay(
  to: Recipient, o: { code: string; fee: string }) {
  return deliver(to, {
    subject: `Order ${o.code} is on the way`,
    heading: 'Your order is on the way',
    body: [
      `Order <strong>${o.code}</strong> has left the printer.`,
      `Please have <strong>${o.fee}</strong> in cash ready for the rider. This is the delivery fee you agreed — it hasn't been charged to your card.`,
    ],
    cta: { label: 'Track your order', url: `${site()}/track?code=${encodeURIComponent(o.code)}` },
  });
}

export function newJobForPrinter(
  to: Recipient, o: { code: string; summary: string }) {
  return deliver(to, {
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
  to: Recipient,
  o: { code: string; total: string; studio: string; reviewMode: 'review' | 'direct' },
) {
  return deliver(to, {
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

export function newDesignBrief(
  to: Recipient, o: { code: string; service: string }) {
  return deliver(to, {
    subject: `New brief — ${o.code}`,
    heading: 'You have a new design brief',
    body: [
      `A customer has paid for <strong>${o.service}</strong>.`,
      `Brief <strong>${o.code}</strong> is waiting in your studio.`,
    ],
    cta: { label: 'Open your studio', url: `${site()}/studio/jobs` },
  });
}

export function proofReady(
  to: Recipient, o: { code: string; round: number; studio: string }) {
  return deliver(to, {
    subject: `Proof ${o.round} ready — ${o.code}`,
    heading: 'Your proof is ready to review',
    body: [
      `<strong>${o.studio}</strong> has sent proof ${o.round} for order <strong>${o.code}</strong>.`,
      `Check it carefully. Once you approve it, that version goes to print, and errors visible in an approved proof can't be refunded.`,
    ],
    cta: { label: 'Review your proof', url: `${site()}/orders/design/${o.code}` },
  });
}

export function revisionRequested(
  to: Recipient, o: { code: string; note: string }) {
  return deliver(to, {
    subject: `Revision requested — ${o.code}`,
    heading: 'The customer has asked for changes',
    body: [`On order <strong>${o.code}</strong>:`, o.note],
    cta: { label: 'Open your studio', url: `${site()}/studio/jobs` },
  });
}

export function designApproved(
  to: Recipient, o: { code: string }) {
  return deliver(to, {
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
  to: Recipient,
  o: { code: string; printer: string; amount: number; note: string },
) {
  const naira = `₦${(o.amount / 100).toLocaleString('en-NG')}`;
  return deliver(to, {
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

export function preflightPassed(
  to: Recipient, o: { code: string; printer: string }) {
  return deliver(to, {
    subject: `File check passed — ${o.code}`,
    heading: 'Your file passed our print check',
    body: [
      `Good news — your file is print-ready, and order <strong>${o.code}</strong> has been sent to <strong>${o.printer}</strong>.`,
      `They'll start work shortly. You'll hear from us again when it's ready.`,
    ],
    cta: { label: 'Track your order', url: `${site()}/orders` },
  });
}

export function preflightFailed(
  to: Recipient, o: { code: string; issues: string[]; note: string }) {
  return deliver(to, {
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

/**
 * The printer has been paid. The one message a printer most wants, and the one that did not
 * exist until the notification interface did.
 */
export function payoutSent(
  to: Recipient,
  o: { code: string; amount: string; kind: 'settlement' | 'advance' },
) {
  return deliver(to, {
    subject: o.kind === 'advance' ? `Advance sent — ${o.code}` : `You've been paid — ${o.code}`,
    heading: o.kind === 'advance' ? 'Your materials advance is on its way' : "You've been paid",
    body: [
      o.kind === 'advance'
        ? `We've sent <strong>${o.amount}</strong> for materials on order <strong>${o.code}</strong>. The balance follows after delivery.`
        : `We've sent <strong>${o.amount}</strong> for order <strong>${o.code}</strong> to your bank account.`,
      `It can take a few minutes to a few hours to show, depending on your bank.`,
    ],
    cta: { label: 'See your payouts', url: `${site()}/dashboard/payouts` },
  });
}
