#!/usr/bin/env python3
"""render_figure.py — editorial-report ```figure validator + headless-Chrome PNG rasterizer.

Validates inline SVG ```figure blocks with the same fail-closed allowlist as
lib/editorial.ts (never allows <script>, event handlers, external URLs, or
missing alt text), and renders the post's lead ```figure block to a crisp PNG
uploaded to gs://saiteja-blog-art so LinkedIn and Telegram show the exact same
Pudding-style data chart as saiteja.ai.

Usage:
  python3 scripts/render_figure.py <slug> <post.json-or-markdown-path>
"""
from __future__ import annotations

import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_art import PUBLIC, upload_to_gcs  # noqa: E402

CHROME = "/usr/bin/google-chrome"
TIMEOUT_S = 60
MIN_BYTES = 5_000

_FIGURE_KEYS = {"title", "dek", "source", "alt", "width"}

_ALLOWED_TAGS = {
    "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "text", "tspan", "defs", "pattern", "clippath", "lineargradient", "radialgradient",
    "stop", "title", "desc", "marker", "use",
    "div", "p", "span", "strong", "em", "br", "img",
}

_FORBIDDEN_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"<\s*(script|iframe|object|embed|foreignobject|style|link|meta|base|form|input|textarea|button|select|a)\b", re.I), "forbidden element"),
    (re.compile(r"\bon[a-z]+\s*=", re.I), "event handler attribute"),
    (re.compile(r"\b(?:javascript|vbscript)\s*:", re.I), "script URI"),
    (re.compile(r"data\s*:\s*text/html", re.I), "html data URI"),
    (re.compile(r"@import\b", re.I), "css @import"),
    (re.compile(r"\b(?:src|href|xlink:href)\s*=\s*[\"']?\s*(?:https?:)?//", re.I), "external network reference"),
    (re.compile(r"url\(\s*[\"']?\s*(?:https?:)?//", re.I), "external css url()"),
]

_TAG_RE = re.compile(r"<\s*(/?)\s*([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>")
_COMMENT_RE = re.compile(r"<!--[\s\S]*?-->")
_FENCE_OPEN_RE = re.compile(r"^([ \t]{0,3})(`{3,}|~{3,})([^\n]*)$")


def validate_figure_markup(raw: str) -> tuple[bool, str]:
    """Fail-closed validation matching lib/editorial.ts sanitizeFigureMarkup.
    Returns (True, cleaned_markup) or (False, reason)."""
    trimmed = (raw or "").strip()
    if not trimmed:
        return False, "empty figure body"
    cleaned = _COMMENT_RE.sub("", trimmed)
    for rx, label in _FORBIDDEN_PATTERNS:
        m = rx.search(cleaned)
        if m:
            return False, f"{label}: {m.group(0)}"
    saw_tag = False
    for m in _TAG_RE.finditer(cleaned):
        saw_tag = True
        is_close = m.group(1) == "/"
        tag = m.group(2).lower()
        attrs = m.group(3) or ""
        if tag not in _ALLOWED_TAGS:
            return False, f"disallowed tag <{tag}>"
        if is_close:
            continue
        if tag == "img":
            sm = re.search(r'\bsrc\s*=\s*(?:"([^"]*)"|\'([^\']*)\')', attrs, re.I)
            src = ((sm.group(1) if sm and sm.group(1) is not None else (sm.group(2) if sm else "")) or "").strip()
            if not re.match(r"^data:image/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$", src, re.I):
                return False, "<img> inside figure must use a base64 data:image/ URI"
        if tag == "use":
            hm = re.search(r'\b(?:xlink:)?href\s*=\s*(?:"([^"]*)"|\'([^\']*)\')', attrs, re.I)
            href = ((hm.group(1) if hm and hm.group(1) is not None else (hm.group(2) if hm else "")) or "").strip()
            if href and not href.startswith("#"):
                return False, "<use> href must be a local #id reference"
        stm = re.search(r'\bstyle\s*=\s*(?:"([^"]*)"|\'([^\']*)\')', attrs, re.I)
        style_val = (stm.group(1) if stm and stm.group(1) is not None else (stm.group(2) if stm else "")) or ""
        if style_val:
            for um in re.finditer(r'url\(\s*["\']?([^"\')]+)["\']?\s*\)', style_val, re.I):
                if not um.group(1).strip().startswith("#"):
                    return False, f"external url() in style: {um.group(1)}"
    if not saw_tag:
        return False, "figure body contains no SVG or layout markup"
    if re.search(r"<\s*script\b", cleaned, re.I):
        return False, "forbidden script token"
    return True, cleaned


