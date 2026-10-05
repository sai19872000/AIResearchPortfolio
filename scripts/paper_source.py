"""Full-text sources for research posts (issue #28).

The writer used to receive only `fetch_url_text(sourceUrl)`, which for arXiv is the /abs page (the abstract). This module
resolves the URLs worth fetching for a paper, best first, so the brief carries the paper itself.

NOT WIRED IN YET (draft PR): blog_watcher still calls fetch_url_text(sourceUrl). Remaining work is listed in the PR.
"""
from __future__ import annotations

import re

ARXIV_RX = re.compile(r"^https?://(?:www\.)?arxiv\.org/(?:abs|pdf|html)/(?P<id>\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?/?$", re.I)


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
    """True when the best text we could get is an arXiv abstract page (the case behind issue #28)."""
    return bool(arxiv_id(url_used)) and "/abs/" in url_used
