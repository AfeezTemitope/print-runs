/* Send one of each email to yourself:  npm run test:email -- you@example.com
   With no RESEND_API_KEY set it prints what WOULD be sent and exits cleanly, which is the
   fastest way to check the copy reads right before touching any DNS. */

import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function main() {
  const to = (process.argv[2] ?? '').trim();
  if (!to.includes('@')) {
    console.error('\nUsage: npm run test:email -- you@example.com\n');
    process.exit(1);
  }

  const { emailConfigured, orderConfirmed, orderReady, orderOnTheWay, newJobForPrinter } =
    await import('../src/lib/email');

  if (!emailConfigured()) {
    console.log('\nRESEND_API_KEY / EMAIL_FROM are not set — nothing will actually send.');
    console.log('Each call below logs what it would have sent.\n');
  }

  const results = [
    ['Order confirmed', await orderConfirmed(to, { code: 'PR-TEST-01', total: '₦18,500', printer: 'Yaba Press Works' })],
    ['Order ready', await orderReady(to, { code: 'PR-TEST-01', printer: 'Yaba Press Works', collection: false })],
    ['Ready (collection)', await orderReady(to, { code: 'PR-TEST-02', printer: 'Yaba Press Works', collection: true })],
    ['On the way', await orderOnTheWay(to, { code: 'PR-TEST-01', fee: '₦2,000' })],
    ['New job (printer)', await newJobForPrinter(to, { code: 'PR-TEST-01', summary: 'Round Cut sticker · 3 × 3 in · 100 pcs' })],
  ] as const;

  console.log('');
  for (const [name, r] of results) {
    console.log(`  ${r.sent ? 'sent   ' : 'skipped'}  ${name}${r.reason ? `  (${r.reason})` : ''}`);
  }
  console.log('');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
