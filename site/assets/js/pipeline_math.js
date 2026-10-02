/*
 * pipeline_math.js — browser mirror of core/formula.py.
 *
 * The animation computes its illustrative run with the same mathematics as the
 * Python: the substation pick (Step 1.7), conductor temperature (Step 2.3) and
 * the 35 °C thermal cycle events (Step 2.6). tests/test_js_parity.py keeps the
 * two identical. Exposes window.PipelineMath (browser) or module.exports (Node).
 */
(function (global) {
  "use strict";

  // ---- Step 1.7 Substation with the highest standard deviation -------------
  const mean = (values) => values.reduce((s, x) => s + x, 0) / values.length;
  function standardDeviation(values) {
    const m = mean(values);
    return Math.sqrt(values.reduce((s, x) => s + (x - m) ** 2, 0) / values.length);
  }
  function substationWithHighestDeviation(amperageBySubstation) {
    let best = null, bestSigma = -Infinity;
    for (const [name, values] of Object.entries(amperageBySubstation)) {
      const sigma = standardDeviation(values);
      if (sigma > bestSigma) [best, bestSigma] = [name, sigma];
    }
    return best;
  }

  // ---- Step 2.3 Conductor temperature --------------------------------------
  const jouleHeating = (current, resistance) => current ** 2 * resistance;
  const conductorTemperature = (airTemperature, current, resistance, solarHeating, convectiveCooling) =>
    airTemperature + (jouleHeating(current, resistance) + solarHeating) / convectiveCooling;

  // ---- Step 2.6 Thermal cycles ---------------------------------------------
  const THERMAL_CYCLE_THRESHOLD = 35.0;

  function thermalCycleEvents(temperatures, threshold = THERMAL_CYCLE_THRESHOLD, carry = null) {
    let [lookingFor, extreme] = carry || ["up", temperatures[0]];
    const events = [];
    temperatures.forEach((t, index) => {
      if (lookingFor === "up") {
        if (t < extreme) extreme = t;
        else if (t - extreme >= threshold) {
          events.push({ index, kind: "up", from: extreme, to: t });
          [lookingFor, extreme] = ["down", t];
        }
      } else if (t > extreme) extreme = t;
      else if (extreme - t >= threshold) {
        events.push({ index, kind: "down", from: extreme, to: t });
        [lookingFor, extreme] = ["up", t];
      }
    });
    return [events, [lookingFor, extreme]];
  }

  const thermalCycles = (events) =>
    events.slice(0, -1).map((up, i) => [up, events[i + 1]]).filter(([up, down]) => up.kind === "up" && down.kind === "down");

  const api = {
    THERMAL_CYCLE_THRESHOLD,
    mean, standard_deviation: standardDeviation, substation_with_highest_deviation: substationWithHighestDeviation,
    joule_heating: jouleHeating, conductor_temperature: conductorTemperature,
    thermal_cycle_events: thermalCycleEvents, thermal_cycles: thermalCycles,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.PipelineMath = api;
})(typeof window !== "undefined" ? window : globalThis);
