import pytest

from core import formula


def test_standard_deviation_and_the_substation_pick():
    assert formula.standard_deviation([2, 4, 4, 4, 5, 5, 7, 9]) == 2.0
    assert formula.mean([1, 2, 3, 4]) == 2.5
    flat, swinging = [500, 510, 495, 505], [300, 900, 250, 950]
    assert formula.substation_with_highest_deviation({"A": flat, "B": swinging}) == "B"


def test_conductor_temperature_is_air_plus_heat_over_cooling():
    # 1000 A through 7.27e-5 Ω/m is 72.7 W/m; with 10 W/m of sun and h = 5 W/(m·°C) the line runs 16.54 °C above the air.
    assert formula.joule_heating(1000, 7.27e-5) == pytest.approx(72.7)
    assert formula.conductor_temperature(25, 1000, 7.27e-5, 10, 5) == pytest.approx(25 + 82.7 / 5)


def test_thermal_cycle_events_need_35_degrees_each_way():
    # 20 -> 56 is an up event (+36); 70 -> 34 a down event (−36); 30 -> 64 is only +34, so no third event.
    events, carry = formula.thermal_cycle_events([20, 40, 56, 70, 50, 34, 30, 50, 60, 64, 40, 28])
    assert [(e["index"], e["kind"]) for e in events] == [(2, "up"), (5, "down")]
    assert carry == ("up", 28)
    assert len(formula.thermal_cycles(events)) == 1


def test_stitching_resumes_a_half_cycle():
    # The previous run ended after an up event with the conductor at 84 °C; this run starts cooling.
    events, _ = formula.thermal_cycle_events([80, 60, 45, 30], carry=("down", 84.0))
    assert [(e["index"], e["kind"], e["from"]) for e in events] == [(2, "down", 84.0)]
    assert formula.thermal_cycle_events([80, 60, 45, 30])[0] == []   # without the historian the down event is missed


def test_cycles_pair_an_up_with_the_down_after_it():
    events = [{"kind": "down"}, {"kind": "up"}, {"kind": "down"}, {"kind": "up"}]
    assert formula.thermal_cycles(events) == [(events[1], events[2])]
