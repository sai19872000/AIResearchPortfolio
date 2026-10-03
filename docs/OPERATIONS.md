# Operations

## CI
`.github/workflows/ci.yml` (`name: ci`, job `suite`) runs on every PR and push to main: typecheck,
unit tests, `npm audit --omit=dev --audit-level=high`, Python compile + tests, `next build`, and a
Playwright smoke against the built server in fixture mode (`SITE_FIXTURE=1`, no Firestore).
Locally: `npm test` (typecheck + unit + python) and `npm run test:e2e`.

## /api/health
`GET /api/health` returns `{ ok, sha, firestore_ok, published_count, latest_published_at,
email_notify_configured }`; HTTP 503 when not ok. `sha` is the `GIT_SHA` that `scripts/deploy.sh`
bakes in, so compare it with `git rev-parse origin/main` to detect deploy drift. Results are cached
in-process for 60 s.

## Deploy
`scripts/deploy.sh`. The SendGrid key is read from Secret Manager (`sendgrid-api-key`); the deploy
fails if it is missing (override: `SKIP_SENDGRID=1`). One-time setup:

    printf '%s' "$SENDGRID_API_KEY" | gcloud secrets create sendgrid-api-key --data-file=- --project=auracle-prod-311
    # grant the Cloud Run runtime service account roles/secretmanager.secretAccessor on it

## Rate limits (Firestore TTL)
Contact (5/h per IP) and admin login (5 failures / 15 min) limits store counters in the
`rateLimits` collection with an `expireAt` timestamp. Enable the TTL policy once:

    gcloud firestore fields ttls update expireAt --collection-group=rateLimits \
      --enable-ttl --database=saiteja-site --project=auracle-prod-311

The client IP is the rightmost X-Forwarded-For hop (`TRUSTED_PROXY_HOPS`, default 1 for Cloud Run).
The Firestore store fails open: an outage never blocks the contact form.

## Caching
Published-post reads use `unstable_cache` (300 s, tag `posts`). Admin saves/deletes call
`revalidateTag('posts')`, so edits show immediately.

## Heartbeats
The watcher and scout write JSON files to `~/.auracle/products/saiteja-blog/`
(`heartbeat.json`, `heartbeat-scout.json`; override with `SAITEJA_HEARTBEAT_DIR`) with
`written_at`, `pid` and run counters. An external health check should alert when `written_at` is stale.

## Writer / scout hardening
`claude -p` runs with `--permission-mode dontAsk`, a scoped allowlist (Bash only for
`scripts/gen_art.py`; Write/Edit only inside the request workdir), no WebFetch/WebSearch, and
`--setting-sources` from `BLOG_WRITER_SETTING_SOURCES` / `BLOG_SCOUT_SETTING_SOURCES`.
After changing these, restart (`systemctl --user restart saiteja-blog-watcher`) and run one canary post.
Auth failures (`/login`) requeue a request once within 7 days instead of failing it permanently.

## LinkedIn token expiry
`linkedin_pipeline.py exchange` records `linkedin-access-token-expires-at` in Secret Manager.
`python3 scripts/linkedin_pipeline.py token-status` prints days left and exits 2 at <= 7 days
(3 if no expiry is recorded). Seed an existing token:

    printf '<ISO-8601 UTC>' | gcloud secrets versions add linkedin-access-token-expires-at --data-file=- --project=auracle-prod-311

## Source-capture regression
`python3 scripts/check_source_capture.py` (host only, needs network + chromium) captures five
representative publishers and requires each PNG > 50 KB.