def parse_figure_block(body: str) -> dict:
    lines = body.splitlines()
    meta: dict[str, str] = {}
    k = 0
    while k < len(lines):
        ln = lines[k].strip()
        if not ln:
            k += 1
            break
        if ln.startswith("<"):
            break
        m = re.match(r"^([a-z]+)\s*:\s*(.*)$", ln)
        if not m or m.group(1) not in _FIGURE_KEYS:
            break
        meta[m.group(1)] = m.group(2).strip()
        k += 1
    graphic = "\n".join(lines[k:]).strip()
    alt = meta.get("alt", "")
    if not graphic:
        ok, res = False, "empty figure body"
    elif not alt:
        ok, res = False, "figure missing required alt: line"
    else:
        ok, res = validate_figure_markup(graphic)
    return {
        "title": meta.get("title", ""),
        "dek": meta.get("dek", ""),
        "source": meta.get("source", ""),
        "alt": alt,
        "wide": meta.get("width", "").lower() == "wide",
        "ok": ok,
        "markup": res if ok else None,
        "error": None if ok else res,
    }


def extract_figures(markdown: str) -> list[dict]:
    """Return all ```figure blocks in markdown (ignoring ```figure inside outer code fences)."""
    lines = (markdown or "").splitlines()
    out: list[dict] = []
    i = 0
    while i < len(lines):
        m = _FENCE_OPEN_RE.match(lines[i])
        if not m:
            i += 1
            continue
        fence = m.group(2)
        fchar, flen = fence[0], len(fence)
        info = m.group(3).strip().lower()
        close_re = re.compile(rf"^[ \t]{{0,3}}{re.escape(fchar)}{{{flen},}}[ \t]*$")
        j = i + 1
        while j < len(lines) and not close_re.match(lines[j]):
            j += 1
        if j < len(lines) and info == "figure":
            out.append(parse_figure_block("\n".join(lines[i + 1:j])))
            i = j + 1
        else:
            i = (j + 1) if j < len(lines) else len(lines)
    return out


def sanitize_post_figures(markdown: str) -> tuple[str, list[str]]:
    """Verify every ```figure block in a generated post. Any invalid/unsafe block
    is replaced with a plain blockquote fallback so disallowed markup never
    reaches Firestore. Returns (cleaned_markdown, warnings)."""
    lines = (markdown or "").splitlines()
    out_lines: list[str] = []
    warnings: list[str] = []
    i = 0
    while i < len(lines):
        m = _FENCE_OPEN_RE.match(lines[i])
        if not m:
            out_lines.append(lines[i])
            i += 1
            continue
        fence = m.group(2)
        fchar, flen = fence[0], len(fence)
        info = m.group(3).strip().lower()
        close_re = re.compile(rf"^[ \t]{{0,3}}{re.escape(fchar)}{{{flen},}}[ \t]*$")
        j = i + 1
        while j < len(lines) and not close_re.match(lines[j]):
            j += 1
        if j < len(lines) and info == "figure":
            fig = parse_figure_block("\n".join(lines[i + 1:j]))
            if fig["ok"]:
                out_lines.extend(lines[i:j + 1])
            else:
                warnings.append(f"stripped unsafe/invalid figure {fig['title']!r}: {fig['error']}")
                note = fig["alt"] or fig["title"]
                if note:
                    out_lines.append(f"> **Figure:** {note}")
            i = j + 1
        else:
            end = (j + 1) if j < len(lines) else len(lines)
            out_lines.extend(lines[i:end])
            i = end
    return "\n".join(out_lines), warnings


