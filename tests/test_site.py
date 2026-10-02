"""The page loads its own assets (nothing from the portfolio) and the story covers every step."""

import re
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "site"
STEP_IDS = ["0", "0.2", "1", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8",
            "2", "2.0", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "4", "5", "6", "7"]


def test_page_references_only_its_own_assets():
    page = (SITE / "index.html").read_text()
    for ref in re.findall(r'(?:src|href)="([^"#]+)"', page):
        if ref.startswith("https://fonts."):
            continue
        assert not ref.startswith("http"), f"external reference {ref}"
        assert (SITE / ref).is_file(), f"missing {ref}"
    assert "ethan-gueck.github.io" not in page


def test_story_has_every_step_in_order():
    story = (SITE / "assets" / "js" / "story.js").read_text()
    steps = re.search(r"const STEPS = \[(.*?)\];", story, re.S).group(1)
    assert re.findall(r'id: "([\d.]+)"', steps) == STEP_IDS
    shots = set(re.findall(r'step: "([\d.]+)"', story))
    assert shots == set(STEP_IDS)
