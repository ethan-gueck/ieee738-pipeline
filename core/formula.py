"""IEEE 738 thermal pipeline: the mathematics the animation walks through, in pipeline order.

Each step that does arithmetic has a section; the others (installing, loading,
creating tables) move data and have none. Formulas are written the way they
read, with no input checks, rounding cleanup or formatting.
"""

import math


# _____________ Step 1.7 Substation with the highest standard deviation _____________

def mean(values):
    """x̄ = Σx / n"""
    return sum(values) / len(values)


def standard_deviation(values):
    """σ = √(Σ(x − x̄)² / n): how much a substation's amperage swings."""
    m = mean(values)
    return math.sqrt(sum((x - m) ** 2 for x in values) / len(values))


def substation_with_highest_deviation(amperage_by_substation):
    """Of the two nearest substations, the one whose amperage varies most."""
    return max(amperage_by_substation, key=lambda name: standard_deviation(amperage_by_substation[name]))


# _____________ Step 2.3 Conductor temperature _____________

def joule_heating(current, resistance):
    """q_j = I²·R(T_c), watts per metre of conductor"""
    return current**2 * resistance


def conductor_temperature(air_temperature, current, resistance, solar_heating, convective_cooling):
    """Steady state, heat in = heat out: T_c = T_a + (I²R + q_s) / h.

    A one-line stand-in for the IEEE 738 heat balance q_c + q_r = q_s + I²R(T_c),
    which the pipeline solves in full (air properties, three convection regimes,
    radiation, solar geometry, resistance at temperature) for every reading.
    """
    return air_temperature + (joule_heating(current, resistance) + solar_heating) / convective_cooling


# _____________ Step 2.6 Thermal cycles _____________

# An up event is a rise of 35 °C from the coolest point since the last down event;
# a down event is a fall of 35 °C from the hottest point since the last up event.
THERMAL_CYCLE_THRESHOLD = 35.0


def thermal_cycle_events(temperatures, threshold=THERMAL_CYCLE_THRESHOLD, carry=None):
    """Up and down events in a run of conductor temperatures, and the state to carry into the next run.

    ``carry`` is ``(looking_for, extreme)``: whether the next event is "up" or
    "down", and the coolest (or hottest) temperature seen since the last event.
    A run that ends half way through a cycle hands this to the historian, and
    the next run starts from it: thermal cycle stitching.
    """
    looking_for, extreme = carry or ("up", temperatures[0])
    events = []
    for index, t in enumerate(temperatures):
        if looking_for == "up":
            if t < extreme:
                extreme = t
            elif t - extreme >= threshold:
                events.append({"index": index, "kind": "up", "from": extreme, "to": t})
                looking_for, extreme = "down", t
        else:
            if t > extreme:
                extreme = t
            elif extreme - t >= threshold:
                events.append({"index": index, "kind": "down", "from": extreme, "to": t})
                looking_for, extreme = "up", t
    return events, (looking_for, extreme)


def thermal_cycles(events):
    """A thermal cycle is an up event followed by a down event: the (up, down) pairs."""
    return [(up, down) for up, down in zip(events, events[1:]) if up["kind"] == "up" and down["kind"] == "down"]
