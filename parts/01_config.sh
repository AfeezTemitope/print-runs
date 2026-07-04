#!/usr/bin/env bash
set -euo pipefail
# Root config: package.json, Tailwind/PostCSS, Next, Drizzle, env template

cat > '.env.example' << '__PRV1__'
# Neon Postgres (pooled connection string)
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/printruns?sslmode=require"

# Any long random string: openssl rand -base64 32
AUTH_SECRET="change-me"

# Paystack (test keys for now)
PAYSTACK_SECRET_KEY="sk_test_xxx"

# Cloudinary (design file uploads) — optional in dev, orders can be placed without a file
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

# Public origin, used for Paystack callback + SEO
NEXT_PUBLIC_APP_URL="http://localhost:3000"
__PRV1__
echo '  + .env.example'

cat > 'SETUP_V1.md' << '__PRV1__'
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
__PRV1__
echo '  + SETUP_V1.md'

cat > 'drizzle.config.ts' << '__PRV1__'
import { defineConfig } from 'drizzle-kit';
import { readFileSync, existsSync } from 'node:fs';

// drizzle-kit runs outside Next, so load .env manually.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://placeholder' },
});
__PRV1__
echo '  + drizzle.config.ts'

cat > 'next.config.mjs' << '__PRV1__'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};
export default nextConfig;
__PRV1__
echo '  + next.config.mjs'

cat > 'package.json' << '__PRV1__'
{
  "name": "print-runs",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "seed": "tsx scripts/seed.ts"
  },
  "dependencies": {
    "@neondatabase/serverless": "^1.0.0",
    "bcryptjs": "^3.0.2",
    "drizzle-orm": "^0.44.0",
    "jose": "^6.0.0",
    "lucide-react": "^0.525.0",
    "next": "^15.5.18",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.0",
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "drizzle-kit": "^0.31.0",
    "eslint": "^9.15.0",
    "eslint-config-next": "^15.5.18",
    "tailwindcss": "^4.1.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.3"
  }
}
__PRV1__
echo '  + package.json'

cat > 'postcss.config.mjs' << '__PRV1__'
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
export default config;
__PRV1__
echo '  + postcss.config.mjs'

