#!/usr/bin/env bash
# Build once, start `next start` in fixture mode on :3100, run the Playwright smoke, stop.
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT="${E2E_PORT:-3100}"
export SITE_FIXTURE=1 ADMIN_PASSWORD=e2e-not-a-real-password ADMIN_SESSION_SECRET=e2e-not-a-real-secret NEXT_TELEMETRY_DISABLED=1
[ -d .next ] || npm run build
# `output: standalone` => start the standalone server, with static assets alongside.
rm -rf .next/standalone/.next/static .next/standalone/public .next/standalone/tests .next/standalone/portfolio-content.json
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r tests .next/standalone/tests
cp portfolio-content.json .next/standalone/portfolio-content.json
( cd .next/standalone && PORT="$PORT" HOSTNAME=127.0.0.1 node server.js ) > /tmp/e2e-server.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -fs -o /dev/null "http://127.0.0.1:$PORT/api/health" && break; sleep 1; done
E2E_BASE_URL="http://127.0.0.1:$PORT" node tests/e2e/smoke.mjs
