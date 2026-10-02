"""run_tests.py — runs every scripts/test_*.py in its own interpreter.

Two styles coexist: self-running scripts (exit code is the verdict) and modules of plain
`test_*` functions with no __main__ block (we call each function). Exit 1 on any failure.
Run: python3 scripts/run_tests.py     (CI + `npm run test:py`)
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

_DRIVER = """
import importlib, sys, traceback
sys.path.insert(0, {here!r})
m = importlib.import_module({name!r})
bad = n = 0
for k in sorted(dir(m)):
    f = getattr(m, k)
    if k.startswith('test_') and callable(f):
        n += 1
        try: f(); print('ok  ' + k)
        except Exception:
            bad += 1; print('FAIL ' + k); traceback.print_exc()
print(f'{{n - bad}} passed, {{bad}} failed')
sys.exit(1 if bad or not n else 0)
"""


def main() -> int:
    failed = []
    for f in sorted(HERE.glob("test_*.py")):
        src = f.read_text()
        selfrun = '__main__' in src or "sys.exit(" in src
        cmd = [sys.executable, str(f)] if selfrun else [sys.executable, "-c", _DRIVER.format(here=str(HERE), name=f.stem)]
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=str(HERE.parent))
        tail = "\n".join((r.stdout + r.stderr).strip().splitlines()[-3:])
        print(f"{'PASS' if r.returncode == 0 else 'FAIL'}  {f.name}\n{tail}\n")
        if r.returncode:
            failed.append(f.name)
            print(r.stdout[-3000:], r.stderr[-3000:])
    print("FAILED: " + ", ".join(failed) if failed else "all python tests passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
