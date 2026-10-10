#!/usr/bin/env bash
# Local CI for the factory merge gate (`auracle ci`): the same checks as .github/workflows/ci.yml,
# offline-friendly, no browser download. Measured ~45s warm; the gate's hard ceiling is 300s.
#   Chromium: E2E_CHROMIUM, else the newest installed headless shell under PLAYWRIGHT_BROWSERS_PATH
#   (default ~/.cache/ms-playwright). Never downloads one.
set -euo pipefail
cd "$(dirname "$0")/.."
export NEXT_TELEMETRY_DISABLED=1 SITE_FIXTURE=1

echo "== npm ci";      npm ci --no-audit --no-fund --prefer-offline
echo "== typecheck";   npx tsc --noEmit
echo "== unit";        npm run test:unit
echo "== audit";       npm audit --omit=dev --audit-level=high
echo "== python";      python3 -m py_compile scripts/*.py && python3 scripts/run_tests.py
echo "== build";       ADMIN_PASSWORD=ci-not-a-real-password ADMIN_SESSION_SECRET=ci-not-a-real-secret npm run build

if [ -z "${E2E_CHROMIUM:-}" ]; then
  base="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
  E2E_CHROMIUM="$(ls -d "$base"/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell 2>/dev/null | sort | tail -1 || true)"
fi
[ -n "$E2E_CHROMIUM" ] && [ -x "$E2E_CHROMIUM" ] || { echo "no installed Chromium (set E2E_CHROMIUM)" >&2; exit 2; }
export E2E_CHROMIUM
echo "== e2e";         npm run test:e2e
echo "== ok"
