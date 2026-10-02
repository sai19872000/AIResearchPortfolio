"""test_gen_art.py — slug validation in gen_art.py (path traversal / overwrite guard)."""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_art  # noqa: E402


def test_bad_slugs_rejected():
    for bad in ("../../x", "../x", "a/b", "A", "-a", "", "a" * 82, "a b", "a\\b", "x.png"):
        assert gen_art.blog_out_path(bad, "hero") is None, bad


def test_good_slug_inside_art_dir():
    out = gen_art.blog_out_path("my-post-2", "hero")
    assert out is not None and out.name == "my-post-2-hero.png"
    assert out.resolve().is_relative_to(gen_art.ART_DIR.resolve())


def test_cli_exits_2_on_traversal():
    r = subprocess.run([sys.executable, str(Path(gen_art.__file__)), "hero", "../../x", "c"],
                       capture_output=True, text=True)
    assert r.returncode == 2, r.stdout + r.stderr
