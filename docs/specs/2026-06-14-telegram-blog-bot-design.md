# @Bloggersaibot — Telegram front-end for the blog pipeline

**Date:** 2026-06-14
**Owner:** Sai Teja Pusuluri
**Status:** Approved direction (clarifying answers gathered)

## Goal

A second way to drive the saiteja.ai blog → LinkedIn pipeline, from Telegram:
post an idea or reference to **@Bloggersaibot** → same generate flow → the bot
asks for approval → on approve it publishes the blog and posts to LinkedIn. The
queue and drafts are shared with the website `/admin`, and you can approve from
either the bot or the website. Registered as an Auracle-factory project so the
factory can maintain it.

## Locked decisions (clarifying answers, 2026-06-14)

| Decision | Choice |
|---|---|
| Intake | **Generate right away** — a message becomes a `blogGenRequest`; URLs become references |
| References | **Links + uploaded files** — URLs + PDF/doc uploads (text extracted, cited) |
| Approval actions | **Publish / Reject** — edits done in the website editor |
| Approval message | **Summary + image + caption + preview link** (not full text in chat) |
| Bot runtime | Local `systemd --user` service, long-poll (matches the watcher) |
| Auth | Locked to Sai's Telegram chat ID; token in Secret Manager (`bloggersaibot-token`) |

## Architecture — reuse the pipeline, add a thin Telegram layer

```
Telegram (@Bloggersaibot)
   │  DM: idea / URLs / PDF
   ▼
saiteja-blog-bot  (NEW local systemd service, long-poll)
   │  creates blogGenRequest  ─────────────►  Firestore  ◄──────── website /admin
   │  notifies ready drafts (Publish/Reject)      (shared queue + posts)
   │  Publish → set published=true                     ▲
   ▼                                                   │ generates drafts
  Telegram approval message  ◄────────────  saiteja-blog-watcher (EXISTING)
                                            (gen → post+art+caption; autopost on publish)
```

Single source of truth = **Firestore** (`auracle-prod-311 / saiteja-site`).
Nothing about the bot duplicates generation or posting — it only creates
requests and flips `published`. The watcher does the work it already does.

## Components

### 1. `scripts/blog_bot.py` + `saiteja-blog-bot.service` (new, local)
A long-poll loop (Telegram `getUpdates`, offset-tracked) that:

- **Auth/lock:** ignores any chat that isn't Sai's `BLOG_BOT_CHAT_ID`. `/start`
  binds the chat on first contact (or it's set explicitly). Token from Secret
  Manager.
- **Intake:** a non-command message → create `blogGenRequest`
  `{topic: text, referenceUrls: [urls in text], references: [pdf text], options, source: "telegram"}`.
  A PDF/doc upload → `getFile` → download → extract text (pypdf) → reference;
  the caption (if any) is the topic. Replies "queued — I'll send the draft when
  it's ready."
- **Commands:** `/start` (bind + help), `/queue` (current queue + drafts),
  `/help`.
- **Approval notifications:** polls Firestore for posts that are drafts
  (`published==false`) and `ready` and **not yet notified** (`tgNotified` unset),
  regardless of who created them (bot or website). Sends: title, summary, the
  first **infographic** image, the **LinkedIn caption** (`linkedinPost`), and a
  **preview link**, with inline buttons `[Publish]` / `[Reject]`. Marks
  `tgNotified=true` + stores the Telegram `message_id`.
- **Callbacks:** `Publish` → set `published=true`, `publishedAt=now` (watcher
  auto-posts LinkedIn); edit the message to "✓ published — posting to LinkedIn".
  `Reject` → delete the draft (or mark rejected); edit message to "✗ rejected".
- **Cross-channel sync:** each poll, for posts already notified (have a
  `message_id`), if state changed elsewhere (published in the website, or
  deleted), edit the Telegram message to reflect it (remove buttons).

### 2. `app/preview/[slug]/page.tsx` (new route — needs redeploy)
A no-login preview of a draft: renders the post (hero/infographics + markdown)
when `?t=<token>` matches `HMAC(slug, ADMIN_SESSION_SECRET)`. Lets the bot link
to a readable full draft without exposing the admin or drafts publicly.
`lib/preview.ts` mints/verifies the token (shared with the bot via a small REST
helper or by recomputing the same HMAC server-side; the bot computes the same
HMAC with the secret it reads from Secret Manager).

### 3. Firestore additions (no new collections)
On `blogPosts`: `source` ("telegram"/"web"), `tgNotified` (bool),
`tgMessageId` (int), `tgChatId` (int). On `blogGenRequests`: `source`.

### 4. Factory project registration
Register in `~/factory/memory/projects.json` via `update_projects.sh`:
slug `saiteja-blog`, repo `sai19872000/AIResearchPortfolio`, local `~/AIResearchPortfolio`,
deploy_url `https://saiteja.ai`. Add project memory describing the system
(site + admin + watcher + LinkedIn + bot) so factory agents can maintain it.

## Reused as-is (no change)
- Generation + art + caption: `scripts/blog_watcher.py` + `blog-art` skill.
- LinkedIn auto-post on publish: the watcher's `autopost_new_published`.
- The website `/admin`: already shows the queue + drafts + Publish.

## Security / constraints
- Bot **locked to one chat ID** — else anyone could spend credits + post to
  LinkedIn. Hard requirement.
- Token + secrets in **Secret Manager** only (Hard Rule #3).
- Publish (blog + LinkedIn) is the one externally-irreversible action — it
  happens only on an explicit `[Publish]` tap (or website Publish). The bot
  never auto-publishes.

## Out of scope (YAGNI)
- Editing post content inside Telegram (use the website editor).
- Multi-user / multiple chats.
- Webhook hosting (local long-poll is enough).
