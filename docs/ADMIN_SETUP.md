# Blog admin + AI writer — setup

A password-gated `/admin` where you describe a topic (with optional reference
URLs / PDFs) and the **factory writer** drafts a full blog post on Claude (the
Max subscription — no API key, no cost), adds a nano-banana hero image, and
drops it in as a draft for you to review and publish.

Two halves that talk through Firestore:
- **The web admin** (`/admin`, runs on Cloud Run) — queues generation requests
  and lets you review / edit / publish.
- **The watcher** (`scripts/blog_watcher.py`, runs on your factory machine) —
  picks up queued requests and writes the drafts with `claude`.

## 1. Admin secrets — in Secret Manager (durable)

The admin password + session secret live in **Google Secret Manager**
(`auracle-prod-311`), so they survive machine reboots AND every redeploy —
nothing in your shell or the repo. `deploy.sh` wires them in with `--set-secrets`;
the Cloud Run runtime SA has `secretAccessor`. Already created:

- `saiteja-admin-password` — your login password.
- `saiteja-admin-session-secret` — signs the login cookie (stable across deploys).

Rotate the password anytime (takes effect on the next deploy):

```bash
printf 'my-new-password' | gcloud secrets versions add saiteja-admin-password \
  --project=auracle-prod-311 --data-file=-
scripts/deploy.sh
```

Sign in at `https://<host>/admin/login`. (`SENDGRID_API_KEY`, if you set it for
the contact form, is still passed via env at deploy time.)

## 2. Run the watcher (your machine)

The watcher needs the `claude` CLI (Max) and `agy` (for art) — both already on
your factory box. From the repo:

```bash
# one-shot: process whatever is queued, then exit
python3 scripts/blog_watcher.py --once

# or leave it running, polling every 30s
python3 scripts/blog_watcher.py --interval 30
```

It uses your gcloud (owner) ADC and drops a stray `GOOGLE_APPLICATION_CREDENTIALS`
automatically. Run it under `systemd --user` or `tmux` if you want it always on.

## 3. Use it

1. Open `/admin`, fill **Topic** (+ optional angle, reference URLs, PDF uploads,
   tone, length), hit **Generate draft**. The request lands in the queue.
2. The watcher writes the post in your voice, cites the sources, renders a hero
   image, and the draft appears under **Drafts** (status `ready`).
3. Open the draft, edit anything, flip **Published** on, **Save**. It's live on
   `/blog` immediately (the site reads Firestore at request time).
4. To post it to LinkedIn: `python3 scripts/linkedin_pipeline.py publish <slug>`
   (see `LINKEDIN_SETUP.md`).

## Art — the `blog-art` skill

The writer makes its own visuals via the project skill at
`.claude/skills/blog-art/SKILL.md`: one on-brand (Auracle) **hero** per post and
**1–2 inline infographics** where a concept is clearer shown than told, rendered
with nano-banana (`scripts/gen_art.py`) and uploaded to the public bucket
`gs://saiteja-blog-art`. Because art lives in GCS, it shows on the live site the
instant you publish — **no redeploy needed**.

Backfill heroes for the existing posts:

```bash
python3 scripts/backfill_art.py            # posts missing a hero
python3 scripts/backfill_art.py --force    # regenerate all
```

## Notes / limits

- **Everything is live the instant you publish** — post text (runtime Firestore)
  and art (GCS). No redeploy.
- The writer never auto-publishes — every post is a draft until you flip it.
- Per-post infographics for the *back-catalogue* are a heavier agentic pass;
  regenerate a specific old post through `/admin` to add them.
- You can also hand-write a post: `/admin/posts/new`.
