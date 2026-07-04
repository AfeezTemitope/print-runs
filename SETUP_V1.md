# Print Runs — V1 Setup

Everything below assumes the installer already ran (`bash install.sh` from the project root).

## 1. Environment

```bash
cp .env.example .env
```

Fill in:

| Var | Where to get it |
|---|---|
| `DATABASE_URL` | Neon → your project → Connection string (use the **pooled** one) |
| `AUTH_SECRET` | `openssl rand -base64 32` (Git Bash has openssl) |
| `PAYSTACK_SECRET_KEY` | Paystack dashboard → Settings → API Keys (test key is fine) |
| `CLOUDINARY_*` | Cloudinary dashboard (optional — orders work without file uploads in dev) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; your prod origin on Vercel |

## 2. Database

```bash
npm run db:migrate   # applies the generated SQL in ./drizzle to Neon
npm run seed         # demo customer + 4 Lagos printers with priced products
```

Demo logins (password `password123` for all):

- Customer: `demo@printruns.ng`
- Printers: `printer1@printruns.ng` … `printer4@printruns.ng` (Yaba / Lekki / Surulere / Ikeja)

Surulere is seeded quote-only for business cards, so you can see the dashed
"Request quote" card on the printer-selection screen. Surulere also has
pickup disabled, so you can see the pickup option disappear at checkout.

## 3. Run

```bash
npm run dev
```

Full loop to test: log in as the customer → Products → Business Card →
configure → allow location (or skip) → pick a printer → pay with a
[Paystack test card](https://paystack.com/docs/payments/test-payments) →
log in as that printer in another browser → Dashboard → Job queue →
Mark printing done → Dispatch rider → check the customer's Track page.

## 4. Paystack webhook (production)

Point the webhook in your Paystack dashboard to:

```
https://<your-domain>/api/paystack/webhook
```

The callback page settles payments for users who return to the site; the
webhook settles for those who don't. Both are idempotent.

## 5. Notes

- Money is integer **kobo** everywhere in the DB. Format with `naira()` only at render.
- Prices are recomputed server-side at checkout — the client never sends an amount.
- `role = 'admin'` exists in the schema; there's no admin UI yet (by design, V1).
- Drop a real photo at `public/hero.jpg` to replace the hero illustration.
- Designer flow, quote inbox, paper bags: visible where the spec wants them visible, deferred per spec §8.
