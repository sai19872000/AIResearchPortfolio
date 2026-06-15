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
  set-app <id> <secret>    store the LinkedIn app client id + secret in Secret
                           Manager (one-time, step 1 of setup)
  auth-url                 print the OAuth consent URL (step 2)
  exchange <code>          swap the redirect ?code= for tokens; stores the
                           refresh token in Secret Manager (step 3)
  whoami                   print your member URN (verifies the token works)
  draft <slug>             show the LinkedIn copy that would be posted
  publish <slug> [--publish]
                           dry-run by default (shows draft + sends Telegram
                           preview); with --publish, actually posts.

Credentials live in Secret Manager (auracle-prod-311), read with your gcloud
(owner) ADC: `linkedin-client-id`, `linkedin-client-secret`,
`linkedin-refresh-token`. The matching env vars still work as a local override.
Other env (see docs/LINKEDIN_SETUP.md):
  LINKEDIN_REDIRECT_URI    your app's redirect (not secret)
  SITE_BASE_URL            default https://saiteja.ai
  TG_CHAT_ID, TELEGRAM_BOT_TOKEN  (optional, for the approval preview)
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys, urllib.parse, urllib.request
from pathlib import Path

# Use gcloud (owner) ADC, not a stray service-account key from another project.
os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

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
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            ct = r.headers.get("Content-Type", "")
            return json.loads(raw) if "json" in ct else raw
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")[:600]
        raise RuntimeError(f"{method} {url} -> HTTP {e.code}: {detail}") from None


def _env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"missing env var: {name} (see docs/LINKEDIN_SETUP.md)")
    return v


def _maybe_secret(secret_name: str, env_name: str) -> str | None:
    """Resolve a credential or return None: env override → Secret Manager."""
    v = os.environ.get(env_name)
    if v:
        return v
    try:
        r = subprocess.run(
            ["gcloud", "secrets", "versions", "access", "latest",
             f"--secret={secret_name}", f"--project={FIRESTORE_PROJECT}"],
            capture_output=True, text=True, timeout=25)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    except Exception:
        pass
    return None


def _secret(secret_name: str, env_name: str) -> str:
    """Like _maybe_secret but exits with a helpful error when absent."""
    v = _maybe_secret(secret_name, env_name)
    if v is None:
        sys.exit(f"missing {env_name} / Secret Manager secret '{secret_name}'. "
                 f"Run `set-app` then `exchange` (see docs/LINKEDIN_SETUP.md).")
    return v


def _store_secret(secret_name: str, value: str) -> bool:
    """Add a new version to a Secret Manager secret (creating it if needed)."""
    subprocess.run(["gcloud", "secrets", "create", secret_name,
                    f"--project={FIRESTORE_PROJECT}", "--replication-policy=automatic"],
                   capture_output=True, text=True)
    r = subprocess.run(["gcloud", "secrets", "versions", "add", secret_name,
                        f"--project={FIRESTORE_PROJECT}", "--data-file=-"],
                       input=value, text=True, capture_output=True)
    return r.returncode == 0


def cmd_set_app(a):
    """Store the LinkedIn app's client id + secret in Secret Manager (one-time)."""
    ok1 = _store_secret("linkedin-client-id", a.client_id)
    ok2 = _store_secret("linkedin-client-secret", a.client_secret)
    print("stored client id + secret in Secret Manager" if (ok1 and ok2) else "FAILED to store one or both")


# ---- OAuth (one-time) -----------------------------------------------------
def cmd_auth_url(_):
    params = {
        "response_type": "code",
        "client_id": _secret("linkedin-client-id", "LINKEDIN_CLIENT_ID"),
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
        "client_id": _secret("linkedin-client-id", "LINKEDIN_CLIENT_ID"),
        "client_secret": _secret("linkedin-client-secret", "LINKEDIN_CLIENT_SECRET"),
    })
    at = tok.get("access_token")
    if at:
        _store_secret("linkedin-access-token", at)
        days = int(tok.get("expires_in", 0)) // 86400
        print(f"access token stored in Secret Manager (valid ~{days} days)")
    rt = tok.get("refresh_token")
    if rt:
        _store_secret("linkedin-refresh-token", rt)
        print("refresh token stored — access token will auto-refresh")
    else:
        print("note: LinkedIn issued no refresh token for this app — re-run "
              "`auth-url` + `exchange` to renew when the access token expires (~60 days).")


