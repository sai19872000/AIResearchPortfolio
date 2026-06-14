#!/usr/bin/env python3
"""saiteja.ai → LinkedIn publishing pipeline (personal feed, official API).

Posts a published blog post to Sai's PERSONAL LinkedIn feed using LinkedIn's
free, self-serve "Share on LinkedIn" product (scope w_member_social) — no
partner approval, no cost, ToS-compliant. Apify and browser automation are
deliberately NOT used (scraping-only / account-ban risk).

Hard rules honoured:
  * Nothing posts without an explicit human gate. `publish` is a DRY RUN that
    shows the draft (and can push a preview to Telegram) unless you pass
    --publish. (CLAUDE.md Hard Rule #4: social posts are externally irreversible.)
  * Tokens come from env vars only, never files (Hard Rule #3).

Subcommands:
  auth-url                 print the OAuth consent URL (step 1 of one-time setup)
  exchange <code>          exchange the redirect ?code= for tokens (step 2)
  whoami                   print your member URN (verifies the token works)
  draft <slug>             show the LinkedIn copy that would be posted
  publish <slug> [--publish]
                           dry-run by default (shows draft + sends Telegram
                           preview); with --publish, actually posts.

Env (see docs/LINKEDIN_SETUP.md):
  LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI,
  LINKEDIN_REFRESH_TOKEN   (minted by `exchange`)
  SITE_BASE_URL            default https://saiteja.ai
  TG_CHAT_ID, TELEGRAM_BOT_TOKEN  (optional, for the approval preview)
"""
from __future__ import annotations
import argparse, json, os, sys, urllib.parse, urllib.request
from pathlib import Path

API = "https://api.linkedin.com"
OAUTH = "https://www.linkedin.com/oauth/v2"
SCOPES = "openid profile w_member_social"
SITE = os.environ.get("SITE_BASE_URL", "https://saiteja.ai")
FIRESTORE_PROJECT = os.environ.get("FIRESTORE_PROJECT_ID", "auracle-prod-311")
FIRESTORE_DB = os.environ.get("FIRESTORE_DATABASE_ID", "saiteja-site")


def _http(method: str, url: str, *, headers=None, data=None, form=False):
    h = dict(headers or {})
    body = None
    if data is not None:
        if form:
            body = urllib.parse.urlencode(data).encode()
            h.setdefault("Content-Type", "application/x-www-form-urlencoded")
        elif isinstance(data, (bytes, bytearray)):
            body = data
        else:
            body = json.dumps(data).encode()
            h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        ct = r.headers.get("Content-Type", "")
        return json.loads(raw) if "json" in ct else raw


def _env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"missing env var: {name} (see docs/LINKEDIN_SETUP.md)")
    return v


# ---- OAuth (one-time) -----------------------------------------------------
def cmd_auth_url(_):
    params = {
        "response_type": "code",
        "client_id": _env("LINKEDIN_CLIENT_ID"),
        "redirect_uri": _env("LINKEDIN_REDIRECT_URI"),
        "scope": SCOPES,
    }
    print(OAUTH + "/authorization?" + urllib.parse.urlencode(params))
    print("\nopen this, authorize, then copy the ?code=... from the redirect "
          "and run:  python3 scripts/linkedin_pipeline.py exchange <code>")


def cmd_exchange(a):
    tok = _http("POST", OAUTH + "/accessToken", form=True, data={
        "grant_type": "authorization_code",
        "code": a.code,
        "redirect_uri": _env("LINKEDIN_REDIRECT_URI"),
        "client_id": _env("LINKEDIN_CLIENT_ID"),
        "client_secret": _env("LINKEDIN_CLIENT_SECRET"),
    })
    print("access_token (≈60d):", tok.get("access_token", "")[:18], "…")
    rt = tok.get("refresh_token")
    print("\nstore this (env, never a file):\n  LINKEDIN_REFRESH_TOKEN=" + (rt or "<none returned — enable refresh tokens on the app>"))


def _access_token() -> str:
    tok = _http("POST", OAUTH + "/accessToken", form=True, data={
        "grant_type": "refresh_token",
        "refresh_token": _env("LINKEDIN_REFRESH_TOKEN"),
        "client_id": _env("LINKEDIN_CLIENT_ID"),
        "client_secret": _env("LINKEDIN_CLIENT_SECRET"),
    })
    return tok["access_token"]


def _member_urn(access: str) -> str:
    info = _http("GET", API + "/v2/userinfo", headers={"Authorization": f"Bearer {access}"})
    return f"urn:li:person:{info['sub']}"


def cmd_whoami(_):
    access = _access_token()
    print(_member_urn(access))


# ---- Draft ----------------------------------------------------------------
def _load_post(slug: str) -> dict:
    from google.cloud import firestore
    db = firestore.Client(project=FIRESTORE_PROJECT, database=FIRESTORE_DB)
    snap = db.collection("blogPosts").document(slug).get()
    if not snap.exists:
        sys.exit(f"no post: {slug}")
    return snap.to_dict()


