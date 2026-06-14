# LinkedIn auto-post — one-time setup

The blog → LinkedIn pipeline posts a published post to **Sai's personal
LinkedIn feed** using LinkedIn's free, self-serve **Share on LinkedIn**
product. No partner review, no cost, fully ToS-compliant. (Apify / browser
automation are intentionally not used — scraping-only, account-ban risk.)

You only do steps 1–4 once. After that, posting is one command with an
explicit human approval gate.

## 1. Create the LinkedIn app  *(you, ~5 min)*

1. Go to <https://www.linkedin.com/developers/apps> → **Create app**.
2. Associate it with any LinkedIn Page you control (required by LinkedIn even
   for personal-feed posting; the posts still go to *your* feed, not the page).
3. On the app's **Products** tab, add:
   - **Sign In with LinkedIn using OpenID Connect** (instant)
   - **Share on LinkedIn** (instant, self-serve — grants `w_member_social`)
4. On **Auth**, add an authorized redirect URL. For a one-time local mint use:
   `https://saiteja.ai/li/callback` (it only needs to match; you copy the code
   from the address bar — no server required).

## 2. Put the app secrets in the environment  *(never in a file)*

```bash
export LINKEDIN_CLIENT_ID=...          # from the app's Auth tab
export LINKEDIN_CLIENT_SECRET=...
export LINKEDIN_REDIRECT_URI=https://saiteja.ai/li/callback
```

## 3. Authorize once and mint a refresh token

```bash
python3 scripts/linkedin_pipeline.py auth-url       # prints a URL — open it, approve
# the browser lands on .../li/callback?code=XXXX  (page may 404 — that's fine)
python3 scripts/linkedin_pipeline.py exchange XXXX  # prints LINKEDIN_REFRESH_TOKEN=...
export LINKEDIN_REFRESH_TOKEN=...                   # ~365-day token; access token auto-refreshes
python3 scripts/linkedin_pipeline.py whoami         # should print urn:li:person:xxxx
```

## 4. (optional) Telegram preview for approval

```bash
export TG_CHAT_ID=...            # your chat id (already in ~/.auracle/secrets.env)
export TELEGRAM_BOT_TOKEN=...
```

## Posting a post

```bash
# DRY RUN — shows the draft and pushes a Telegram preview. Nothing is posted.
python3 scripts/linkedin_pipeline.py publish <slug>

# After you've reviewed the draft, post it:
python3 scripts/linkedin_pipeline.py publish <slug> --publish
```

- The draft is built in BRAND voice (title + summary + link + up to 4 hashtags
  from the post's tags). To hand-write the copy instead, set the post's
  `linkedinPost` field in Firestore and the pipeline uses it verbatim.
- The post's `heroImage` (nano-banana art) is attached as the share image.
- After a successful post, `linkedinPost` + `linkedinPostId` are written back to
  the Firestore doc so it is never double-posted.

## Automating it (later)

Once verified manually, wire a small watcher: on a newly-published post (or a
nightly cron), run `publish <slug>` (dry run) → Telegram preview → you reply /
re-run with `--publish`. This mirrors the factory's existing Telegram approval
UX. Posting stays behind the human gate — required because social posts are
externally irreversible (CLAUDE.md Hard Rule #4).

## What LinkedIn's API allows (constraints)

- Personal feed text + link + **single image** + video: supported.
- PDF carousels, polls, native articles: **not** available to third-party apps.
- Rate limit: 150 posts/member/day (you will never hit it).
- Tokens: access ~60 days, refresh ~365 days (auto-refreshed by the pipeline).
