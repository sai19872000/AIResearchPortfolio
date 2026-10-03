#!/usr/bin/env bash
# Deploy saiteja.ai to Cloud Run (auracle-prod-311) + map a saiteja.ai hostname.
# Mirrors Auracle's lib/deploy.py recipe: gcloud run deploy --source -> domain
# mapping -> Cloudflare CNAME to ghs.googlehosted.com (Google-managed TLS).
#
#   scripts/deploy.sh            # staging  -> new.saiteja.ai
#   scripts/deploy.sh <sub>      # custom subdomain -> <sub>.saiteja.ai
#
# The APEX cutover (saiteja.ai itself, off Replit) is intentionally NOT here —
# it's the externally-irreversible step; do it deliberately after reviewing
# staging (see the PR description / project memory).
#
# Needs: gcloud (authed as owner), and CLOUDFLARE_API_TOKEN + CF_ZONE_ID
# (sourced from ~/.auracle/secrets.env if present).
set -euo pipefail

SUB="${1:-new}"
SERVICE="saiteja"
PROJECT="auracle-prod-311"
REGION="us-central1"
FQDN="${SUB}.saiteja.ai"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

[ -f "$HOME/.auracle/secrets.env" ] && set -a && . "$HOME/.auracle/secrets.env" && set +a || true
CF_ZONE="${CF_ZONE_ID:-${CLOUDFLARE_ZONE_ID:-}}"

# Non-secret runtime config (replaced wholesale each deploy — fine, no secrets here).
# GIT_SHA lets /api/health report exactly what is live (the factory diffs it against
# origin/main to detect deploy drift). A dirty tree is flagged so drift is not hidden.
GIT_SHA="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
git -C "$ROOT" diff --quiet HEAD -- 2>/dev/null || GIT_SHA="${GIT_SHA}-dirty"
ENVVARS="FIRESTORE_PROJECT_ID=${PROJECT},FIRESTORE_DATABASE_ID=saiteja-site,CONTACT_TO_EMAIL=hello@saiteja.ai,SAITEJA_ART_BUCKET=saiteja-blog-art,GIT_SHA=${GIT_SHA}"
# Admin secrets live in Secret Manager — durable across reboots AND redeploys,
# never in the shell or the repo. (See docs/ADMIN_SETUP.md.)
SECRETS="ADMIN_PASSWORD=saiteja-admin-password:latest,ADMIN_SESSION_SECRET=saiteja-admin-session-secret:latest"
# SendGrid key: ALWAYS from Secret Manager. The old `SENDGRID_API_KEY=<shell var>` env
# var was dropped by any redeploy run without it exported (--set-env-vars replaces
# wholesale), silently disabling contact-email notifications. If the secret does not
# exist the deploy FAILS LOUD instead of shipping without notifications:
#   printf '%s' "$KEY" | gcloud secrets create sendgrid-api-key --data-file=- --project=auracle-prod-311
if ! gcloud secrets describe sendgrid-api-key --project="$PROJECT" >/dev/null 2>&1; then
  echo "✗ Secret Manager secret 'sendgrid-api-key' not found in $PROJECT." >&2
  echo "  Create it first (see docs/OPERATIONS.md), or set SKIP_SENDGRID=1 to deploy without email notify." >&2
  [ "${SKIP_SENDGRID:-0}" = "1" ] || exit 1
else
  SECRETS="${SECRETS},SENDGRID_API_KEY=sendgrid-api-key:latest"
fi

echo "▶ 1/3  building + deploying '$SERVICE' from source (Cloud Build)…"
gcloud run deploy "$SERVICE" \
  --source "$ROOT" \
  --project="$PROJECT" --region="$REGION" \
  --allow-unauthenticated --port=8080 --memory=512Mi \
  --min-instances=0 --max-instances=3 --quiet \
  --set-env-vars="$ENVVARS" \
  --set-secrets="$SECRETS"

echo "▶ 2/3  mapping ${FQDN} -> ${SERVICE}…"
gcloud beta run domain-mappings create \
  --service="$SERVICE" --domain="$FQDN" \
  --project="$PROJECT" --region="$REGION" --quiet || \
  echo "  (mapping may already exist — continuing)"

echo "▶ 3/3  Cloudflare CNAME ${FQDN} -> ghs.googlehosted.com (proxied=false)…"
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "$CF_ZONE" ]; then
  curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json" \
    --data "{\"type\":\"CNAME\",\"name\":\"${SUB}\",\"content\":\"ghs.googlehosted.com\",\"ttl\":300,\"proxied\":false}" \
    >/dev/null && echo "  CNAME created" || echo "  CNAME create failed (may already exist)"
else
  echo "  ⚠ no CLOUDFLARE_API_TOKEN/CF_ZONE_ID — add the CNAME manually:"
  echo "    ${SUB}  CNAME  ghs.googlehosted.com  (DNS only, not proxied)"
fi

echo "✓ done. https://${FQDN} (Google cert can take a few minutes to issue)"