def build_draft(post: dict) -> str:
    """LinkedIn copy in BRAND voice (lowercase, no exclamation, no hype).
    If the post already has a curated `linkedinPost`, use it verbatim."""
    if post.get("linkedinPost"):
        return post["linkedinPost"]
    url = f"{SITE}/blog/{post['slug']}"
    summary = (post.get("summary") or "").strip()
    tags = post.get("tags") or []
    hashtags = " ".join("#" + t.replace("-", "") for t in tags[:4])
    title = post["title"]
    return (
        f"{title}\n\n"
        f"{summary}\n\n"
        f"new on the blog → {url}\n\n"
        f"{hashtags}"
    ).strip()


def cmd_draft(a):
    print(build_draft(_load_post(a.slug)))


# ---- Publish (gated) ------------------------------------------------------
def _tg_preview(text: str, image: Path | None):
    chat = os.environ.get("TG_CHAT_ID")
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not (chat and token):
        print("(no TG_CHAT_ID/TELEGRAM_BOT_TOKEN — skipping Telegram preview)")
        return
    cap = "linkedin draft — review, then re-run with --publish:\n\n" + text
    if image and image.exists():
        # multipart sendPhoto
        boundary = "----saitejaLI"
        parts = []
        for k, v in {"chat_id": chat, "caption": cap[:1024]}.items():
            parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n")
        head = "".join(parts).encode()
        img = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"photo\"; "
               f"filename=\"og.png\"\r\nContent-Type: image/png\r\n\r\n").encode() + image.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
        _http("POST", f"https://api.telegram.org/bot{token}/sendPhoto",
              headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}, data=head + img)
    else:
        _http("POST", f"https://api.telegram.org/bot{token}/sendMessage",
              data={"chat_id": chat, "text": cap})
    print("→ preview sent to Telegram")


def _upload_image(access: str, owner: str, image: Path) -> str:
    reg = _http("POST", API + "/v2/assets?action=registerUpload",
                headers={"Authorization": f"Bearer {access}"},
                data={"registerUploadRequest": {
                    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                    "owner": owner,
                    "serviceRelationships": [{"relationshipType": "OWNER",
                                              "identifier": "urn:li:userGeneratedContent"}]}})
    val = reg["value"]
    asset = val["asset"]
    upload_url = val["uploadMechanism"][
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
    _http("POST", upload_url, headers={"Authorization": f"Bearer {access}"},
          data=image.read_bytes())
    return asset


def cmd_publish(a):
    post = _load_post(a.slug)
    text = build_draft(post)
    image = None
    if post.get("heroImage"):
        p = Path(__file__).resolve().parent.parent / "public" / post["heroImage"].lstrip("/")
        if p.exists():
            image = p
    print("─" * 60)
    print(text)
    print("─" * 60)
    print(f"image: {image or '(none)'}")

    if not a.publish:
        print("\nDRY RUN — nothing posted. Sends a Telegram preview for approval.")
        _tg_preview(text, image)
        print("\nto actually post: add --publish")
        return

    # --- live publish (explicit human gate passed) ---
    access = _access_token()
    owner = _member_urn(access)
    media = []
    if image:
        asset = _upload_image(access, owner, image)
        media = [{"status": "READY", "media": asset,
                  "title": {"text": post["title"][:200]}}]
    body = {
        "author": owner,
        "lifecycleState": "PUBLISHED",
        "specificContent": {"com.linkedin.ugc.ShareContent": {
            "shareCommentary": {"text": text},
            "shareMediaCategory": "IMAGE" if media else "NONE",
            **({"media": media} if media else {}),
        }},
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    res = _http("POST", API + "/v2/ugcPosts",
                headers={"Authorization": f"Bearer {access}",
                         "X-Restli-Protocol-Version": "2.0.0"}, data=body)
    post_id = res.get("id") if isinstance(res, dict) else None
    print("posted:", post_id)
    # record on the post so we don't double-post
    from google.cloud import firestore
    db = firestore.Client(project=FIRESTORE_PROJECT, database=FIRESTORE_DB)
    db.collection("blogPosts").document(a.slug).update({"linkedinPost": text,
                                                        "linkedinPostId": post_id})


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("auth-url").set_defaults(fn=cmd_auth_url)
    ex = sub.add_parser("exchange"); ex.add_argument("code"); ex.set_defaults(fn=cmd_exchange)
    sub.add_parser("whoami").set_defaults(fn=cmd_whoami)
    dr = sub.add_parser("draft"); dr.add_argument("slug"); dr.set_defaults(fn=cmd_draft)
    pub = sub.add_parser("publish"); pub.add_argument("slug")
    pub.add_argument("--publish", action="store_true", help="actually post (default: dry run)")
    pub.set_defaults(fn=cmd_publish)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
