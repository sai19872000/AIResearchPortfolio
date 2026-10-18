import importlib
import inspect
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

PINNED = "claude-sonnet-5"
OVERRIDES = ("BLOG_WRITER_MODEL", "SCOUT_GATE_MODEL")


def _process_runner(mod):
    """The stdlib module the product uses to launch the headless CLI, found by
    shape so the test never has to name it."""
    for val in vars(mod).values():
        if inspect.ismodule(val) and hasattr(val, "Popen") and hasattr(val, "run"):
            return val
    raise AssertionError("product module exposes no process-launching module")


def _fresh(name):
    # Reload with the override env vars cleared so the module-level default is
    # what we observe, whatever the operator's shell has exported.
    env = {k: v for k, v in os.environ.items() if k not in OVERRIDES}
    with mock.patch.dict(os.environ, env, clear=True):
        mod = importlib.import_module(name)
        return importlib.reload(mod)


class HeadlessRunsArePinnedToSonnet(unittest.TestCase):
    def _capture(self, mod, out_name, call):
        seen = []

        def fake_run(cmd, *args, **kwargs):
            seen.append(list(cmd))
            Path(kwargs["cwd"]).exists()
            (self.workdir / out_name).write_text(json.dumps({"ok": True}))
            return mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch.object(_process_runner(mod), "run", side_effect=fake_run):
            result = call()
        self.assertEqual(result, {"ok": True})
        self.assertEqual(len(seen), 1, "expected exactly one headless CLI launch")
        return seen[0]

    def _check_cmd(self, mod, cmd):
        self.assertEqual(cmd[0], mod.CLAUDE)
        self.assertEqual(cmd[1], "-p")
        self.assertIn(
            "--model", cmd,
            "headless claude -p must pin --model, else it inherits the operator default",
        )
        m = cmd.index("--model")
        self.assertEqual(cmd[m + 1], PINNED)
        self.assertIn("--allowedTools", cmd)
        a = cmd.index("--allowedTools")
        self.assertLess(m, a, "--model must come before the variadic --allowedTools")
        self.assertNotIn("--model", cmd[a + 1:])
        self.assertNotIn(PINNED, cmd[a + 1:])
        self.assertIn("Bash(python3:*)", cmd[a + 1:])

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.workdir = Path(self._tmp.name) / "gen"
        self.workdir.mkdir()

    def test_blog_writer_pins_model(self):
        mod = _fresh("scripts.blog_watcher")
        cmd = self._capture(
            mod, "post.json", lambda: mod.run_blogger(self.workdir, "some-slug")
        )
        self._check_cmd(mod, cmd)
        self.assertIn("Skill", cmd[cmd.index("--allowedTools") + 1:])

    def test_scout_gate_pins_model(self):
        mod = _fresh("scripts.research_scout")
        cmd = self._capture(
            mod, "verdict.json",
            lambda: mod._run_agent("judge this", self.workdir, "verdict.json"),
        )
        self._check_cmd(mod, cmd)
        self.assertEqual(cmd[2], "judge this")


if __name__ == "__main__":
    unittest.main()
