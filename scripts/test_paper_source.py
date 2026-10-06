"""python scripts/test_paper_source.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import paper_source as ps

FAIL = 0
def ok(c, m):
    global FAIL
    print(("PASS " if c else "FAIL ") + m); FAIL += not c

ok(ps.arxiv_id("https://arxiv.org/abs/2610.02117") == "2610.02117", "abs id")
ok(ps.arxiv_id("https://arxiv.org/pdf/2610.02117v2.pdf") == "2610.02117", "pdf + version id")
ok(ps.arxiv_id("https://openai.com/index/x") is None, "non-arxiv -> None")
ok(ps.full_text_candidates("https://arxiv.org/abs/2610.02117") ==
   ["https://arxiv.org/html/2610.02117", "https://arxiv.org/pdf/2610.02117", "https://arxiv.org/abs/2610.02117"],
   "issue #28: html first, pdf next, abstract page last")
ok(ps.full_text_candidates("https://openai.com/index/x") == ["https://openai.com/index/x"], "non-paper unchanged")
ok(ps.is_abstract_only("https://arxiv.org/abs/2610.02117") and not ps.is_abstract_only("https://arxiv.org/html/2610.02117"),
   "abstract-only detection")
PAPER = "Introduction. " + "Method details and results. " * 600          # > MIN_FULL_TEXT
def fetcher(pages):
    def f(url, limit=12000):
        return pages.get(url, f"[could not fetch {url}: 404]")[:limit]
    return f
A = "https://arxiv.org/abs/2610.02117"
t, used, ab = ps.fetch_paper(A, fetcher({"https://arxiv.org/html/2610.02117": PAPER}))
ok(used.endswith("/html/2610.02117") and not ab and len(t) > ps.MIN_FULL_TEXT, "full HTML used when available")
t, used, ab = ps.fetch_paper(A, fetcher({"https://arxiv.org/html/2610.02117": "No HTML for '2610.02117'"}),
                             fetch_raw=lambda u: b"%PDF", to_text=lambda b: PAPER)
ok(used.endswith("/pdf/2610.02117") and not ab, "no HTML -> PDF text")
t, used, ab = ps.fetch_paper(A, fetcher({A: "Abstract: short."}), fetch_raw=lambda u: (_ for _ in ()).throw(OSError("x")))
ok(used == A and ab, "nothing else -> abstract page, flagged abstract_only")
t, used, ab = ps.fetch_paper("https://openai.com/index/x", fetcher({"https://openai.com/index/x": "post"}))
ok((t, used, ab) == ("post", "https://openai.com/index/x", False), "non-paper links unchanged")
ok(len(ps.fetch_paper(A, fetcher({"https://arxiv.org/html/2610.02117": PAPER * 5}))[0]) <= ps.PAPER_LIMIT, "paper text capped at PAPER_LIMIT")

print("PASS test_paper_source" if not FAIL else f"FAIL test_paper_source ({FAIL})")
sys.exit(1 if FAIL else 0)
