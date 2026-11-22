"""test_render_figure.py — unit tests for editorial-report figure validation,
sanitization, HTML generation, LinkedIn chart selection, and bot draft image priority.
All pure / offline. Run: python3 scripts/run_tests.py
"""
import subprocess
import sys
import types
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import linkedin_pipeline as li  # noqa: E402
import render_figure as rf  # noqa: E402


def _load_blog_bot():
    if "blog_bot" in sys.modules:
        return sys.modules["blog_bot"]
    fake_run = lambda *a, **k: types.SimpleNamespace(returncode=0, stdout="12345", stderr="")
    with mock.patch.object(subprocess, "run", fake_run):
        import blog_bot
    return blog_bot


def test_validate_figure_markup_allows_inert_svg_and_refuses_unsafe():
    good = '<svg class="ed-chart" viewBox="0 0 640 200"><rect class="subj" x="0" y="10" width="200" height="20"/></svg>'
    ok, cleaned = rf.validate_figure_markup(good)
    assert ok and "<svg" in cleaned

    for bad in [
        "<svg><script>alert(1)</script></svg>",
        '<svg><rect onclick="x()" width="10" height="10"/></svg>',
        "<svg><foreignObject><p>x</p></foreignObject></svg>",
        '<svg><use href="https://evil.example/a.svg#x"/></svg>',
        '<img src="https://evil.example/x.png"/>',
        '<svg><rect style="fill:url(https://evil.example/a)" width="10" height="10"/></svg>',
    ]:
        ok, _reason = rf.validate_figure_markup(bad)
        assert not ok, f"should reject {bad}"


def test_sanitize_post_figures_keeps_valid_and_strips_unsafe():
    md = (
        "Intro\n\n"
        "```figure\n"
        "title: Valid chart\n"
        "dek: Each bar is one step.\n"
        "source: Synthetic.\n"
        "alt: Bar chart showing 95% dropping to 60%.\n"
        "width: wide\n\n"
        '<svg class="ed-chart" viewBox="0 0 640 120"><rect class="subj" x="0" y="0" width="100" height="20"/></svg>\n'
        "```\n\n"
        "```figure\n"
        "title: Bad chart\n"
        "alt: Should be stripped.\n\n"
        "<svg><script>alert(1)</script></svg>\n"
        "```\n"
    )
    cleaned, warnings = rf.sanitize_post_figures(md)
    assert len(warnings) == 1 and "Bad chart" in warnings[0], warnings
    assert '<svg class="ed-chart"' in cleaned
    assert "<script>" not in cleaned
    assert "> **Figure:** Should be stripped." in cleaned
    figs = rf.extract_figures(cleaned)
    assert len(figs) == 1 and figs[0]["ok"] and figs[0]["wide"]


def test_build_figure_html_contains_auracle_tokens_and_title():
    fig = rf.parse_figure_block(
        "title: Ten steps turn 95% into 60%\n"
        "dek: Exponential compounding.\n"
        "source: Formula 0.95^n.\n"
        "alt: Curve from 95% to 60%.\n\n"
        '<svg class="ed-chart" viewBox="0 0 640 200"><path class="subj-line" d="M0,10 L600,150"/></svg>'
    )
    doc = rf.build_figure_html(fig)
    assert "Ten steps turn 95% into 60%" in doc
    assert "--ed-accent: #F2A85B" in doc
    assert '<svg class="ed-chart"' in doc


def test_linkedin_and_bot_prefer_lead_figure_image():
    post = {
        "heroImage": "https://storage.googleapis.com/saiteja-blog-art/art/blog/p-hero.png",
        "leadFigureImage": "https://storage.googleapis.com/saiteja-blog-art/art/blog/p-figure-1.png",
        "content": "![concept](https://storage.googleapis.com/saiteja-blog-art/art/blog/p-1-infographic.png)",
    }
    imgs = li._linkedin_image_urls(post)
    assert imgs == [
        ("featured image", post["heroImage"]),
        ("chart figure", post["leadFigureImage"]),
    ], imgs

    bb = _load_blog_bot()
    # No sourceScreenshot: Telegram draft card leads with leadFigureImage over heroImage
    assert bb._draft_image(post) == post["leadFigureImage"]
    # With sourceScreenshot: sourceScreenshot stays #1
    assert bb._draft_image({**post, "sourceScreenshot": "https://x/src.png"}) == "https://x/src.png"
