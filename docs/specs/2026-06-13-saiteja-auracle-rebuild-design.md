# saiteja.ai — Auracle Rebuild Design

**Date:** 2026-06-13
**Owner:** Sai Teja Pusuluri
**Status:** Approved direction (four-phase build authorized)

## Goal

Rebuild the personal site **saiteja.ai** inside the Auracle factory: decommission
Replit, host on Auracle/GCP, re-skin with the **Aura** design system, generate art +
blog infographics with **nano-banana** (Gemini 3 Pro Image), and automate a
blog → LinkedIn publishing pipeline to Sai's **personal** profile.

## Locked decisions (from clarifying questions, 2026-06-13)

| Decision | Choice | Rationale |
|---|---|---|
| Database | New named **Firestore** DB `saiteja-site` in `auracle-prod-311` | Sai's call; same project as Auracle, free tier, owner creds available. Created 2026-06-14. |
| Rebuild scope | **Fresh rebuild** in factory Aura/shadcn stack | Sai's call; clean slate, native Aura + Firestore, drops Replit/Drizzle coupling. |
| Stack | Next.js 16 (App Router) + React 19 + TS + Tailwind v4 + shadcn (Aura) | SSG/ISR for blog SEO; route handlers for contact + LinkedIn; shadcn-native Aura; one container to Cloud Run. |
| LinkedIn target | **Personal profile** via official free *Share on LinkedIn* API | Sai's call; $0, no partner approval, ToS-compliant. Apify excluded (scraping-only, ban risk). |
| Scope | **All four phases** | Sai's call; stop only for LinkedIn OAuth + apex DNS flip. |
| Repo | `sai19872000/AIResearchPortfolio`, branch `auracle-rebuild` | Existing saiteja.ai repo; preserves history, resume PDF, content. |
| Hosting | **Cloud Run** (`auracle-prod-311`, us-central1) + Cloudflare DNS | Matches factory `lib/deploy.py` recipe (spiritual-reader analog). |

## Current state (what we're replacing)

- **Runtime:** Vite/React SPA + Express + Drizzle ORM + Postgres (Neon), on **Replit
  Autoscale** (Google-backed origin), DNS already on **Cloudflare** (clark/diva NS).
- **Content:** single-page portfolio — hero, about, skills, experience (×4), projects
  (×3), publications (×4), contact form (SendGrid → hello@saiteja.ai), resume PDF.
  Blog (26 posts) lives in Postgres but is **not rendered** by the current frontend.
- **Data export:** `/home/sai/Downloads/db_aiportfolio/*.json` — blog_posts(26),
  references(34), images(6), blog_post_references(20), subscribers(1), plus empty
  tables. `portfolio-content.json` holds the resume/portfolio content.
- **Assets:** `attached_assets/` — resume PDF, two AI-generated videos, two PNGs.
  Project cards currently use **Unsplash hotlinks** (banned by Aura → replace with art).

## Target architecture

```
Cloudflare DNS (saiteja.ai zone)
  └── CNAME → ghs.googlehosted.com (Google-managed SSL)
        └── Cloud Run service  "saiteja-site"  (auracle-prod-311, us-central1)
              └── Next.js 16 standalone container (Node)
                    ├── SSG/ISR pages (portfolio + blog) ← Firestore (build + ISR)
                    ├── route handlers: /api/contact, /api/linkedin/*
                    └── public/ assets (resume PDF, nano-banana art, infographics)
        └── Firestore  "saiteja-site"  (auracle-prod-311)
              collections: blogPosts, references, images, subscribers,
                           contactMessages, portfolio (single doc)
```

### Data model (Firestore)

- `portfolio/main` — the whole `portfolio-content.json` as one doc (rarely changes).
- `blogPosts/{slug}` — `{title, slug, summary, content(md), tags[], readTime,
  published, publishedAt, createdAt, updatedAt, linkedinPost, twitterPost,
  referenceIds[], imageIds[], heroImage, diagrams[]}`. The junction tables collapse
  into `referenceIds[]` / `imageIds[]` arrays (Firestore-native denormalization).
- `references/{id}`, `images/{id}`, `subscribers/{id}`, `contactMessages/{auto}`.

### Components & boundaries

- `lib/firestore.ts` — Admin SDK client pinned to `database: "saiteja-site"`; typed
  accessors (`getPortfolio`, `listPosts`, `getPost`, `createContactMessage`).
- `app/` — App Router pages; server components read Firestore at build/ISR.
- `components/` — Aura-stamped UI (the four hooks + section components).
- `scripts/migrate-to-firestore.ts` — one-shot JSON → Firestore loader (idempotent).
- `scripts/genart.*` + a `blog-infographic` skill — nano-banana art (Phase 2).
- `lib/linkedin.ts` + `app/api/linkedin/*` — OAuth + publish (Phase 3).

### Aura inheritance (non-negotiable — all four hooks)

Navy `#0A0E1A` bg, cream text, periwinkle `#8AB6FF` accent (only these three). Geist
type, hairline borders (no shadows), restrained motion (120/220/480ms). Voice:
lowercase, max one italic/page, **no exclamation marks**, no marketing verbs.

1. `<AuraMark />` loading visual  2. `<AuraCredit />` footer
3. `printAuraSignature()` boot console  4. `::selection` periwinkle (ships with tokens)

Installed from `registry.saiteja.ai` via `npx shadcn add` (tokens first, then hooks).

## Phases

1. **Site + data + staging deploy** — scaffold, wire Aura, create + migrate Firestore,
   rebuild every section + a real blog (`/blog`, `/blog/[slug]`), contact route,
   Dockerfile, deploy to `new.saiteja.ai`, visual QA. *(reversible)*
2. **Art** — nano-banana hero/section art + blog infographics; replace Unsplash; bundle
   static PNGs. *(reversible)*
3. **LinkedIn pipeline** — on publish → draft (BRAND voice) + art → Telegram
   approve/edit/reject → official Share-on-LinkedIn API to personal feed.
   *Blocked on Sai's one-time LinkedIn Developer-app OAuth (access).* 
4. **Apex cutover** — flip `saiteja.ai` Cloudflare record Replit → Cloud Run; verify;
   decommission Replit. *Gated on Sai's explicit go (externally irreversible).* 

## Risks / open items

- Email for contact form: reuse SendGrid (needs key in env) or switch to a simpler
  transactional sender. Default: keep SendGrid, key via env (Hard Rule #3).
- The two "Generated using AI" videos clash with Aura's restraint — decide keep vs
  replace with nano-banana stills during Phase 2.
- LinkedIn OAuth + token storage (env only) — Sai must create the LinkedIn dev app.
- First Cloud Run deploy of a brand-new service + the apex DNS flip are the only
  L3-gated steps.
