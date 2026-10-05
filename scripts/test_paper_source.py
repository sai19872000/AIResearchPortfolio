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
print("PASS test_paper_source" if not FAIL else f"FAIL test_paper_source ({FAIL})")
sys.exit(1 if FAIL else 0)
