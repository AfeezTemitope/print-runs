/**
 * EMAIL CHANNEL. This file only knows how to send an email — what to send, and to whom, lives
 * in src/lib/notify.ts, which fans each event out to every active channel.
 *
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
