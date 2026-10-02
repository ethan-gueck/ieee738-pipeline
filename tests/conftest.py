"""Put the repo root on the path so `core` imports however pytest is launched."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
