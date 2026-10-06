"""Full-text sources for research posts (issue #28).

The writer used to get `fetch_url_text(url, limit=12000)` for an arXiv link, which is the /abs page: the abstract and the
listing, never the paper (the 2026-10-04 Where-OPD post said so itself and scored 6.6 with the blind judge). For a paper
we now try the full HTML, then the PDF's text, and use the abstract page only as a last resort, flagged.
"""
from __future__ import annotations

import re
import subprocess
import urllib.request

ARXIV_RX = re.compile(r"^https?://(?:www\.)?arxiv\.org/(?:abs|pdf|html)/(?P<id>\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?/?$", re.I)
PAPER_LIMIT = 60000          # characters of paper text in the brief (was 12000 for everything)
MIN_FULL_TEXT = 8000         # less than this is not a paper (an error page or an abstract)
UA = {"User-Agent": "Mozilla/5.0 saiteja-blog-watcher"}


def arxiv_id(url: str) -> str | None:
    m = ARXIV_RX.match((url or "").strip())
    return m.group("id") if m else None


def full_text_candidates(url: str) -> list[str]:
    """URLs to try for the paper's FULL text, best first; the abstract page is the last resort."""
    pid = arxiv_id(url)
    if not pid:
        return [url]
    return [f"https://arxiv.org/html/{pid}", f"https://arxiv.org/pdf/{pid}", f"https://arxiv.org/abs/{pid}"]


def is_abstract_only(url_used: str) -> bool:
    return bool(arxiv_id(url_used)) and "/abs/" in url_used


def fetch_bytes(url: str, limit: int = 40_000_000) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read(limit)


def pdf_text(data: bytes) -> str:
    """PDF bytes -> text with poppler's pdftotext (installed); empty string on any failure."""
    try:
        p = subprocess.run(["pdftotext", "-layout", "-", "-"], input=data, capture_output=True, timeout=120)
        return re.sub(r"[ \t]+", " ", p.stdout.decode("utf-8", "ignore")).strip() if p.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        return ""


def _looks_like_paper(text: str) -> bool:
    if len(text) < MIN_FULL_TEXT or text.startswith("[could not fetch"):
        return False
    return not re.search(r"No HTML for|HTML is not available for the source", text[:3000], re.I)


def fetch_paper(url: str, fetch_text, fetch_raw=fetch_bytes, to_text=pdf_text) -> tuple[str, str, bool]:
    """(text, url_used, abstract_only) for a paper link; non-paper links pass straight through fetch_text."""
    if not arxiv_id(url):
        return fetch_text(url), url, False
    html, pdf, abs_page = full_text_candidates(url)
    t = fetch_text(html, limit=PAPER_LIMIT)
    if _looks_like_paper(t):
        return t, html, False
    try:
        t = to_text(fetch_raw(pdf))[:PAPER_LIMIT]
    except Exception:  # noqa: BLE001 - fall through to the abstract
        t = ""
    if _looks_like_paper(t):
        return t, pdf, False
    return fetch_text(abs_page), abs_page, True
