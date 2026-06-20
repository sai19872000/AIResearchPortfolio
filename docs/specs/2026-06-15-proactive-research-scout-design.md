# Proactive Research Scout — design

**Date:** 2026-06-15
**Owner:** Sai Teja Pusuluri
**Status:** Approved direction (Q&A locked); MVP build in progress

## Goal

Flip the blogger from **reactive** (Sai feeds it arxiv links / ideas) to
**proactive**: a scheduled agent that hunts for new AI/ML research **and** big
lab announcements, vets each against a high quality bar (authentic · sound ·
genuinely important), and surfaces a short daily list of **recommendations** to
Sai in Telegram. Sai approves or skips. Approved items flow into the existing
generate → review → publish pipeline. Nothing is written or posted without an
explicit Sai approval.

## Locked decisions (from brainstorm Q&A, 2026-06-15)

| Decision | Choice |
|---|---|
| Topical scope | **Broader AI/ML** — agentic AI, LLMs, GenAI, CV/ML + adjacent (MLOps, data/infra, applied AI systems) |
| Discovery sources | **arXiv**, **Hugging Face Daily Papers**, **company announcements** (OpenAI, Anthropic, Google), enrichment via Semantic Scholar |
| Cadence / volume | **Daily**, top **1–3** recommendations total (papers + announcements mixed) |
| Validation rigor | **Deep multi-agent** gate (assessor + adversarial skeptic + deterministic judge) on finalists |
| Recommendation surface | **@Bloggersaibot** Telegram card with `[Draft this]` / `[Skip]` |
| Approval flow | **Two gates**: (1) recommendation approve/skip, then (2) the existing draft Publish/Reject |
| Every post links | **Sai's blog post URL** + the **original source link** (paper / announcement), in the post body AND the LinkedIn caption |

Note: **Papers with Code is defunct** (Meta sunset it in 2025) — dropped. HF
Daily Papers already carries the engagement + code signal we wanted from it.

## Architecture — a funnel upstream of the existing pipeline

```
[ research_scout.py ]  (NEW — daily systemd timer)
   │  1. DISCOVER  — pull new candidates from all sources (last ~2 days)
   │  2. DEDUP     — drop anything already in researchCandidates / already blogged
   │  3. PREFILTER — cheap, no-LLM signals → ~8 paper + ~5 announcement finalists
   │  4. DEEP GATE — claude -p agents on finalists:
   │        • assessor  (per finalist): relevance/quality/importance/novelty + concerns
   │        • skeptic   (top ~3 papers): argues AGAINST featuring — overclaim/thin/incremental
   │        • judge     (deterministic): combine → recommend? + confidence + why-it-matters
   │  5. WRITE     — top 1–3 → Firestore `researchCandidates` (status=recommended)
   ▼
[ blog_bot.py ]  (EXISTING + new handlers)
   │  notify_research_candidates() → Telegram card per rec  → [Draft this] / [Skip]   ← GATE 1
   │  on [Draft this] → create blogGenRequest {kind, sourceUrl, references=[source]}
   ▼
[ blog_watcher.py ]  (EXISTING + source-link handling)
   │  generates the draft (claude -p + blog-art), stores sourceUrl on the post
   ▼
[ blog_bot.py ]  draft card → [Publish] / [Reject]                                    ← GATE 2
   ▼
  blog goes live + LinkedIn auto-post (Posts API) — caption carries BOTH links
```

Everything from "create blogGenRequest" downstream is the pipeline that already
works. The scout only adds discovery + vetting + the recommendation gate.

## Components

### 1. `scripts/research_scout.py` (new) + `saiteja-research-scout.timer`
A daily one-shot. Sections:

- **Sources** (each a small adapter returning normalized candidates
  `{kind, source, source_id, title, url, abstract, authors, signals{}}`):
  - `arxiv` — `export.arxiv.org/api/query`, cats `cs.AI, cs.LG, cs.CL, cs.CV`,
    sorted by submittedDate, last ~2 days. `kind="research"`.
  - `hf_daily` — `huggingface.co/api/daily_papers` — pre-curated, carries
    `upvotes` (strong importance signal). `kind="research"`.
  - `announcements` — RSS/news from labs. `kind="announcement"`:
    - OpenAI `openai.com/news/rss.xml` (RSS ✓)
    - Google AI `blog.google/technology/ai/rss/` + DeepMind
      `deepmind.google/blog/rss.xml` (RSS ✓)
    - Anthropic `anthropic.com/news` (no clean RSS → light HTML parse,
      best-effort; degrades to empty on failure)
  - X / LinkedIn deliberately **not scraped** (ToS / ban risk, same rule the
    LinkedIn pipeline follows). The labs mirror everything to their blogs.
- **Dedup** — skip `source_id`s already in `researchCandidates`, and topics
  whose slug already exists in `blogPosts`.
