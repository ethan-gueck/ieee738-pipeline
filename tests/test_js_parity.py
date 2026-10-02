"""The browser mirror (site/assets/js/pipeline_math.js) must match core/formula.py exactly."""

import json
from pathlib import Path

import pytest

from core import formula

from .jsrun import AVAILABLE, assert_close, run_js

SCRIPTS = [Path(__file__).resolve().parents[1] / "site" / "assets" / "js" / "pipeline_math.js"]
SERIES = [[20, 40, 56, 70, 50, 34, 30, 50, 60, 64, 40, 28], [80, 60, 45, 30, 70, 90, 50, 20], [25.5, 61.2, 99.9, 63.0, 27.1, 71.4]]
FUNCTIONS = ["mean", "standard_deviation", "substation_with_highest_deviation", "joule_heating", "conductor_temperature", "thermal_cycle_events", "thermal_cycles"]

pytestmark = pytest.mark.skipif(not AVAILABLE, reason="no JavaScript runtime (node or osascript)")


def js(expression):
    return run_js(SCRIPTS, expression)


def test_thermal_cycle_events_match_python():
    for series in SERIES:
        for carry in (None, ["down", 84.0], ["up", 15.0]):
            events, out = formula.thermal_cycle_events(series, carry=tuple(carry) if carry else None)
            call = f"window.PipelineMath.thermal_cycle_events({json.dumps(series)}, 35, {json.dumps(carry)})"
            assert_close(json.loads(json.dumps([events, list(out)])), js(call), str((series, carry)))
            assert len(formula.thermal_cycles(events)) == js(f"window.PipelineMath.thermal_cycles({call}[0]).length")


def test_statistics_and_temperature_match_python():
    amps = {"A": [380, 1200, 400, 1150, 390], "B": [520, 780, 530, 770, 525]}
    assert js(f"window.PipelineMath.substation_with_highest_deviation({json.dumps(amps)})") == formula.substation_with_highest_deviation(amps)
    assert_close(formula.standard_deviation(amps["A"]), js(f"window.PipelineMath.standard_deviation({json.dumps(amps['A'])})"))
    assert_close(formula.conductor_temperature(28, 1119, 8.36e-5, 12, 2.0), js("window.PipelineMath.conductor_temperature(28, 1119, 8.36e-5, 12, 2.0)"))


def test_every_formula_has_a_mirror():
    assert set(FUNCTIONS) <= set(js("Object.keys(window.PipelineMath)"))
