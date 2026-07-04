#!/usr/bin/env bash
# Print Runs V1 installer — run from the project root: bash install.sh
set -euo pipefail

if [ ! -f package.json ] || [ ! -d src/app ]; then
  echo "Run this from the print_runz project root (package.json + src/app must exist)." >&2
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "Print Runs V1 — installing"
echo "=========================="

echo ""
echo "[1/4] Removing files replaced by the refactor…"
rm -rf src/app/components src/app/styles src/assets
rm -f public/icons.svg
echo "  - old components, styles, assets removed"

echo ""
echo "[2/4] Writing V1 files…"
for part in "$DIR"/parts/*.sh; do
  echo "-- $(basename "$part")"
  bash "$part"
done

echo ""
echo "[3/4] Installing dependencies (npm install)…"
npm install

echo ""
echo "[4/4] Generating Drizzle migration SQL…"
npx drizzle-kit generate --name v1_init || {
  echo "  (drizzle-kit generate failed — run 'npm run db:generate' manually after checking .env)";
}

echo ""
echo "Done. Next steps:"
echo "  1. cp .env.example .env   # then fill it in (see SETUP_V1.md)"
echo "  2. npm run db:migrate     # applies ./drizzle to Neon"
echo "  3. npm run seed           # demo customer + 4 Lagos printers"
echo "  4. npm run dev"
echo ""
echo "Demo logins are printed by the seed (password123)."