- **Prefilter** (no LLM) → a score from computable signals:
  niche-keyword relevance (title/abstract hits against a curated AI/ML
  keyword set), HF upvotes, recency, and (best-effort, throttled) Semantic
  Scholar citation velocity for non-brand-new papers. Keep the top ~8 papers
  and ~5 announcements. Recall-oriented (better to over-admit to the gate).
- **Deep gate** (`claude -p`, scoped allowlist mirroring the watcher):
  - `assessor` — one call per finalist, reads title+abstract(+fetched text),
    returns JSON `{relevance, quality, importance, novelty, summary,
    concerns[], recommend, confidence}` (0–10 scales). Announcements get a
    lighter prompt (authenticity is a given — it's the official source — so it
    scores significance + angle only).
  - `skeptic` — for the top ~3 papers by assessor score, an INDEPENDENT call
    prompted to **refute**: find overclaiming, weak/narrow eval, incremental
    delta, or integrity issues. Returns `{caseAgainst, severity, stillWorthIt}`.
  - `judge` — deterministic: drop if `skeptic.severity=="high" and not
    stillWorthIt`; otherwise keep. Final `whyItMatters` = assessor summary,
    `watchOut` = skeptic caseAgainst.
  - Bounded: ≤ ~11 `claude -p` calls/day (Max sub, $0). Finalist counts are
    env-tunable.
- **Output** — write up to 3 survivors (ranked by importance×confidence) to
  `researchCandidates` with `status="recommended"`, `notified=false`.

### 2. `scripts/blog_bot.py` (existing + handlers)
- `notify_research_candidates(db)` (runs each poll loop, like
  `notify_ready_drafts`): for each `recommended` + un-notified candidate, send a
  Telegram card — title, kind badge (📄 research / 📣 announcement), the
  why-it-matters + what-to-watch, source link, and `[✍️ Draft this]` /
  `[✕ Skip]`. Caption built with the same safe-length rules as the draft card.
- `handle_callback` gains `rd:<key>` (draft) and `rs:<key>` (skip):
  - **draft** → create a `blogGenRequest` `{topic: "<title>", kind,
    sourceUrl: <url>, referenceUrls: [<url>], source: "scout"}`; set candidate
    `status="accepted"`; edit the card to "✍️ queued — drafting".
  - **skip** → candidate `status="skipped"`; edit card to "✕ skipped".

### 3. `scripts/blog_watcher.py` (existing + source link)
- Carry `kind` + `sourceUrl` from the request onto the generated `blogPost`.
- TASK addition: the post must (a) open from the source, (b) include the
  original source link inline near the top, and (c) for `kind=announcement`,
  write a tight *informational* post (what shipped, why it matters, a take) —
  not a deep research essay. The blog self-links as today.

### 4. `scripts/linkedin_pipeline.py` (existing + dual link)
- `build_draft` appends BOTH links when `sourceUrl` is set: the blog post URL
  (as today) **and** a `Original: <sourceUrl>` line — so every LinkedIn post
  points to Sai's write-up and the primary source.

## Data model

New collection **`researchCandidates`** (doc id = stable hash of `source_id`):
```
kind            "research" | "announcement"
source          "arxiv" | "hf_daily" | "openai" | "anthropic" | "google" | ...
source_id       arxiv id / url / guid
title, url, abstract, authors[]
signals         { upvotes, citationVelocity, keywordScore, recencyDays, ... }
prefilterScore  float
verdict         { relevance, quality, importance, novelty, confidence,
                  whyItMatters, watchOut, recommend }
status          "seen" | "recommended" | "accepted" | "skipped"
notified        bool ; tgMessageId ; tgKey
createdAt
```
`blogPosts` gains `sourceUrl` (string|null) and `kind` ("research" |
"announcement" | null). `blogGenRequests` gains `kind` + `sourceUrl`.

## Scheduling
`saiteja-research-scout.service` (oneshot) + `.timer` (daily ~13:00 UTC / 09:00
ET, before the morning). systemd `--user`, linger already on. Env mirrors the
watcher (gcloud ADC, `GOOGLE_APPLICATION_CREDENTIALS` dropped). Manual run:
`python3 scripts/research_scout.py --once [--dry-run]`.

## Error handling
- Any single source failing degrades to the others (best-effort discovery).
- Semantic Scholar 429 → skip that signal, don't block.
- A finalist whose paper text won't fetch → assessor runs on title+abstract.
- The scout never posts or publishes — its terminal action is writing a
  `recommended` candidate. Both user gates remain.

## Out of scope (MVP) / future
- Embedding-based relevance (MVP uses keyword scoring); learning from Sai's
  accept/skip history to tune the prefilter.
- X / LinkedIn ingestion (ToS); OpenReview review-score signal.
- Auto-draft of the top pick (kept behind the recommendation gate for now).

## Success criteria
A daily Telegram digest of 1–3 genuinely worth-it items, each with a crisp
why-it-matters + source link; one tap drafts it; the draft still passes the
existing Publish/Reject gate; published posts link to both Sai's blog and the
original source.