def build_figure_html(fig: dict) -> str:
    """Self-contained Auracle-dark HTML card for rasterizing a validated ```figure."""
    if not fig.get("ok") or not fig.get("markup"):
        raise ValueError(f"cannot render invalid figure: {fig.get('error')}")
    title = html.escape(fig.get("title") or "")
    dek = html.escape(fig.get("dek") or "")
    source = html.escape(fig.get("source") or "")
    alt = html.escape(fig.get("alt") or "", quote=True)
    title_html = f'<p class="ed-fig-title">{title}</p>' if title else ""
    dek_html = f'<p class="ed-fig-dek">{dek}</p>' if dek else ""
    src_html = f'<figcaption class="ed-fig-source">{source}</figcaption>' if source else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * {{ box-sizing: border-box; }}
  html, body {{
    margin: 0; padding: 0;
    background: #0B0F14;
    color: #EAEDEF;
    font-family: "Hanken Grotesk", "Inter", system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }}
  .canvas {{
    width: 1200px;
    padding: 44px 52px;
    background:
      radial-gradient(900px 420px at 0% 0%, rgba(242,168,91,.09), transparent 60%),
      radial-gradient(900px 420px at 100% 100%, rgba(70,200,221,.09), transparent 60%),
      #0B0F14;
  }}
  .ed {{
    --ed-paper: #0B0F14;
    --ed-surface: #11161C;
    --ed-ink: #EAEDEF;
    --ed-muted: #AEB7C0;
    --ed-faint: #7A8692;
    --ed-rule: rgba(255,255,255,.10);
    --ed-context: #3A4552;
    --ed-accent: #F2A85B;
    --ed-accent-2: #46C8DD;
    --ed-mark: rgba(242,168,91,.24);
    --ed-cat-1: #66CCEE; --ed-cat-2: #EE6677; --ed-cat-3: #74D99A;
    --ed-cat-4: #CCBB44; --ed-cat-5: #4477AA; --ed-cat-6: #AA3377; --ed-cat-7: #BBBBBB;
    --ed-display: "Fraunces", Georgia, serif;
    --ed-sans: "Hanken Grotesk", "Inter", system-ui, sans-serif;
    --ed-mono: "JetBrains Mono", "DejaVu Sans Mono", ui-monospace, monospace;
  }}
  .ed-figure {{
    margin: 0;
    padding: 32px 36px 26px;
    background: var(--ed-surface);
    border: 1px solid rgba(255,255,255,.10);
    border-radius: 14px;
  }}
  .ed-kicker {{
    font-family: var(--ed-mono);
    font-size: 11px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--ed-faint);
    margin: 0 0 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }}
  .ed-kicker::before {{
    content: "";
    width: 22px;
    height: 2px;
    background: linear-gradient(90deg, #F2A85B 0%, #C9B07A 48%, #46C8DD 100%);
  }}
  .ed-fig-title {{
    font-family: var(--ed-display);
    font-weight: 600;
    font-size: 28px;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: var(--ed-ink);
    margin: 0 0 8px;
  }}
  .ed-fig-dek {{
    font-family: var(--ed-sans);
    font-size: 16px;
    line-height: 1.45;
    color: var(--ed-muted);
    margin: 0 0 22px;
  }}
  .ed-fig-body > svg, .ed-fig-body > img {{
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }}
  .ed-fig-source {{
    font-family: var(--ed-mono);
    font-size: 12px;
    line-height: 1.45;
    color: var(--ed-faint);
    margin: 18px 0 0;
    padding-top: 12px;
    border-top: 1px solid var(--ed-rule);
  }}
  svg.ed-chart {{ font-family: var(--ed-mono); font-size: 11px; font-variant-numeric: tabular-nums; }}
  svg.ed-chart text {{ fill: var(--ed-muted); }}
  svg.ed-chart .axis-title {{ text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; fill: var(--ed-faint); }}
  svg.ed-chart .baseline, svg.ed-chart .axis line, svg.ed-chart .axis path {{ stroke: rgba(234,237,239,.45); stroke-width: 1; fill: none; }}
  svg.ed-chart .grid line, svg.ed-chart line.grid {{ stroke: var(--ed-rule); stroke-width: 1; }}
  svg.ed-chart .ctx {{ fill: var(--ed-context); stroke: none; }}
  svg.ed-chart .ctx-line {{ fill: none; stroke: var(--ed-context); stroke-width: 1.35; }}
  svg.ed-chart .subj {{ fill: var(--ed-accent); stroke: none; }}
  svg.ed-chart .subj-line {{ fill: none; stroke: var(--ed-accent); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }}
  svg.ed-chart .subj2 {{ fill: var(--ed-accent-2); stroke: none; }}
  svg.ed-chart .subj2-line {{ fill: none; stroke: var(--ed-accent-2); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }}
  svg.ed-chart .band {{ fill: var(--ed-accent); opacity: 0.16; }}
  svg.ed-chart .dim {{ opacity: 0.25; }}
  svg.ed-chart .cat-1 {{ fill: var(--ed-cat-1); }} svg.ed-chart .cat-2 {{ fill: var(--ed-cat-2); }}
  svg.ed-chart .cat-3 {{ fill: var(--ed-cat-3); }} svg.ed-chart .cat-4 {{ fill: var(--ed-cat-4); }}
  svg.ed-chart .cat-5 {{ fill: var(--ed-cat-5); }} svg.ed-chart .cat-6 {{ fill: var(--ed-cat-6); }}
  svg.ed-chart .ref {{ stroke: rgba(234,237,239,.55); stroke-width: 1; stroke-dasharray: 4 3; fill: none; }}
  svg.ed-chart .leader {{ stroke: rgba(234,237,239,.45); stroke-width: 0.85; fill: none; }}
  svg.ed-chart .lbl {{ fill: var(--ed-ink); font-size: 11.5px; }}
  svg.ed-chart .lbl-subj {{ fill: var(--ed-accent); font-weight: 700; font-size: 12px; }}
  svg.ed-chart .lbl-subj2 {{ fill: var(--ed-accent-2); font-weight: 700; font-size: 12px; }}
  svg.ed-chart .annot {{ fill: var(--ed-ink); font-family: var(--ed-sans); font-size: 12.5px; }}
  svg.ed-chart .annot-strong {{ fill: var(--ed-ink); font-family: var(--ed-sans); font-size: 12.5px; font-weight: 700; }}
  svg.ed-chart .halo {{ paint-order: stroke; stroke: var(--ed-surface); stroke-width: 3.5px; stroke-linejoin: round; }}
  .ed-steps {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; counter-reset: ed-step; }}
  .ed-step {{ counter-increment: ed-step; }}
  .ed-step > .ed-step-cap {{ font-family: var(--ed-sans); font-size: 14px; line-height: 1.4; color: var(--ed-muted); margin: 10px 0 0; }}
  .ed-step > .ed-step-cap::before {{
    content: counter(ed-step); display: inline-grid; place-items: center;
    width: 22px; height: 22px; margin-right: 8px;
    border: 1px solid var(--ed-accent); color: var(--ed-accent);
    border-radius: 99px; font-family: var(--ed-mono); font-size: 11px;
  }}
  .ed-multiples {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }}
  .ed-multiples .ed-mult-title {{ font-family: var(--ed-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ed-muted); margin: 0 0 6px; }}
  .ed-aside {{ font-family: var(--ed-sans); font-size: 15px; line-height: 1.5; background: #171F27; border-left: 3px solid var(--ed-accent); padding: 14px 16px; border-radius: 6px; color: var(--ed-muted); }}
</style>
</head>
<body>
  <div class="canvas ed">
    <figure class="ed-figure">
      <div class="ed-kicker">saiteja.ai</div>
      {title_html}
      {dek_html}
      <div class="ed-fig-body" role="img" aria-label="{alt}">{fig['markup']}</div>
      {src_html}
    </figure>
  </div>
</body>
</html>
"""


def _trim_bottom_canvas(png: Path, pad: int = 44) -> None:
    """Trim unused bottom obsidian strip from the 1200x1200 screenshot so the
    exported LinkedIn image tightly frames the figure card."""
    try:
        from PIL import Image, ImageChops
    except Exception:
        return
    with Image.open(png) as im:
        rgb = im.convert("RGB")
        bg = Image.new("RGB", rgb.size, (11, 15, 20))
        diff = ImageChops.difference(rgb, bg)
        # Ignore tiny ambient gradient variations near obsidian (#0B0F14)
        mask = diff.convert("L").point(lambda v: 255 if v > 14 else 0)
        bbox = mask.getbbox()
        if not bbox:
            return
        bottom = min(rgb.height, bbox[3] + pad)
        if bottom < rgb.height - 20 and bottom >= 260:
            rgb.crop((0, 0, rgb.width, bottom)).save(png)


def rasterize_figure(slug: str, fig: dict) -> Path:
    """Render one validated figure to public/art/blog/<slug>-figure-1.png via headless Chrome."""
    out = PUBLIC / "art" / "blog" / f"{slug}-figure-1.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    html_text = build_figure_html(fig)
    with tempfile.NamedTemporaryFile("w", suffix=".html", encoding="utf-8", delete=False) as tf:
        tf.write(html_text)
        tmp_html = Path(tf.name)
    try:
        cmd = [
            CHROME, "--headless=new", f"--screenshot={out}",
            "--window-size=1200,1200", "--hide-scrollbars",
            "--virtual-time-budget=5000", f"file://{tmp_html}",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT_S)
        if r.returncode != 0 or not out.exists():
            raise RuntimeError(f"chrome figure render failed (exit {r.returncode}): {(r.stderr or '')[-300:]}")
        _trim_bottom_canvas(out)
        size = out.stat().st_size
        if size < MIN_BYTES:
            raise RuntimeError(f"rendered figure too small ({size}B)")
        return out
    finally:
        tmp_html.unlink(missing_ok=True)


def capture_lead_figure(slug: str, markdown: str) -> str | None:
    """Rasterize the post's first valid ```figure block and upload to GCS.
    Returns ART_URL or None (never raises, so a rasterize glitch doesn't break post generation)."""
    figs = [f for f in extract_figures(markdown) if f["ok"]]
    if not figs:
        return None
    try:
        out = rasterize_figure(slug, figs[0])
        return upload_to_gcs(out)
    except Exception as e:
        print(f"  ⚠️  lead figure rasterize failed for {slug}: {e}")
        return None


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: render_figure.py <slug> <post.json-or-markdown-path>")
        return 2
    slug, path = sys.argv[1], Path(sys.argv[2])
    raw = path.read_text(encoding="utf-8")
    md = json.loads(raw).get("content", "") if path.suffix == ".json" else raw
    figs = [f for f in extract_figures(md) if f["ok"]]
    if not figs:
        print("no valid ```figure block found")
        return 1
    out = rasterize_figure(slug, figs[0])
    art_url = upload_to_gcs(out)
    print(f"ART_URL: {art_url}" if art_url else f"ART_LOCAL: /{out.relative_to(PUBLIC).as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