def _access_token() -> str:
    # Prefer the refresh-token grant if LinkedIn ever issues one for this app.
    rt = _maybe_secret("linkedin-refresh-token", "LINKEDIN_REFRESH_TOKEN")
    if rt:
        tok = _http("POST", OAUTH + "/accessToken", form=True, data={
            "grant_type": "refresh_token", "refresh_token": rt,
            "client_id": _secret("linkedin-client-id", "LINKEDIN_CLIENT_ID"),
            "client_secret": _secret("linkedin-client-secret", "LINKEDIN_CLIENT_SECRET"),
        })
        return tok["access_token"]
    # Otherwise use the stored ~60-day access token directly.
    at = _maybe_secret("linkedin-access-token", "LINKEDIN_ACCESS_TOKEN")
    if at:
        return at
    sys.exit("no LinkedIn token — run `auth-url` + `exchange` to authorize "
             "(LinkedIn access tokens last ~60 days; re-run when one expires).")


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
    """LinkedIn copy in the post's voice. Uses a curated `linkedinPost` if set,
    else builds from the post. Always ensures the article link is present."""
    url = f"{SITE}/blog/{post['slug']}"
    if post.get("linkedinPost"):
        text = post["linkedinPost"].strip()
        if "/blog/" not in text:  # writer's caption often omits the link
            text = f"{text}\n\n{url}"
        return text
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
    mech = val["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]
    # LinkedIn's binary upload is a PUT (POST returns 400); pass back its headers.
    _http("PUT", mech["uploadUrl"],
          headers={"Authorization": f"Bearer {access}",
                   "Content-Type": "application/octet-stream",
                   **(mech.get("headers") or {})},
          data=image.read_bytes())
    return asset


def _resolve_image(hero: str | None) -> Path | None:
    """heroImage may be a GCS URL (download it) or a local /public path."""
    if not hero:
        return None
    if hero.startswith("http"):
        try:
            import tempfile
            with urllib.request.urlopen(hero, timeout=30) as r:
                data = r.read()
            tmp = Path(tempfile.gettempdir()) / f"li-hero-{Path(hero).name}"
            tmp.write_bytes(data)
            return tmp
        except Exception:
            return None
    p = Path(__file__).resolve().parent.parent / "public" / hero.lstrip("/")
    return p if p.exists() else None


def _linkedin_image_url(post: dict) -> str | None:
    """Prefer the post's first inline infographic (explains the idea) over the
    abstract hero — better for the LinkedIn feed. Falls back to the hero."""
    import re
    m = re.search(r"!\[[^\]]*\]\((https?://[^)\s]+)\)", post.get("content") or "")
    return m.group(1) if m else post.get("heroImage")


def cmd_publish(a):
    post = _load_post(a.slug)
    text = build_draft(post)
    image = _resolve_image(_linkedin_image_url(post))
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
        try:
            asset = _upload_image(access, owner, image)
            media = [{"status": "READY", "media": asset,
                      "title": {"text": post["title"][:200]}}]
        except Exception as e:
            # Non-fatal: post text + link; LinkedIn renders a preview card from
            # the article's OG image instead of an attached image.
            print(f"  image upload failed ({str(e)[:100]}); posting with link preview instead")
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
    sa = sub.add_parser("set-app", help="store LinkedIn client id + secret in Secret Manager")
    sa.add_argument("client_id"); sa.add_argument("client_secret"); sa.set_defaults(fn=cmd_set_app)
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
