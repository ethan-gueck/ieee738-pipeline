"""Run the site's browser scripts from Python for the parity tests: Node.js, or macOS's JavaScriptCore."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

NODE = shutil.which("node")
OSASCRIPT = shutil.which("osascript")
AVAILABLE = bool(NODE or OSASCRIPT)


def run_js(scripts: list[Path], expression: str):
    """Load ``scripts`` as plain browser scripts (``window`` is the global object), evaluate ``expression``, return it from JSON."""
    source = "var window = this;\n" + "\n;\n".join(Path(s).read_text() for s in scripts)
    if NODE:
        cmd = [NODE, "-e", f"(function () {{ var module = undefined; {source}\nconsole.log(JSON.stringify({expression})); }}).call(globalThis);"]
    else:
        cmd = [OSASCRIPT, "-l", "JavaScript", "-e", f"(function () {{ var module = undefined; {source}\nreturn JSON.stringify({expression}); }}).call(this);"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"JS failed:\n{result.stderr}")
    return json.loads(result.stdout)


def assert_close(py, js, path: str = "root", rel: float = 1e-9) -> None:
    """Deep-compare JSON-like values, with a relative tolerance for floats."""
    if isinstance(py, dict):
        assert isinstance(js, dict) and py.keys() == js.keys(), f"{path}: keys differ"
        for key in py:
            assert_close(py[key], js[key], f"{path}.{key}", rel)
    elif isinstance(py, (list, tuple)):
        assert isinstance(js, list) and len(py) == len(js), f"{path}: {py} != {js}"
        for i, (p, j) in enumerate(zip(py, js)):
            assert_close(p, j, f"{path}[{i}]", rel)
    elif isinstance(py, float) or isinstance(js, float):
        assert abs(py - js) <= max(rel * max(abs(py), abs(js)), 1e-12), f"{path}: {py} != {js}"
    else:
        assert py == js, f"{path}: {py!r} != {js!r}"
