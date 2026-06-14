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

## 1. Set the admin secrets (deploy)

Export two secrets before deploying; they're passed to Cloud Run (never
committed). Without `ADMIN_PASSWORD` the admin page stays locked.

```bash
export ADMIN_PASSWORD='something-long-only-you-know'
export ADMIN_SESSION_SECRET="$(openssl rand -hex 32)"   # set ONCE, keep stable
# optional, for the contact form:
export SENDGRID_API_KEY='SG....'
scripts/deploy.sh                 # redeploys with the admin enabled
```

`ADMIN_SESSION_SECRET` signs the login cookie — keep it the same across deploys
or everyone gets logged out. Sign in at `https://<host>/admin/login`.

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

## Notes / limits

- **Post text is live the instant you publish.** The **hero image** is a static
  file written to `public/art/blog/`; it appears on the deployed site after the
  next `scripts/deploy.sh`. (If you want generated art to show instantly without
  a redeploy, we can add a small public GCS bucket and point `heroImage` at it —
  that needs your OK since it creates a public bucket.)
- The writer never auto-publishes — every post is a draft until you flip it.
- You can also hand-write a post: `/admin/posts/new`.
