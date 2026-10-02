/*
 * story.js — the IEEE 738 thermal pipeline, told as one camera move.
 *
 * Three layers share one canvas, each with its own camera:
 *   intro  the line risk bot (a classic square-headed robot in a Waldo hat and
 *          glasses) installs its dependencies and archives the last run's logs;
 *   map    the lower 48 states, settling on Virginia;
 *   land   a side view of one line in Virginia: the NOAA weather station, the
 *          two substations at the line's ends, the towers and conductors
 *          between them, and the LRP3 calculator where the bot works out
 *          temperatures and thermal cycles. The horizon stays near the bottom.
 * Every shot runs in beats: the step's title fades in and out in the middle,
 * then the camera moves, then one thing at a time animates while the bot asks
 * its question. Only the weather station's instruments keep moving on their own.
 * Open the page with #t=42 to start 42 seconds in.
 */
(function () {
  "use strict";
  const M = window.PipelineMath;

  // ---- The pipeline's steps, in run order ------------------------------------
  const STEPS = [
    { id: "0", title: "Install dependencies", group: "Setup" },
    { id: "0.2", title: "Archive old logs", group: "Setup" },
    { id: "1", title: "Run every Step 1 substep", group: "Step 1 · Gather the inputs" },
    { id: "1.1", title: "Fetch conductor metadata", group: "Step 1 · Gather the inputs" },
    { id: "1.2", title: "Extract structure information", group: "Step 1 · Gather the inputs" },
    { id: "1.3", title: "Map conductors to structures", group: "Step 1 · Gather the inputs" },
    { id: "1.4", title: "Find the nearest weather station", group: "Step 1 · Gather the inputs" },
    { id: "1.5", title: "Pull weather data", group: "Step 1 · Gather the inputs" },
    { id: "1.6", title: "Map the two nearest substations", group: "Step 1 · Gather the inputs" },
    { id: "1.7", title: "Keep the substation with the highest σ", group: "Step 1 · Gather the inputs" },
    { id: "1.8", title: "Load metadata to the database", group: "Step 1 · Gather the inputs" },
    { id: "2", title: "Override the batch scripts", group: "Step 2 · Temperatures and thermal cycles" },
    { id: "2.0", title: "Flight check the date ranges", group: "Step 2 · Temperatures and thermal cycles" },
    { id: "2.1", title: "Clear old temperature data", group: "Step 2 · Temperatures and thermal cycles" },
    { id: "2.2", title: "Create temperature tables if needed", group: "Step 2 · Temperatures and thermal cycles" },
    { id: "2.3", title: "Calculate conductor temperatures", group: "Step 2 · Temperatures and thermal cycles" },
    { id: "2.4", title: "Drop and recreate thermal cycle tables", group: "Step 2 · Temperatures and thermal cycles" },
    { id: "2.5", title: "Clean up or stitch from the historian", group: "Step 2 · Temperatures and thermal cycles" },
    { id: "2.6", title: "Calculate thermal cycles", group: "Step 2 · Temperatures and thermal cycles" },
    { id: "4", title: "Convert files to CSV", group: "Optional steps", optional: "validation" },
    { id: "5", title: "Conform dist and config files", group: "Optional steps", optional: "configuration" },
    { id: "6", title: "Visualize temperature results", group: "Optional steps", optional: "validation" },
    { id: "7", title: "Visualize resource metrics", group: "Optional steps", optional: "validation" },
  ];
  const STEP = Object.fromEntries(STEPS.map((s) => [s.id, s]));

  // ---- Palette (as the portfolio's conductor scene; navy and gold in dark mode) ----
  const LIGHT = {
    bg: ["#072A20", "#0B3D2E", "#125A43"], skyTop: "#0E4A38", skyBottom: "#072A20",
    hillFar: "#0D4434", hillNear: "#0A3529", ground: "#062219",
    text: "#F3EEE6", dim: "rgba(243,238,230,0.68)", faint: "rgba(243,238,230,0.18)",
    sand: "#D8C3A5", gold: "#F2C14E", mint: "#8FC7B1", steel: "#B9C4BE", hot: "#E9896A",
    panel: "rgba(7,42,32,0.82)", panelEdge: "rgba(216,195,165,0.4)", land: "rgba(216,195,165,0.10)", landEdge: "rgba(216,195,165,0.45)",
    screen: "#04170F", frame: "#1C2F29", desk: "#2E4A40", leg: "#24403A", cloud: ["#8A8F8C", "#6F7672"],
  };
  const DARK = {
    bg: ["#0b1d30", "#102a43", "#243b53"], skyTop: "#243b53", skyBottom: "#102a43",
    hillFar: "#1c3550", hillNear: "#162c44", ground: "#0b1d30",
    text: "#f0f4f8", dim: "rgba(240,244,248,0.68)", faint: "rgba(240,244,248,0.18)",
    sand: "#edc378", gold: "#e5a93c", mint: "#9fb3c8", steel: "#bcccdc", hot: "#f0a07e",
    panel: "rgba(4,14,26,0.82)", panelEdge: "rgba(229,169,60,0.4)", land: "rgba(240,244,248,0.08)", landEdge: "rgba(237,195,120,0.45)",
    screen: "#06111d", frame: "#1b2d40", desk: "#2a3f55", leg: "#22364b", cloud: ["#8796a6", "#6b7a8a"],
  };
  // The bot: darker steel, a Waldo hat and glasses, belly lights in forest green, white and grey-blue.
  const BOT = { body: "#8E9C95", shade: "#6C7A73", line: "#061F17", red: "#C8102E", white: "#F5F2EC", rim: "#121212", lights: ["#2E7D4F", "#F5F2EC", "#829AB1"] };
  let P = LIGHT;
  const SANS = '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif';
  const SERIF = '"Newsreader", Georgia, serif';
  const MONO = '"IBM Plex Mono", ui-monospace, monospace';

  // ---- Small math ------------------------------------------------------------------
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const smooth = (k) => ease(clamp(k));

  // ---- The illustrative run, computed with core/formula.py's mathematics -----------
  const DATA = (function () {
    let s = 7;
    const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const START = 12, HOURS = 100, R = 7.27e-5 * 1.15;   // Drake ACSR, Ω/m near operating temperature
    const amp = { A: [], B: [] }, air = [], wind = [], solar = [], temps = [];
    for (let k = 0; k < HOURS; k++) {
      const h = k + START, day = Math.floor(h / 24), hr = h % 24;
      const load = hr >= 6 && hr <= 22 ? Math.max(0, Math.sin(Math.PI * (hr - 6) / 16)) : 0;
      const peak = [0.85, 0.28, 0.9, 0.85, 0.95, 0.9][day];
      amp.A.push(380 + 900 * peak * load + 40 * (rand() - 0.5));
      amp.B.push(520 + 260 * load + 30 * (rand() - 0.5));
      air.push(22 + 7 * Math.sin(Math.PI * (hr - 9) / 12));
      wind.push(Math.max(0.4, 1.6 - 1.0 * Math.sin(Math.PI * (hr - 6) / 12) + 0.4 * (rand() - 0.5)));
      solar.push(Math.max(0, 14 * Math.sin(Math.PI * (hr - 6) / 13)));
      temps.push(M.conductor_temperature(air[k], amp.A[k], R, solar[k], 0.9 + 1.4 * Math.sqrt(wind[k])));
    }
    const carryIn = ["down", 84];   // the historian's open half cycle from the previous run
    const [events, carryOut] = M.thermal_cycle_events(temps, M.THERMAL_CYCLE_THRESHOLD, carryIn);
    const sigma = { A: M.standard_deviation(amp.A), B: M.standard_deviation(amp.B) };
    return { amp, air, wind, solar, temps, events, carryIn, carryOut, cycles: M.thermal_cycles(events), sigma, chosen: M.substation_with_highest_deviation(amp) };
  })();

  // ---- The map: lower-48 state outlines (Albers USA, 975 × 610) ---------------------
  const STATES = window.US_STATES;
  const VA_RINGS = STATES["51"];
  const SITE = (function () {   // a point inside Virginia's mainland, where the line is
    const ring = VA_RINGS.reduce((a, b) => (b.length > a.length ? b : a));
    const c = ring.reduce((acc, [x, y]) => [acc[0] + x / ring.length, acc[1] + y / ring.length], [0, 0]);
    return [c[0] - 6, c[1] - 4];
  })();

  // ---- Landscape (side view, ground at y = 0, metres-ish) -------------------------
  const TOWERS = [300, 500, 700, 900, 1100, 1300, 1500, 1700];
  const GANTRY = { A: 170, B: 1830 };
  const ATTACH = -112;
  const STATION = { dome: -770, radar: -620, sock: -520, mast: -880 };
  const DESK = { x: 2250 };
  const SCREEN = { x: 2330, y: -262, w: 380, h: 214 };
  const DB = { x: 2730 };
  const LINE_MID = 1000;

  // ---- Shots ------------------------------------------------------------------------------
  // cam: camera moves, each { a, b, ...camera } running from local second a to b; the camera holds between moves.
  // say: what the bot asks or says, [from, to, text] in local seconds. title: the step's card opens the shot.
  const US = { space: "map", x: 487, y: 305, z: 0.92 };
  const VA = { space: "map", x: 806, y: 288, z: 4.2 };
  const WIDE = { space: "land", x: 1110, z: 0.4 };
  const WORK = { space: "land", x: 2440, z: 1.45 };
  const SHOTS = [
    { key: "0", step: "0", dur: 10, title: true, cam: [], say: [[3, 6.2, "First, my tools."]],
      text: "Step 0 installs the pipeline's dependencies." },
    { key: "0.2", step: "0.2", dur: 11, title: true, cam: [], say: [[3.4, 6.8, "Archiving the last run's logs."]],
      text: "Step 0.2 archives the logs from the last run, so this run starts with a clean slate and the old ones are kept." },
    { key: "1", step: "1", dur: 12, title: true, cam: [{ a: 2.6, b: 4.2, ...US }, { a: 7.4, b: 10.4, ...VA }], say: [[7.4, 10.6, "Where is this line?"]],
      text: "Step 1 runs every substep that gathers the inputs, starting with one line in Virginia." },
    { key: "1.1", step: "1.1", dur: 12, title: true, cam: [{ a: 2.6, b: 6.4, space: "land", x: 860, z: 2.3 }], say: [[6.6, 9.6, "What conductor is this?"]],
      text: "Step 1.1 fetches the conductor's metadata: type, diameter, resistance and its limits." },
    { key: "1.2", step: "1.2", dur: 11, title: true, cam: [{ a: 2.6, b: 5, space: "land", x: 1200, z: 1.55 }], say: [[5.2, 8.2, "Where is every structure?"]],
      text: "Step 1.2 extracts each structure: where it stands, its elevation, and the span to the next tower." },
    { key: "1.3", step: "1.3", dur: 10, title: true, cam: [{ a: 2.6, b: 4.2, space: "land", x: 1000, z: 1.2 }], say: [[4.4, 7.4, "Which spans hang on which towers?"]],
      text: "Step 1.3 maps every conductor span onto the structures that carry it." },
    { key: "1.4", step: "1.4", dur: 11, title: true, cam: [{ a: 2.6, b: 5.4, space: "land", x: 150, z: 0.5 }], say: [[5.6, 8.6, "Where's the nearest weather station?"]],
      text: "Step 1.4 finds the NOAA weather station nearest the line." },
    { key: "1.5", step: "1.5", dur: 24.5, title: true, cam: [{ a: 2.6, b: 5.2, space: "land", x: -700, z: 2.05 }],
      say: [[6, 9, "How strong is the sun?"], [11, 14, "Is the air clear or industrial?"], [16.6, 19.6, "What is the wind speed?"], [20.6, 24, "I need to decide between forced and natural convection."]],
      text: "Step 1.5 pulls the station's weather: sunlight, clear or industrial air, wind speed and direction, and air temperature." },
    { key: "1.6", step: "1.6", dur: 18, title: true,
      cam: [{ a: 2.6, b: 5, ...WIDE, x: 400, z: 0.42 }, { a: 5.4, b: 7.4, space: "land", x: 900, z: 1.3 }, { a: 7.8, b: 11.4, space: "land", x: 1780, z: 1.3 }, { a: 13.8, b: 16.4, ...WIDE }],
      say: [[5.4, 8.6, "Which substations feed this line?"], [11.6, 13.6, "Found one: Substation B."]],
      text: "Step 1.6 follows the line to its two nearest substations, one at each end, and maps both to the conductor." },
    { key: "1.7", step: "1.7", dur: 12, title: true, cam: [], say: [[3, 6, "Which one swings the most?"], [8, 11, "Substation A: σ = 303 A."]],
      text: "Step 1.7 keeps the substation whose amperage varies most: the highest standard deviation." },
    { key: "1.7b", step: "1.7", dur: 9, cam: [{ a: 0.3, b: 3.3, space: "land", x: 95, z: 3.1 }], say: [[3.6, 6.6, "Amperage, every hour."]],
      text: "Inside Substation A, the amperage the conductor carries is recorded every hour." },
    { key: "1.8", step: "1.8", dur: 13, title: true, cam: [{ a: 2.6, b: 4.6, ...WIDE, x: 1300, z: 0.4 }, { a: 4.8, b: 8, ...WORK }], say: [[10, 12.8, "Saving it all to the database."]],
      text: "Step 1.8 loads the conductor, structure, weather and amperage metadata into the database." },
    { key: "2", step: "2", dur: 10, title: true, cam: [], say: [[3, 6, "Setting this run's batch scripts."]],
      text: "Step 2 overrides the .dist batch scripts with this run's settings from the .yaml configs." },
    { key: "2.0", step: "2.0", dur: 10, title: true, cam: [], say: [[3, 6, "Do all the dates line up?"]],
      text: "Step 2.0 runs a flight check: do the metadata, weather and amperage cover the same dates?" },
    { key: "2.1", step: "2.1", dur: 8, title: true, cam: [], say: [[3, 5.8, "Out with the old temperatures."]],
      text: "Step 2.1 clears out the old temperature data." },
    { key: "2.2", step: "2.2", dur: 8, title: true, cam: [], say: [[3, 5.8, "Making sure the tables exist."]],
      text: "Step 2.2 creates the temperature tables if they don't exist." },
    { key: "2.3", step: "2.3", dur: 15, title: true, cam: [], say: [[3, 6, "How hot is the conductor?"], [8.5, 12, "Heat in equals heat out, every hour."]],
      text: "Step 2.3 calculates the conductor's temperature hour by hour from the IEEE 738 heat balance." },
    { key: "2.4", step: "2.4", dur: 9, title: true, cam: [], say: [[3, 6, "Fresh thermal cycle tables."]],
      text: "Step 2.4 drops and recreates the thermal cycle detail and summary tables." },
    { key: "2.5", step: "2.5", dur: 11, title: true, cam: [], say: [[3, 6, "Did the last run leave a half cycle?"], [7, 9.8, "Yes. Stitch it on."]],
      text: "Step 2.5 cleans up the historian, or points to it when a cycle must resume from a half cycle: thermal cycle stitching." },
    { key: "2.6", step: "2.6", dur: 17, title: true, cam: [], say: [[4.4, 7.6, "Up 35, down 35: that's one cycle."], [12.8, 16, "Three cycles, one of them stitched."]],
      text: "Step 2.6 counts thermal cycles: an up event of 35 °C, then a down event of 35 °C." },
    { key: "4", step: "4", dur: 8, title: true, cam: [], say: [[3, 5.8, "CSV copies, for checking."]],
      text: "Optional Step 4 converts the results to CSV for checking by eye." },
    { key: "5", step: "5", dur: 9, title: true, cam: [], say: [[3, 6, "Do the dist and config files conform?"]],
      text: "Optional Step 5 conforms the .dist batch scripts and the .yaml config files." },
    { key: "6", step: "6", dur: 9, title: true, cam: [], say: [[3, 6, "Here's how hot it ran."]],
      text: "Optional Step 6 visualizes the temperature results." },
    { key: "7", step: "7", dur: 10, title: true, cam: [], say: [[3, 6, "And what the run used."], [7.4, 10, "Pipeline complete."]],
      text: "Optional Step 7 visualizes the resources the run used. The pipeline is done." },
  ];
  let TOTAL = 0;
  SHOTS.forEach((shot) => { shot.start = TOTAL; TOTAL += shot.dur; });
  const SHOT = Object.fromEntries(SHOTS.map((shot) => [shot.key, shot]));
  const STEP_START = {};
  SHOTS.forEach((shot) => { if (!(shot.step in STEP_START)) STEP_START[shot.step] = shot.start; });

  let T = 0;                 // current time, seconds
  let layerAlpha = 1;        // the layer's opacity, so nested fades multiply with it
  const A = (k) => clamp(k) * layerAlpha;
  const local = (key) => T - SHOT[key].start;
  const active = (key) => T >= SHOT[key].start && T < SHOT[key].start + SHOT[key].dur;
  const after = (key, s = 0) => T >= SHOT[key].start + s;
  /** 0 → 1 as shot `key` runs from local second a to b (0 before, 1 after). */
  const ramp = (key, a, b) => smooth((local(key) - a) / (b - a));
  /** Visible from local second `a` of shot `from` to the end of shot `to`, fading over `f` seconds at each end. */
  function span(from, a, to = from, f = 0.6) {
    const end = SHOT[to].start + SHOT[to].dur;
    return Math.min(smooth((T - SHOT[from].start - a) / f), smooth((end - T) / f));
  }

  function shotAt(t) {
    let i = SHOTS.findIndex((shot) => t < shot.start + shot.dur);
    if (i < 0) i = SHOTS.length - 1;
    return { i, shot: SHOTS[i] };
  }

  // ---- Cameras --------------------------------------------------------------------------
  const camLerp = (a, b, k) => ({ ...b, x: lerp(a.x, b.x, k), y: lerp(a.y ?? 0, b.y ?? 0, k), z: a.z * Math.pow(b.z / a.z, k), gy: lerp(a.gy ?? 0.86, b.gy ?? 0.86, k) });
  const INTRO = { space: "intro" };
  function endCam(i) {
    for (let j = i; j >= 0; j--) if (SHOTS[j].cam.length) return SHOTS[j].cam[SHOTS[j].cam.length - 1];
    return INTRO;
  }

  /** Each layer's camera at time t, and how visible each layer is. */
  function view(t) {
    const { i, shot } = shotAt(t);
    const s = t - shot.start;
    let from = endCam(i - 1);
    for (const move of shot.cam) {
      if (s < move.a) return blend(from, from, 1);
      if (s <= move.b) return blend(from, move, smooth((s - move.a) / (move.b - move.a)));
      from = move;
    }
    return blend(from, from, 1);
  }

  function blend(a, b, k) {
    const out = { intro: 0, map: null, land: null };
    if (a.space === b.space) {
      if (a.space === "intro") out.intro = 1;
      else out[a.space] = { cam: camLerp(a, b, k), alpha: 1 };
      return out;
    }
    const fade = smooth((k - 0.25) / 0.5);
    if (a.space === "intro") { out.intro = 1 - fade; out[b.space] = { cam: b, alpha: fade }; return out; }
    // map -> land: dive into the line's site; the landscape grows out of it, its horizon settling to the bottom
    out.map = { cam: camLerp(a, { ...a, x: SITE[0], y: SITE[1], z: a.z * 60 }, k), alpha: 1 - fade };
    out.land = { cam: camLerp({ ...b, z: b.z * 0.02, gy: 0.5 }, b, k), alpha: fade };
    return out;
  }

  // ---- Canvas -----------------------------------------------------------------------------
  const canvas = document.getElementById("story");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, U = 1;   // CSS pixels; U scales type and strokes with the canvas width
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height; U = clamp(W / 960, 0.62, 1.4);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let cam = { x: 0, y: 0, s: 1, oy: 0 };   // the camera being drawn with: world -> screen
  function mapCam(c) { cam = { x: c.x, s: (c.z * W) / 975, oy: H / 2 - c.y * ((c.z * W) / 975) }; }
  function landCam(c) { cam = { x: c.x, s: (c.z * W) / 1000, oy: (c.gy ?? 0.86) * H }; }   // ground (y = 0) sits at gy·H
  const X = (x) => (x - cam.x) * cam.s + W / 2;
  const Y = (y) => y * cam.s + cam.oy;
  const L = (v) => v * cam.s;

  const font = (size, weight = 400, family = SANS) => { ctx.font = `${weight} ${size}px ${family}`; };
  function roundRect(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function panel(x, y, w, h, alpha = 1) {
    ctx.save(); ctx.globalAlpha = A(alpha);
    roundRect(x, y, w, h, 8 * U); ctx.fillStyle = P.panel; ctx.fill();
    ctx.strokeStyle = P.panelEdge; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  /** A labelled card: a title, then rows of [label, value, alpha]. Rows can arrive one at a time. */
  function card(x, y, title, rows, alpha = 1, opts = {}) {
    if (alpha <= 0) return;
    const w = (opts.w || 250) * U, pad = 12 * U, rowH = 19 * U, h = pad * 2 + 18 * U + rows.length * rowH;
    const left = clamp(opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x, 6, W - w - 6);
    const top = clamp(y, 6, H - h - 6);
    panel(left, top, w, h, alpha);
    ctx.save(); ctx.globalAlpha = A(alpha);
    font(11 * U, 600); ctx.fillStyle = opts.color || P.gold; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(title.toUpperCase(), left + pad, top + pad + 11 * U);
    rows.forEach(([label, value, k = 1], i) => {
      if (k <= 0) return;
      ctx.globalAlpha = A(alpha * k);
      const ry = top + pad + 18 * U + (i + 1) * rowH - 5 * U;
      font(12 * U); ctx.fillStyle = P.dim; ctx.textAlign = "left"; ctx.fillText(label, left + pad, ry);
      font(12.5 * U, 600); ctx.fillStyle = P.text; ctx.textAlign = "right"; ctx.fillText(value, left + w - pad, ry);
    });
    ctx.restore();
  }
  function tag(text, x, y, alpha = 1, color = P.text, size = 11) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = A(alpha);
    font(size * U, 600);
    const w = ctx.measureText(text).width + 12 * U, h = 18 * U;
    roundRect(x - w / 2, y - h, w, h, 9 * U); ctx.fillStyle = P.panel; ctx.fill(); ctx.strokeStyle = P.panelEdge; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y - h / 2 + 0.5);
    ctx.restore();
  }
  function check(x, y, r, k, color = P.mint) {
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = A(1); ctx.strokeStyle = color; ctx.lineWidth = 2.2 * U; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const a = [x - r, y], b = [x - r * 0.25, y + r * 0.7], c = [x + r, y - r * 0.8], k1 = clamp(k * 2), k2 = clamp(k * 2 - 1);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(lerp(a[0], b[0], k1), lerp(a[1], b[1], k1));
    if (k2 > 0) ctx.lineTo(lerp(b[0], c[0], k2), lerp(b[1], c[1], k2));
    ctx.stroke(); ctx.restore();
  }
  function mix(a, b, k) {
    const pa = parse(a), pb = parse(b);
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], k))).join(",")})`;
  }
  function parse(c) { const h = c.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }

  // ---- The line risk bot ------------------------------------------------------------------
  /** A classic square-headed robot in a Waldo hat and glasses, feet at (x, y), about s pixels tall. Returns where its mouth is. */
  function drawBot(x, y, s, o = {}) {
    const u = s / 120, lw = Math.max(1, 1.6 * u);
    // a gentle idle bob that never stops, a little livelier while it speaks
    const lift = (1 + Math.sin(T * 2.4)) * 0.8 * u + (o.talking ? Math.abs(Math.sin(T * 9)) * 1.2 * u : 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = BOT.line; ctx.lineWidth = lw;
    for (const side of [-1, 1]) {   // legs and feet
      const step = o.walk ? Math.sin(T * 8 + (side > 0 ? Math.PI : 0)) * 3 * u : 0;
      ctx.fillStyle = BOT.shade; ctx.fillRect(side * 12 * u - 4 * u, -24 * u, 8 * u, 20 * u); ctx.strokeRect(side * 12 * u - 4 * u, -24 * u, 8 * u, 20 * u);
      roundRect(side * 12 * u - 8 * u + step, -6 * u, 16 * u, 6 * u, 2 * u); ctx.fillStyle = BOT.body; ctx.fill(); ctx.stroke();
    }
    ctx.translate(0, -lift);
    // arms: [left, right], each an angle out from hanging straight down (0 down, π/2 out level, π up)
    const arms = o.arms || [0.3, 0.3];
    [[-1, arms[0]], [1, arms[1]]].forEach(([side, angle]) => {
      const sx = side * 23 * u, sy = -55 * u, hx = sx + side * Math.sin(angle) * 26 * u, hy = sy + Math.cos(angle) * 26 * u;
      ctx.strokeStyle = BOT.line; ctx.lineWidth = 7 * u; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = BOT.shade; ctx.lineWidth = 7 * u - 2 * lw; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy, 4.5 * u, 0, Math.PI * 2); ctx.fillStyle = BOT.body; ctx.fill(); ctx.strokeStyle = BOT.line; ctx.lineWidth = lw; ctx.stroke();
    });
    // body, with belly lights in forest green, white and grey-blue
    roundRect(-23 * u, -62 * u, 46 * u, 40 * u, 4 * u); ctx.fillStyle = BOT.body; ctx.fill(); ctx.stroke();
    roundRect(-14 * u, -54 * u, 28 * u, 16 * u, 2 * u); ctx.fillStyle = "#1A2C26"; ctx.fill(); ctx.stroke();
    BOT.lights.forEach((c, i) => { ctx.beginPath(); ctx.arc(-7 * u + i * 7 * u, -46 * u, 2.6 * u, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); });
    ctx.fillStyle = BOT.shade; ctx.fillRect(-18 * u, -33 * u, 36 * u, 4 * u);
    // neck and head, with ear bolts
    ctx.fillStyle = BOT.shade; ctx.fillRect(-6 * u, -68 * u, 12 * u, 6 * u); ctx.strokeRect(-6 * u, -68 * u, 12 * u, 6 * u);
    roundRect(-22 * u, -104 * u, 44 * u, 36 * u, 3 * u); ctx.fillStyle = BOT.body; ctx.fill(); ctx.stroke();
    for (const side of [-1, 1]) { const ex = side > 0 ? 22 * u : -26 * u; ctx.fillStyle = BOT.shade; ctx.fillRect(ex, -92 * u, 4 * u, 10 * u); ctx.strokeRect(ex, -92 * u, 4 * u, 10 * u); }
    // mouth: a flat line with a smirk turning up on the right
    ctx.strokeStyle = BOT.line; ctx.lineWidth = Math.max(1.2, 1.8 * u);
    ctx.beginPath(); ctx.moveTo(-9 * u, -75 * u); ctx.lineTo(5 * u, -75 * u); ctx.quadraticCurveTo(9 * u, -75 * u, 11 * u, -78.5 * u); ctx.stroke();
    // Waldo glasses: round black rims and a bridge; the eyes look where told and blink now and then
    const blink = Math.sin(T * 0.9 + 1) > 0.992 ? 0.15 : 1, look = o.look || [0, 0];
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.arc(side * 9 * u, -88 * u, 7.5 * u, 0, Math.PI * 2); ctx.fillStyle = BOT.white; ctx.fill();
      ctx.lineWidth = 2.6 * u; ctx.strokeStyle = BOT.rim; ctx.stroke();
      ctx.save(); ctx.translate(side * 9 * u + look[0] * 2.5 * u, -88 * u + look[1] * 2 * u); ctx.scale(1, blink);
      ctx.beginPath(); ctx.arc(0, 0, 2.6 * u, 0, Math.PI * 2); ctx.fillStyle = BOT.rim; ctx.fill(); ctx.restore();
    }
    ctx.lineWidth = 2.2 * u; ctx.beginPath(); ctx.moveTo(-1.8 * u, -89 * u); ctx.quadraticCurveTo(0, -91 * u, 1.8 * u, -89 * u); ctx.stroke();
    // Waldo hat: a red-and-white striped beanie worn tipped to the left, a red pompom ball on top
    ctx.save();
    ctx.translate(-3 * u, -102 * u); ctx.rotate(-0.22);
    const dome = () => { ctx.beginPath(); ctx.moveTo(-24 * u, 1 * u); ctx.bezierCurveTo(-26 * u, -20 * u, 18 * u, -27 * u, 24 * u, 1 * u); ctx.closePath(); };
    ctx.save(); dome(); ctx.clip();
    for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? BOT.white : BOT.red; ctx.fillRect(-30 * u, -(i + 1) * 4 * u + 1 * u, 60 * u, 4 * u); }
    ctx.restore();
    dome(); ctx.strokeStyle = BOT.line; ctx.lineWidth = lw; ctx.stroke();
    roundRect(-26 * u, -2 * u, 52 * u, 6 * u, 3 * u); ctx.fillStyle = BOT.red; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-3 * u, -22 * u, 5.5 * u, 0, Math.PI * 2); ctx.fillStyle = BOT.red; ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
    return { x: x + 6 * u, y: y - 96 * u - lift, u };
  }

  /** A speech bubble pointing at the bot's head; side "left" puts the bubble to the left. */
  function bubble(head, text, alpha, side = "right") {
    if (alpha <= 0) return;
    font(13.5 * U, 600);
    const maxW = (side === "up" ? 170 : 250) * U, words = text.split(" "), lines = [];
    let line = "";
    for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    lines.push(line);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 24 * U, h = lines.length * 18 * U + 18 * U;
    let bx = side === "left" ? head.x - w - 34 * U : side === "up" ? head.x - w / 2 : head.x + 30 * U, by = head.y - h - (side === "up" ? 30 : 14) * U;
    bx = clamp(bx, 8, W - w - 8); by = clamp(by, 8, H - h - 8);
    ctx.save(); ctx.globalAlpha = clamp(alpha);
    roundRect(bx, by, w, h, 12 * U); ctx.fillStyle = "#F7F3EC"; ctx.fill(); ctx.strokeStyle = "rgba(6,31,23,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    const tx = side === "left" ? bx + w - 18 * U : side === "up" ? clamp(head.x, bx + 18 * U, bx + w - 18 * U) : bx + 18 * U;
    ctx.beginPath(); ctx.moveTo(tx - 7 * U, by + h - 1); ctx.lineTo(head.x + (side === "left" ? -8 : side === "up" ? 0 : 8) * U, head.y - (side === "up" ? 12 * U : 0)); ctx.lineTo(tx + 7 * U, by + h - 1); ctx.closePath(); ctx.fillStyle = "#F7F3EC"; ctx.fill();
    ctx.fillStyle = "#0B2A21"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    lines.forEach((l, i) => ctx.fillText(l, bx + 12 * U, by + 22 * U + i * 18 * U));
    ctx.restore();
  }
  /** What the bot is saying now, and how visible it is. */
  function speech() {
    const { shot } = shotAt(T);
    const s = T - shot.start;
    for (const [a, b, text] of shot.say || []) if (s >= a && s <= b) return { text, alpha: Math.min(smooth((s - a) / 0.35), smooth((b - s) / 0.35)) };
    return null;
  }

  // ---- Intro: Step 0 and Step 0.2 --------------------------------------------------------
  const PACKAGES = ["duckdb", "numpy", "oracledb", "requests", "polars", "pandas", "PyYAML", "SQLAlchemy", "plotly", "pytest", "pyarrow", "scipy", "numba", "mlflow", "multiprocessing"];
  const DROP = 0.36;   // seconds between packages
  const LOGS = ["step1.log", "step2.log", "weather.log", "amperage.log", "cycles.log", "errors.log"];
  function drawIntro(alpha) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; layerAlpha = alpha;
    background();
    // Step 0: packages drop, one at a time, into the bot's crate
    const crate = { x: W * 0.64, y: H * 0.74, w: 380 * U };
    const installed = PACKAGES.filter((_, i) => local("0") > 3 + i * DROP + 0.5).length;
    const k0 = 1 - smooth((T - SHOT["0.2"].start - 0.2) / 0.8);
    if (k0 > 0) {
      ctx.save(); ctx.globalAlpha = A(k0);
      PACKAGES.forEach((name, i) => {
        const k = smooth((local("0") - 3 - i * DROP) / 0.5);
        if (k <= 0) return;
        const tx = crate.x - crate.w / 2 + 10 * U + (i % 4) * 91 * U, ty = crate.y - Math.floor(i / 4) * 24 * U;
        const y = lerp(-24 * U, ty, k);
        roundRect(tx, y - 18 * U, 87 * U, 20 * U, 3 * U); ctx.fillStyle = k >= 1 ? P.sand : P.gold; ctx.fill();
        font(9.5 * U, 600); ctx.fillStyle = "#072A20"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(name, tx + 43.5 * U, y - 8 * U);
      });
      ctx.strokeStyle = P.sand; ctx.lineWidth = 2 * U; ctx.strokeRect(crate.x - crate.w / 2, crate.y + 4 * U, crate.w, 30 * U);
      font(11 * U, 600); ctx.fillStyle = P.dim; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("requirements.txt", crate.x, crate.y + 52 * U);
      const bw = 260 * U, by = H * 0.2;
      roundRect(crate.x - bw / 2, by, bw, 8 * U, 4 * U); ctx.fillStyle = P.faint; ctx.fill();
      roundRect(crate.x - bw / 2, by, Math.max(8 * U, (bw * installed) / PACKAGES.length), 8 * U, 4 * U); ctx.fillStyle = P.mint; ctx.fill();
      font(12.5 * U, 600); ctx.fillStyle = P.text;
      ctx.fillText(installed === PACKAGES.length ? "Dependencies installed" : `Installing dependencies · ${installed} of ${PACKAGES.length}`, crate.x, by - 10 * U);
      if (installed === PACKAGES.length) check(crate.x - bw / 2 - 16 * U, by + 4 * U, 6 * U, ramp("0", 8.7, 9.3));
      ctx.restore();
    }
    // Step 0.2: last run's logs move, one at a time, into the archive
    if (after("0.2")) {
      const k = smooth((local("0.2") - 2.6) / 0.6);
      const win = { x: W * 0.47, y: H * 0.16, w: W * 0.26, h: H * 0.62 };
      const box = { x: W * 0.83, y: H * 0.6 };
      ctx.save(); ctx.globalAlpha = A(k);
      panel(win.x, win.y, win.w, win.h);
      font(11 * U, 600); ctx.fillStyle = P.gold; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("LOGS/", win.x + 14 * U, win.y + 24 * U);
      // the archive: a box with its lid, and what's gone into it
      ctx.strokeStyle = P.sand; ctx.lineWidth = 2 * U; ctx.fillStyle = "rgba(216,195,165,0.12)";
      roundRect(box.x - 52 * U, box.y - 26 * U, 104 * U, 62 * U, 4 * U); ctx.fill(); ctx.stroke();
      roundRect(box.x - 58 * U, box.y - 38 * U, 116 * U, 14 * U, 3 * U); ctx.fillStyle = P.sand; ctx.fill();
      ctx.fillStyle = P.screen; ctx.fillRect(box.x - 12 * U, box.y - 14 * U, 24 * U, 6 * U);
      font(10.5 * U, 600); ctx.fillStyle = P.dim; ctx.textAlign = "center";
      ctx.fillText("logs/archive/2024-06-02.zip", box.x, box.y + 54 * U);
      const archived = LOGS.filter((_, i) => local("0.2") > 3.6 + i * 0.8 + 0.7).length;
      font(13 * U, 600); ctx.fillStyle = P.text; ctx.fillText(`${archived} archived`, box.x, box.y + 10 * U);
      LOGS.forEach((name, i) => {
        const m = smooth((local("0.2") - 3.6 - i * 0.8) / 0.7);
        const sx = win.x + 14 * U, sy = win.y + 52 * U + i * 26 * U;
        if (m >= 1) return;
        const x = lerp(sx, box.x - 34 * U, m), y = lerp(sy, box.y - 18 * U, m) - Math.sin(m * Math.PI) * 50 * U;
        font(11.5 * U, 400, MONO); ctx.textAlign = "left"; ctx.fillStyle = m > 0 ? P.gold : P.dim;
        ctx.globalAlpha = A(k * (1 - smooth((m - 0.8) / 0.2)));
        ctx.fillText(m > 0 ? name : `2024-06-02  ${name}`, x, y);
        ctx.globalAlpha = A(k);
      });
      if (archived === LOGS.length) { font(13 * U, 600); ctx.fillStyle = P.text; ctx.textAlign = "left"; ctx.fillText("Logs archived", win.x + 40 * U, win.y + win.h / 2); check(win.x + 22 * U, win.y + win.h / 2 - 4 * U, 7 * U, ramp("0.2", 8.9, 9.5)); }
      ctx.restore();
    }
    const head = drawBot(W * 0.24, H * 0.86, H * 0.52, { look: [1, -0.4], talking: !!speech(), arms: [0.3, after("0.2") ? 0.5 : 0.3] });
    font(17 * U, 600, SERIF); ctx.fillStyle = P.text; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("The line risk bot", W * 0.24, Math.min(H - 8 * U, H * 0.86 + 26 * U));
    ctx.restore();
    layerAlpha = 1;
    return head;
  }

  function background() {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, P.bg[0]); g.addColorStop(0.55, P.bg[1]); g.addColorStop(1, P.bg[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---- Map: the lower 48, then Virginia -------------------------------------------------------
  function rings(list) {
    ctx.beginPath();
    for (const ring of list) ring.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
  }
  function drawMap(v) {
    if (!v || v.alpha <= 0) return;
    mapCam(v.cam);
    ctx.save(); ctx.globalAlpha = v.alpha; layerAlpha = v.alpha;
    background();
    ctx.lineJoin = "round";
    for (const [id, list] of Object.entries(STATES)) {
      if (id === "51") continue;
      rings(list); ctx.fillStyle = P.land; ctx.fill(); ctx.strokeStyle = P.landEdge; ctx.lineWidth = Math.max(0.6, 0.8 * U); ctx.stroke();
    }
    const focus = after("1") ? ramp("1", 7.4, 10.4) : 0;
    rings(VA_RINGS);
    ctx.fillStyle = P === DARK ? `rgba(229,169,60,${0.18 + 0.3 * focus})` : `rgba(242,193,78,${0.18 + 0.3 * focus})`; ctx.fill();
    ctx.strokeStyle = P.gold; ctx.lineWidth = (1.4 + 1.2 * focus) * U; ctx.stroke();
    font((12 + 10 * focus) * U, 600, SERIF); ctx.fillStyle = P.text; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("Virginia", X(SITE[0] - 26), Y(SITE[1] - 18));
    ctx.beginPath(); ctx.arc(X(SITE[0]), Y(SITE[1]), 3.5 * U, 0, Math.PI * 2); ctx.fillStyle = P.gold; ctx.fill();
    ctx.beginPath(); ctx.arc(X(SITE[0]), Y(SITE[1]), 8 * U, 0, Math.PI * 2); ctx.strokeStyle = P.gold; ctx.lineWidth = 1.5 * U; ctx.stroke();
    // Step 1's substeps, listed one at a time
    const k = active("1") ? span("1", 4.2) : 0;
    if (k > 0) {
      const rows = STEPS.filter((s) => /^1\.\d$/.test(s.id));
      const x = 18 * U, h = (34 + rows.length * 19) * U, y = H - h - 18 * U;
      panel(x, y, 300 * U, h, k);
      ctx.save(); ctx.globalAlpha = A(k);
      font(11 * U, 600); ctx.fillStyle = P.gold; ctx.textAlign = "left"; ctx.fillText("STEP 1 RUNS EVERY SUBSTEP", x + 12 * U, y + 22 * U);
      rows.forEach((s, i) => {
        ctx.globalAlpha = A(k * ramp("1", 4.4 + i * 0.32, 4.8 + i * 0.32));
        font(12 * U, 600); ctx.fillStyle = P.sand; ctx.fillText(s.id, x + 12 * U, y + (42 + i * 19) * U);
        font(12 * U); ctx.fillStyle = P.text; ctx.fillText(s.title, x + 46 * U, y + (42 + i * 19) * U);
      });
      ctx.restore();
    }
    ctx.restore();
    layerAlpha = 1;
  }

  // ---- Landscape ---------------------------------------------------------------------------------
  const conductorY = (x0, y0, x1, y1, x) => { const k = (x - x0) / (x1 - x0); return lerp(y0, y1, k) + 88 * k * (1 - k); };
  const SPANS = (function () {
    const pts = [[GANTRY.A, -88], ...TOWERS.map((x) => [x, ATTACH]), [GANTRY.B, -88]];
    return pts.slice(0, -1).map((a, i) => [a, pts[i + 1]]);
  })();
  const CLOUD = new Path2D("M0 22 a12 12 0 0 1 14 -12 a16 16 0 0 1 30 -2 a13 13 0 0 1 22 8 a10 10 0 0 1 2 20 h-62 a10 10 0 0 1 -6 -14z");

  function drawLand(v) {
    if (!v || v.alpha <= 0) return;
    landCam(v.cam);
    ctx.save(); ctx.globalAlpha = v.alpha; layerAlpha = v.alpha;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, P.skyTop); sky.addColorStop(1, P.skyBottom);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    drawSun();
    drawWeather();
    hills(-1400, 3200);
    drawStation();
    drawSubstation(0, "A");
    drawSubstation(1840, "B");
    drawLine();
    drawDesk();
    landOverlays();
    ctx.restore();
    layerAlpha = 1;
  }

  const SUN = () => ({ x: W * 0.58 - (cam.x - 1000) * cam.s * 0.015, y: H * 0.14 });
  function drawSun() {
    const k = 1 - smooth((cam.x - 1900) / 300);   // the sun sets behind the workstation
    if (k <= 0) return;
    const { x, y } = SUN();
    ctx.save(); ctx.globalAlpha = A(k);
    ctx.beginPath(); ctx.arc(x, y, 16 * U, 0, Math.PI * 2); ctx.fillStyle = P.gold; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 25 * U, 0, Math.PI * 2); ctx.strokeStyle = "rgba(242,193,78,0.35)"; ctx.lineWidth = 3 * U; ctx.stroke();
    ctx.restore();
  }

  /** Step 1.5's weather, one effect at a time: sun rays, then clouds, then wind. */
  function drawWeather() {
    if (!active("1.5")) return;
    const s = local("1.5");
    // sunlight: rays from the sun to the dome that measures it
    const rays = Math.min(smooth((s - 6) / 0.8), smooth((10.6 - s) / 0.8));
    if (rays > 0) {
      const sun = SUN(), dome = { x: X(STATION.dome), y: Y(-74) };
      ctx.save(); ctx.globalAlpha = A(rays); ctx.strokeStyle = "rgba(242,193,78,0.75)"; ctx.lineWidth = 2.2 * U; ctx.setLineDash([10 * U, 9 * U]); ctx.lineDashOffset = -T * 40 * U;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(sun.x + i * 10 * U, sun.y + 24 * U); ctx.lineTo(dome.x + i * 26 * U, dome.y); ctx.stroke(); }
      ctx.restore();
    }
    // sky: clouds slide in from both sides for industrial air, then clear
    const clouds = Math.min(smooth((s - 11.6) / 1.4), smooth((16.2 - s) / 1.0));
    if (clouds > 0) {
      ctx.save(); ctx.globalAlpha = A(0.92 * clouds);
      [[0.08, 0.08, 1.8, 0], [0.3, 0.3, 1.3, 1], [0.66, 0.1, 1.75, 0], [0.82, 0.32, 1.25, 1]].forEach(([fx, fy, sc, shade], i) => {
        const fromLeft = i < 2, off = (1 - clouds) * W * 0.5 * (fromLeft ? -1 : 1);
        const drift = Math.sin(T * 0.6 + i) * 4 * U;
        ctx.save(); ctx.translate(fx * W + off + drift, fy * H); ctx.scale(sc * U, sc * U); ctx.fillStyle = P.cloud[shade]; ctx.fill(CLOUD); ctx.restore();
      });
      ctx.fillStyle = `rgba(138,143,140,${0.14 * clouds})`; ctx.fillRect(0, 0, W, H);   // industrial haze
      ctx.restore();
    }
    // wind: streaks blow across, left to right
    const wind = Math.min(smooth((s - 16.8) / 0.8), smooth((20.8 - s) / 0.8));
    if (wind > 0) {
      ctx.save(); ctx.globalAlpha = A(wind); ctx.strokeStyle = "rgba(243,238,230,0.85)"; ctx.lineWidth = 2.6 * U; ctx.lineCap = "round";
      [0.2, 0.28, 0.37, 0.45, 0.53, 0.61, 0.69].forEach((fy, i) => {
        const len = [70, 46, 84, 52, 66, 40, 74][i] * U, x = ((T * 300 * U + i * 173 * U) % (W + 160 * U)) - 80 * U;
        ctx.beginPath(); ctx.moveTo(x, fy * H); ctx.lineTo(x + len, fy * H); ctx.stroke();
      });
      ctx.restore();
    }
  }

  function hills(x0, x1) {
    const layer = (amp, base, freq, color, phase) => {
      ctx.beginPath(); ctx.moveTo(X(x0), H + 10);
      for (let x = x0; x <= x1; x += 20) ctx.lineTo(X(x), Y(base - amp * (0.5 + 0.5 * Math.sin(x * freq + phase)) - amp * 0.4 * Math.sin(x * freq * 2.3 + phase * 2)));
      ctx.lineTo(X(x1), H + 10); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    layer(70, -10, 0.004, P.hillFar, 1.2);
    layer(36, 0, 0.007, P.hillNear, 0.3);
    ctx.fillStyle = P.ground; ctx.fillRect(0, Y(0), W, H - Y(0) + 2);
    ctx.strokeStyle = P.faint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke();
  }

  function tower(x, glow = 0) {
    ctx.strokeStyle = glow > 0 ? mix(P.steel, P.gold, glow) : P.steel; ctx.lineWidth = Math.max(1, L(2.6));
    ctx.beginPath();
    ctx.moveTo(X(x - 22), Y(0)); ctx.lineTo(X(x - 5), Y(-130)); ctx.lineTo(X(x + 5), Y(-130)); ctx.lineTo(X(x + 22), Y(0));
    for (const h of [-30, -62, -94]) { const w = 22 * (1 + h / 150); ctx.moveTo(X(x - w), Y(h)); ctx.lineTo(X(x + w), Y(h)); }
    ctx.moveTo(X(x - 19), Y(-10)); ctx.lineTo(X(x + 13), Y(-62)); ctx.moveTo(X(x + 19), Y(-10)); ctx.lineTo(X(x - 13), Y(-62));
    ctx.moveTo(X(x - 30), Y(-112)); ctx.lineTo(X(x + 30), Y(-112));
    ctx.moveTo(X(x - 30), Y(-112)); ctx.lineTo(X(x - 5), Y(-124)); ctx.moveTo(X(x + 30), Y(-112)); ctx.lineTo(X(x + 5), Y(-124));
    ctx.stroke();
  }

  const spanPath = (a, y0, b, y1, x0 = a, x1 = b) => {
    ctx.beginPath();
    const n = 18;
    for (let s = 0; s <= n; s++) { const x = lerp(x0, x1, s / n); const y = conductorY(a, y0, b, y1, x); s ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
  };
  const ends = ([x0], [x1], off) => [x0 + (x0 === GANTRY.A ? 0 : off), x1 + (x1 === GANTRY.B ? 0 : off)];

  function drawLine() {
    TOWERS.forEach((x, i) => tower(x, active("1.2") ? ramp("1.2", 5.2 + i * 0.35, 5.5 + i * 0.35) * (1 - ramp("1.2", 10, 10.8)) : 0));
    for (const gx of [GANTRY.A, GANTRY.B]) {   // gantries at the substations
      ctx.strokeStyle = P.steel; ctx.lineWidth = Math.max(1, L(2.4)); ctx.beginPath();
      ctx.moveTo(X(gx - 14), Y(0)); ctx.lineTo(X(gx - 14), Y(-92)); ctx.moveTo(X(gx + 14), Y(0)); ctx.lineTo(X(gx + 14), Y(-92)); ctx.moveTo(X(gx - 20), Y(-88)); ctx.lineTo(X(gx + 20), Y(-88));
      ctx.stroke();
    }
    ctx.strokeStyle = P.sand; ctx.lineWidth = Math.max(1.2, L(2.2)); ctx.lineCap = "round";
    for (const off of [-30, 30]) SPANS.forEach(([p0, p1]) => { const [a, b] = ends(p0, p1, off); spanPath(a, p0[1], b, p1[1]); ctx.stroke(); });
    // Step 1.1: a pulse of light runs along one conductor as its metadata comes in
    const pulse = active("1.1") ? (local("1.1") - 6.6) / 2.6 : -1;
    if (pulse > 0 && pulse < 1) {
      const head = lerp(400, 1350, smooth(pulse));
      ctx.save(); ctx.shadowColor = P.gold; ctx.shadowBlur = 12 * U; ctx.strokeStyle = P.gold; ctx.lineWidth = Math.max(2, L(3.4));
      SPANS.forEach(([p0, p1]) => {
        const [a, b] = ends(p0, p1, 30), lo = Math.max(a, head - 120), hi = Math.min(b, head + 20);
        if (hi <= lo) return;
        spanPath(a, p0[1], b, p1[1], lo, hi); ctx.stroke();
      });
      ctx.restore();
    }
  }

  function substationGlow(name) {
    return DATA.chosen === name && active("1.7") ? ramp("1.7", 7, 7.8) : DATA.chosen === name && active("1.7b") ? 1 - ramp("1.7b", 6.5, 8) : 0;
  }
  function drawSubstation(x0, name) {
    const glow = substationGlow(name);
    ctx.save();
    if (glow > 0) { ctx.shadowColor = P.gold; ctx.shadowBlur = 24 * U * glow; }
    ctx.strokeStyle = glow > 0 ? mix(P.steel, P.gold, glow) : P.steel; ctx.lineWidth = Math.max(1, L(1.4));
    ctx.strokeRect(X(x0), Y(-48), L(160), L(48));
    ctx.globalAlpha = A(0.45); ctx.beginPath();
    for (let x = x0; x <= x0 + 160; x += 10) { ctx.moveTo(X(x), Y(-48)); ctx.lineTo(X(x), Y(0)); }
    ctx.stroke();
    ctx.restore();
    for (const tx of [x0 + 30, x0 + 82]) {   // transformers with cooling fins and bushings
      ctx.fillStyle = "#5E6E66"; ctx.fillRect(X(tx), Y(-34), L(32), L(30));
      ctx.strokeStyle = P.steel; ctx.lineWidth = Math.max(1, L(1)); ctx.strokeRect(X(tx), Y(-34), L(32), L(30));
      for (let f = 0; f < 4; f++) { ctx.beginPath(); ctx.moveTo(X(tx + 5 + f * 7), Y(-30)); ctx.lineTo(X(tx + 5 + f * 7), Y(-8)); ctx.stroke(); }
      for (const b of [8, 16, 24]) { ctx.fillStyle = P.sand; ctx.fillRect(X(tx + b - 1.5), Y(-46), L(3), L(12)); }
    }
    ctx.fillStyle = "#3D5249"; ctx.fillRect(X(x0 + 124), Y(-26), L(30), L(26)); ctx.fillStyle = P.gold; ctx.fillRect(X(x0 + 132), Y(-18), L(8), L(6));
  }

  function drawStation() {
    // the white dome: sunlight and sky conditions
    const d = STATION.dome;
    ctx.fillStyle = "#E9ECEA"; ctx.fillRect(X(d - 46), Y(-30), L(92), L(30));
    ctx.beginPath(); ctx.arc(X(d), Y(-30), L(44), Math.PI, 0); ctx.fillStyle = "#F4F6F5"; ctx.fill();
    ctx.strokeStyle = "#AEB9B3"; ctx.lineWidth = Math.max(1, L(1.2)); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(d - 14), Y(-52), L(9), Math.PI * 1.1, Math.PI * 1.6); ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = Math.max(1, L(2)); ctx.stroke();
    ctx.fillStyle = "#7E8C85"; ctx.fillRect(X(d - 8), Y(-18), L(16), L(18));
    // radar: a lattice mast and a dish that keeps turning
    const r = STATION.radar;
    ctx.strokeStyle = P.steel; ctx.lineWidth = Math.max(1, L(2)); ctx.beginPath();
    ctx.moveTo(X(r - 14), Y(0)); ctx.lineTo(X(r - 6), Y(-96)); ctx.moveTo(X(r + 14), Y(0)); ctx.lineTo(X(r + 6), Y(-96));
    for (const h of [-24, -48, -72]) { ctx.moveTo(X(r - 14 + 8 * (-h / 96)), Y(h)); ctx.lineTo(X(r + 14 - 8 * (-h / 96)), Y(h)); }
    ctx.stroke();
    const spin = Math.cos(T * 1.2);
    ctx.save(); ctx.translate(X(r), Y(-108));
    ctx.beginPath(); ctx.ellipse(0, 0, L(26) * Math.max(0.12, Math.abs(spin)), L(20), 0.25, 0, Math.PI * 2);
    ctx.fillStyle = spin > 0 ? "#EEF1EF" : "#C7CFCA"; ctx.fill(); ctx.strokeStyle = "#AEB9B3"; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L(16) * spin, L(-6)); ctx.strokeStyle = P.steel; ctx.lineWidth = Math.max(1, L(1.6)); ctx.stroke();
    ctx.restore();
    // windsock: fills out while the wind blows in Step 1.5
    const s = STATION.sock, blow = active("1.5") ? Math.min(smooth((local("1.5") - 16.8) / 1), smooth((21 - local("1.5")) / 1)) : 0;
    ctx.strokeStyle = P.steel; ctx.lineWidth = Math.max(1, L(2)); ctx.beginPath(); ctx.moveTo(X(s), Y(0)); ctx.lineTo(X(s), Y(-84)); ctx.stroke();
    // the cone: its angle below level eases from hanging (calm) to straight out (blowing); its shape never changes
    const angle = lerp(0.62, 0.04, blow) + Math.sin(T * (2.2 + 4 * blow)) * (0.03 + 0.05 * blow);
    const dir = [Math.cos(angle), Math.sin(angle)], nrm = [-Math.sin(angle), Math.cos(angle)], len = 46, r0 = 8, r1 = 3.4, ax = s, ay = -82;
    for (let i = 0; i < 5; i++) {
      const t0 = i / 5, t1 = (i + 1) / 5, q0 = lerp(r0, r1, t0), q1 = lerp(r0, r1, t1);
      const p0 = [ax + dir[0] * len * t0, ay + dir[1] * len * t0], p1 = [ax + dir[0] * len * t1, ay + dir[1] * len * t1];
      ctx.beginPath();
      ctx.moveTo(X(p0[0] + nrm[0] * q0), Y(p0[1] + nrm[1] * q0)); ctx.lineTo(X(p1[0] + nrm[0] * q1), Y(p1[1] + nrm[1] * q1));
      ctx.lineTo(X(p1[0] - nrm[0] * q1), Y(p1[1] - nrm[1] * q1)); ctx.lineTo(X(p0[0] - nrm[0] * q0), Y(p0[1] - nrm[1] * q0)); ctx.closePath();
      ctx.fillStyle = i % 2 ? "#F5F2EC" : "#E07A3E"; ctx.fill();
    }
    // anemometer: cups spin on their mast
    const m = STATION.mast;
    ctx.strokeStyle = P.steel; ctx.beginPath(); ctx.moveTo(X(m), Y(0)); ctx.lineTo(X(m), Y(-74)); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = T * (6 + 6 * blow) + (i * 2 * Math.PI) / 3, cx = m + Math.cos(a) * 12, cy = -76 + Math.sin(a) * 2.5;
      ctx.beginPath(); ctx.moveTo(X(m), Y(-76)); ctx.lineTo(X(cx), Y(cy)); ctx.stroke();
      ctx.beginPath(); ctx.arc(X(cx), Y(cy), Math.max(1.5, L(3)), 0, Math.PI * 2); ctx.fillStyle = P.sand; ctx.fill();
    }
  }

  function drawDesk() {
    ctx.fillStyle = P.desk; ctx.fillRect(X(DESK.x + 40), Y(-44), L(440), L(8));
    ctx.fillStyle = P.leg; ctx.fillRect(X(DESK.x + 60), Y(-36), L(10), L(36)); ctx.fillRect(X(DESK.x + 450), Y(-36), L(10), L(36));
    roundRect(X(SCREEN.x - 8), Y(SCREEN.y - 8), L(SCREEN.w + 16), L(SCREEN.h + 16), L(6)); ctx.fillStyle = P.frame; ctx.fill(); ctx.strokeStyle = P.panelEdge; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = P.screen; ctx.fillRect(X(SCREEN.x), Y(SCREEN.y), L(SCREEN.w), L(SCREEN.h));
    drawDB();
    screenContent();
  }

  function drawDB() {
    const fill = after("1.8") ? ramp("1.8", 10, 12.6) : 0;
    const top = -78, h = 68, cx = X(DB.x), rx = L(34), ry = L(8);
    ctx.fillStyle = P.frame; ctx.fillRect(cx - rx, Y(top), rx * 2, L(h));
    ctx.save(); ctx.globalAlpha = A(0.55); ctx.fillStyle = P.mint; ctx.fillRect(cx - rx, Y(top + h - h * fill), rx * 2, L(h * fill)); ctx.restore();
    ctx.strokeStyle = P.sand; ctx.lineWidth = Math.max(1, L(1.4));
    ctx.beginPath(); ctx.ellipse(cx, Y(top), rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = P.leg; ctx.fill(); ctx.stroke();
    for (const yy of [top + h / 3, top + (2 * h) / 3, top + h]) { ctx.beginPath(); ctx.ellipse(cx, Y(yy), rx, ry, 0, 0, Math.PI); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - rx, Y(top)); ctx.lineTo(cx - rx, Y(top + h)); ctx.moveTo(cx + rx, Y(top)); ctx.lineTo(cx + rx, Y(top + h)); ctx.stroke();
    font(Math.max(6, L(9)), 600); ctx.fillStyle = P.dim; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("database", cx, Y(top - 14));
    if (active("1.8")) {   // Step 1.8: the four kinds of metadata go in, one at a time
      ["conductors", "structures", "weather", "amperage"].forEach((name, i) => {
        const k = ramp("1.8", 10 + i * 0.6, 10.7 + i * 0.6);
        if (k <= 0 || k >= 1) return;
        const sx = lerp(DESK.x - 160, DB.x, k), sy = lerp(-150, top - 6, k) - Math.sin(k * Math.PI) * 50;
        tag(name, X(sx), Y(sy), 1, P.sand, 9.5);
      });
    }
  }

  // ---- What the LRP3 calculator's screen shows, step by step ------------------------------------
  /** A screen panel's opacity: in after the step's title card, out at the end of its shot. */
  const screenAlpha = (key) => (active(key) ? Math.min(ramp(key, 2.5, 3.1), 1 - ramp(key, SHOT[key].dur - 0.6, SHOT[key].dur)) : 0);
  function screenContent() {
    const sx = X(SCREEN.x), sy = Y(SCREEN.y), sw = L(SCREEN.w), sh = L(SCREEN.h), u = cam.s;
    const f = (v) => Math.max(6, v * u), pad = 14 * u;
    const mono = (size) => font(f(size), 400, MONO);
    ctx.save();
    ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
    const header = (title, color = P.gold) => { font(f(10), 600); ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(title, sx + pad, sy + pad + 6 * u); };
    const show = (key, draw) => { const k = screenAlpha(key); if (k <= 0) return; ctx.save(); layerAlpha *= k; ctx.globalAlpha = A(1); draw(local(key)); layerAlpha /= k; ctx.restore(); };

    show("2", (s) => {
      header("BATCH SCRIPTS (.dist) · OVERRIDDEN FROM THE CONFIGS (.yaml)");
      const rows = [["pipeline.yaml", "step1_batch.dist", "--station noaa --substations 2"], ["temperatures.yaml", "step2_batch.dist", "--start 2020-01-01 --end 2024-12-31"],
        ["thermal_cycles.yaml", "cycles_batch.dist", "--threshold 35 --stitch historian"]];
      rows.forEach(([cfg, dist, args], i) => {
        const y = sy + pad + (40 + i * 52) * u, k = smooth((s - 3.2 - i * 1.1) / 0.8);
        mono(9); ctx.fillStyle = P.mint; ctx.textAlign = "left"; ctx.fillText(cfg, sx + pad, y);
        const a0 = sx + pad + 112 * u, a1 = a0 + 26 * u;
        ctx.strokeStyle = P.faint; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a0, y - 3 * u); ctx.lineTo(lerp(a0, a1, k), y - 3 * u); ctx.stroke();
        if (k > 0) { ctx.fillStyle = P.gold; ctx.beginPath(); const ax = lerp(a0, a1, k); ctx.moveTo(ax, y - 3 * u); ctx.lineTo(ax - 5 * u, y - 7 * u); ctx.lineTo(ax - 5 * u, y + 1 * u); ctx.fill(); }
        ctx.fillStyle = P.text; ctx.fillText(dist, a1 + 10 * u, y);
        mono(8); ctx.globalAlpha = A(0.35 + 0.65 * k); ctx.fillStyle = k > 0.5 ? P.sand : P.faint; ctx.fillText(k > 0.5 ? args : "--defaults", a1 + 10 * u, y + 15 * u); ctx.globalAlpha = A(1);
      });
    });
    show("2.0", (s) => {
      header("FLIGHT CHECK · DATE RANGES");
      const rows = [["Conductor metadata", "2020-01-01 → 2024-12-31"], ["Structure metadata", "2020-01-01 → 2024-12-31"], ["Weather (NOAA)", "2020-01-01 → 2024-12-31"],
        ["Amperage (Substation A)", "2020-01-01 → 2024-12-31"], ["Ranges overlap", "ready for Step 2"]];
      rows.forEach(([label, range], i) => {
        const y = sy + pad + (36 + i * 33) * u, k = smooth((s - 3.2 - i * 0.9) / 0.6);
        ctx.globalAlpha = A(0.3 + 0.7 * k);
        font(f(10), 600); ctx.fillStyle = P.text; ctx.textAlign = "left"; ctx.fillText(label, sx + pad + 22 * u, y);
        mono(9); ctx.fillStyle = P.dim; ctx.fillText(range, sx + pad + 190 * u, y);
        ctx.globalAlpha = A(1);
        check(sx + pad + 7 * u, y - 4 * u, 5 * u, k);
      });
    });
    const COLS = ["conductor_id", "timestamp", "T_air", "I", "T_c"], WIDTHS = [0.19, 0.33, 0.15, 0.15, 0.18];
    const table = (s, building) => {
      const tx = sx + pad, ty = sy + pad + 24 * u, tw = sw - pad * 2, rh = 18 * u;
      const colX = (i) => tx + tw * WIDTHS.slice(0, i).reduce((a, b) => a + b, 0);
      ctx.strokeStyle = P.faint; ctx.lineWidth = 1;
      COLS.forEach((c, i) => {
        const k = building ? smooth((s - 3.2 - i * 0.5) / 0.4) : 1;
        if (k <= 0) return;
        ctx.globalAlpha = A(k);
        font(f(8.5), 600); ctx.fillStyle = P.sand; ctx.textAlign = "left"; ctx.fillText(c, colX(i) + 4 * u, ty + 12 * u);
        ctx.strokeRect(colX(i), ty, tw * WIDTHS[i], rh * 8);
        ctx.beginPath(); ctx.moveTo(colX(i), ty + rh); ctx.lineTo(colX(i) + tw * WIDTHS[i], ty + rh); ctx.stroke();
        ctx.globalAlpha = A(1);
      });
      return { rh, ty, colX };
    };
    show("2.1", (s) => {
      header("TEMPERATURE DATA · CLEAR THE OLD ROWS");
      const { rh, ty, colX } = table(s, false);
      for (let r = 0; r < 7; r++) {
        const gone = smooth((s - 3.2 - r * 0.5) / 0.4);
        if (gone >= 1) continue;
        ctx.globalAlpha = A(1 - gone);
        mono(8.5); ctx.fillStyle = P.dim; ctx.textAlign = "left";
        ["DRK-0412", `2019-12-31 ${String(r + 10)}:00`, "24.1", "612", "48.3"].forEach((v, i) => ctx.fillText(v, colX(i) + 4 * u + gone * 30 * u, ty + rh * (r + 2) - 5 * u));
        ctx.globalAlpha = A(1);
      }
    });
    show("2.2", (s) => {
      header("TEMPERATURE TABLES · CREATE IF NEEDED");
      table(s, true);
      tag("tables ready", sx + sw / 2, sy + sh - 16 * u, smooth((s - 6) / 0.5), P.mint, 9);
    });
    for (const key of ["2.3", "2.5", "2.6", "6"]) {
      show(key, (s) => {
        header({ "2.3": "CONDUCTOR TEMPERATURE · IEEE 738 HEAT BALANCE", "2.5": "HISTORIAN · THERMAL CYCLE STITCHING", "2.6": "THERMAL CYCLES · ±35 °C EVENTS", "6": "TEMPERATURE RESULTS · OPTIONAL VALIDATION" }[key], key === "6" ? P.mint : P.gold);
        chart(key, s, sx + pad, sy + pad + 18 * u, sw - pad * 2, sh - pad * 2 - 18 * u, u);
      });
    }
    show("2.4", (s) => {
      header("THERMAL CYCLE TABLES · DROP AND RECREATE");
      ["thermal_cycle_detail", "thermal_cycle_summary"].forEach((name, i) => {
        const drop = smooth((s - 3 - i * 0.6) / 0.7), rebuild = smooth((s - 5 - i * 0.8) / 0.8);
        const x = sx + pad + i * (sw / 2), y = sy + pad + 36 * u, w = sw / 2 - pad * 1.5, h = 110 * u;
        ctx.save();
        ctx.globalAlpha = A(rebuild > 0 ? rebuild : 1 - drop);
        ctx.translate(0, rebuild > 0 ? 0 : drop * 30 * u);
        ctx.strokeStyle = rebuild > 0 ? P.mint : P.hot; ctx.lineWidth = 1.2;
        ctx.strokeRect(x, y, w, h);
        for (let r = 1; r < 5; r++) { ctx.beginPath(); ctx.moveTo(x, y + (h / 5) * r); ctx.lineTo(x + w * (rebuild > 0 ? rebuild : 1), y + (h / 5) * r); ctx.stroke(); }
        font(f(9), 600); ctx.fillStyle = P.text; ctx.textAlign = "left"; ctx.fillText(name, x + 6 * u, y - 6 * u);
        ctx.restore();
      });
    });
    show("4", (s) => {
      header("CSV EXPORT · OPTIONAL VALIDATION", P.mint);
      ["conductor_temperatures.csv", "thermal_cycle_detail.csv", "thermal_cycle_summary.csv"].forEach((name, i) => {
        const k = smooth((s - 3 - i * 0.8) / 0.6), x = sx + pad + i * 118 * u, y = sy + 52 * u;
        ctx.globalAlpha = A(k);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 62 * u, y); ctx.lineTo(x + 78 * u, y + 16 * u); ctx.lineTo(x + 78 * u, y + 96 * u); ctx.lineTo(x, y + 96 * u); ctx.closePath();
        ctx.strokeStyle = P.sand; ctx.lineWidth = 1.4; ctx.stroke();
        font(f(13), 600); ctx.fillStyle = P.mint; ctx.textAlign = "left"; ctx.fillText("CSV", x + 18 * u, y + 56 * u);
        font(f(7.5)); ctx.fillStyle = P.dim; ctx.fillText(name, x, y + 112 * u);
        ctx.globalAlpha = A(1);
      });
    });
    show("5", (s) => {
      header("DIST AND CONFIG FILES · OPTIONAL CONFIGURATION", P.mint);
      const files = ["step1_batch.dist", "step2_batch.dist", "cycles_batch.dist", "pipeline.yaml", "weather.yaml", "substations.yaml", "temperatures.yaml", "thermal_cycles.yaml"];
      files.forEach((file, i) => {
        const col = i < 3 ? 0 : 1, row = i < 3 ? i : i - 3;
        const x = sx + pad + col * (sw / 2), y = sy + pad + (38 + row * 28) * u, k = smooth((s - 3 - i * 0.55) / 0.5);
        mono(9); ctx.fillStyle = P.text; ctx.textAlign = "left"; ctx.fillText(file, x + 16 * u, y);
        check(x + 5 * u, y - 3 * u, 4.5 * u, k);
      });
    });
    show("7", (s) => {
      header("RESOURCE METRICS · OPTIONAL VALIDATION", P.mint);
      const bars = [["Step 1", 0.34, "6 min"], ["Step 2.3", 0.92, "41 min"], ["Step 2.6", 0.48, "12 min"], ["Memory", 0.62, "11.8 GB"], ["CPU", 0.78, "78%"]];
      bars.forEach(([label, v, text], i) => {
        const y = sy + pad + (40 + i * 30) * u, k = smooth((s - 3 - i * 0.7) / 0.7), bw = sw - pad * 2 - 140 * u;
        font(f(9.5), 600); ctx.fillStyle = P.text; ctx.textAlign = "left"; ctx.fillText(label, sx + pad, y);
        roundRect(sx + pad + 70 * u, y - 10 * u, bw, 12 * u, 6 * u); ctx.fillStyle = P.faint; ctx.fill();
        if (k > 0) { roundRect(sx + pad + 70 * u, y - 10 * u, bw * v * k, 12 * u, 6 * u); ctx.fillStyle = i < 3 ? P.gold : P.mint; ctx.fill(); }
        mono(9); ctx.fillStyle = P.dim; ctx.fillText(text, sx + sw - pad - 60 * u, y);
      });
    });
    ctx.restore();
  }

  /** The run's conductor temperatures; the trace, events, cycles and stitching appear with their steps. */
  function chart(key, s, x, y, w, h, u) {
    const temps = DATA.temps, n = temps.length;
    const px = (i) => x + 26 * u + (i / (n - 1)) * (w - 30 * u);
    const py = (v) => y + h - 14 * u - (v / 120) * (h - 22 * u);
    const at = (fi) => { const i = Math.min(n - 2, Math.floor(fi)), k = fi - i; return lerp(temps[i], temps[i + 1], k); };
    ctx.strokeStyle = P.faint; ctx.lineWidth = 1; font(Math.max(6, 8 * u)); ctx.fillStyle = P.dim; ctx.textAlign = "right";
    for (let v = 0; v <= 120; v += 40) { ctx.beginPath(); ctx.moveTo(x + 26 * u, py(v)); ctx.lineTo(x + w, py(v)); ctx.stroke(); ctx.fillText(`${v}°`, x + 22 * u, py(v) + 3 * u); }
    ctx.textAlign = "left";
    // Step 2.3 draws the trace smoothly, between hours as well as at them
    const reach = key === "2.3" ? (n - 1) * clamp((s - 3.2) / 9.6) : n - 1;
    const whole = Math.floor(reach);
    const heat = (v) => { const k = clamp((v - 20) / 80); return k < 0.5 ? mix(P.mint, P.sand, k * 2) : mix(P.sand, P.hot, (k - 0.5) * 2); };
    ctx.lineWidth = Math.max(1.4, 2 * u); ctx.lineCap = "round";
    for (let i = 1; i <= whole; i++) { ctx.strokeStyle = heat(temps[i]); ctx.beginPath(); ctx.moveTo(px(i - 1), py(temps[i - 1])); ctx.lineTo(px(i), py(temps[i])); ctx.stroke(); }
    if (reach > whole) { const v = at(reach); ctx.strokeStyle = heat(v); ctx.beginPath(); ctx.moveTo(px(whole), py(temps[whole])); ctx.lineTo(px(reach), py(v)); ctx.stroke(); }
    if (key === "2.3" && s > 3.2) {
      const v = at(reach), i = Math.round(reach);
      ctx.beginPath(); ctx.arc(px(reach), py(v), 3.5 * u, 0, Math.PI * 2); ctx.fillStyle = P.gold; ctx.fill();
      font(Math.max(7, 10 * u), 600, SERIF); ctx.fillStyle = P.text; ctx.fillText("q_c + q_r = q_s + I²R(T_c)", x + 34 * u, y + 14 * u);
      font(Math.max(6, 8.5 * u)); ctx.fillStyle = P.dim;
      ctx.fillText(`hour ${i}:  T_air ${DATA.air[i].toFixed(0)} °C   I ${DATA.amp.A[i].toFixed(0)} A   wind ${DATA.wind[i].toFixed(1)} m/s   →   T_c ${v.toFixed(0)} °C`, x + 34 * u, y + 28 * u);
    }
    // Step 2.5: the historian's open half cycle stitches onto the start of this run (kept in 2.6)
    const stitch = key === "2.5" ? smooth((s - 4) / 2) : key === "2.6" ? 1 : 0;
    if (key === "2.5") {
      const k = smooth((s - 3) / 0.6);
      ctx.save(); ctx.globalAlpha = A(k);
      roundRect(x + 40 * u, y + 4 * u, 150 * u, 36 * u, 5 * u); ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fill(); ctx.strokeStyle = P.panelEdge; ctx.stroke();
      font(Math.max(6, 8.5 * u), 600); ctx.fillStyle = P.gold; ctx.fillText("historian", x + 48 * u, y + 17 * u);
      font(Math.max(6, 8 * u)); ctx.fillStyle = P.dim; ctx.fillText(`open half cycle · up event · ${DATA.carryIn[1]} °C`, x + 48 * u, y + 31 * u);
      ctx.restore();
    }
    if (stitch > 0) {
      const hx = x + 26 * u;
      ctx.save(); ctx.globalAlpha = A(1); ctx.setLineDash([4 * u, 4 * u]); ctx.strokeStyle = P.gold; ctx.lineWidth = 1.6 * u;
      ctx.beginPath();
      for (let k = 0; k <= 20 * stitch; k++) { const t = k / 20, xx = lerp(hx - 26 * u, hx, t), vv = lerp(30, temps[0], Math.sin(t * Math.PI / 2)); k ? ctx.lineTo(xx, py(vv)) : ctx.moveTo(xx, py(vv)); }
      ctx.stroke(); ctx.restore();
    }
    // Step 2.6: up and down events of 35 °C, one at a time, and the cycles they make
    if (key === "2.6") {
      const shown = DATA.events.filter((e, i) => s > 3 + i * 1.3);
      const first = DATA.events[0], last = DATA.events[DATA.events.length - 1];
      if (first && first.kind === "down" && shown.includes(first)) { ctx.fillStyle = "rgba(242,193,78,0.10)"; ctx.fillRect(x + 26 * u, y + 4 * u, px(first.index) - x - 26 * u, h - 18 * u); }
      DATA.cycles.forEach(([up, down]) => { if (shown.includes(down)) { ctx.fillStyle = "rgba(242,193,78,0.10)"; ctx.fillRect(px(up.index), y + 4 * u, px(down.index) - px(up.index), h - 18 * u); } });
      shown.forEach((e, i) => {
        const k = smooth((s - 3 - i * 1.3) / 0.5), ex = px(e.index), ey = py(e.to), fy = py(e.from);
        ctx.save(); ctx.globalAlpha = A(k);
        ctx.strokeStyle = e.kind === "up" ? P.mint : P.gold; ctx.lineWidth = 1.4 * u; ctx.setLineDash([3 * u, 3 * u]);
        ctx.beginPath(); ctx.moveTo(ex, fy); ctx.lineTo(ex, lerp(fy, ey, k)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = e.kind === "up" ? P.mint : P.gold; ctx.beginPath();
        if (e.kind === "up") { ctx.moveTo(ex, ey - 6 * u); ctx.lineTo(ex - 5 * u, ey + 3 * u); ctx.lineTo(ex + 5 * u, ey + 3 * u); }
        else { ctx.moveTo(ex, ey + 6 * u); ctx.lineTo(ex - 5 * u, ey - 3 * u); ctx.lineTo(ex + 5 * u, ey - 3 * u); }
        ctx.fill();
        font(Math.max(6, 7.5 * u), 600); ctx.textAlign = "left"; ctx.fillText(e.kind === "up" ? "+35" : "−35", ex + 5 * u, (ey + fy) / 2);
        ctx.restore();
      });
      if (shown.length >= 2) {   // the small day: a swing under 35 °C doesn't count
        let mx = 24; for (let i = 24; i <= 36; i++) if (temps[i] > temps[mx]) mx = i;
        const swing = temps[mx] - Math.min(...temps.slice(14, 25));
        ctx.save(); ctx.globalAlpha = A(smooth((s - 5.6) / 0.6)); font(Math.max(6, 7.5 * u), 600); ctx.fillStyle = P.dim; ctx.textAlign = "center";
        ctx.fillText(`${swing.toFixed(0)} °C swing < 35: no cycle`, px(mx), py(temps[mx]) - 8 * u); ctx.restore();
      }
      if (last.kind === "up" && shown.includes(last)) {
        ctx.save(); ctx.globalAlpha = A(smooth((s - 3 - (DATA.events.length - 1) * 1.3 - 0.4) / 0.6));
        ctx.fillStyle = "rgba(143,199,177,0.10)"; ctx.fillRect(px(last.index), y + 4 * u, px(n - 1) - px(last.index), h - 18 * u);
        font(Math.max(6, 7.5 * u), 600); ctx.fillStyle = P.mint; ctx.textAlign = "right"; ctx.fillText("open half cycle → historian", x + w, py(112));
        ctx.restore();
      }
      ctx.save(); ctx.globalAlpha = A(smooth((s - 12.4) / 0.6)); font(Math.max(7, 10 * u), 600); ctx.fillStyle = P.text; ctx.textAlign = "right";
      ctx.fillText(`${DATA.cycles.length + 1} thermal cycles (1 stitched)`, x + w, y - 4 * u); ctx.restore();
    }
  }

  // ---- Overlays tied to places in the landscape ----------------------------------------------
  function landOverlays() {
    for (const [x0, name] of [[0, "A"], [1840, "B"]]) {
      if (cam.s > 0.25) tag(`Substation ${name} · ${name === "A" ? "Elm Ridge" : "Fox Hollow"}`, X(x0 + 80), Y(-56), clamp((cam.s - 0.25) * 4), substationGlow(name) > 0.5 ? P.gold : P.text);
    }
    if (cam.s > 0.25) tag("NOAA weather station", X(-700), Y(-150), clamp((cam.s - 0.25) * 4));
    if (cam.s > 0.25 && cam.x > 1700) tag("LRP3 calculator", X(SCREEN.x + SCREEN.w / 2), Y(SCREEN.y - 14), clamp((cam.s - 0.3) * 3), P.gold);
    // Step 1.1: the conductor's metadata
    card(X(860) + 40 * U, 16 * U, "Conductor metadata", [["Type", "795 kcmil Drake ACSR 26/7"], ["Diameter", "28.1 mm"], ["Resistance at 25 °C", "0.0727 Ω/km"],
      ["Resistance at 75 °C", "0.0872 Ω/km"], ["Emissivity · absorptivity", "0.8 · 0.8"], ["Max operating temperature", "100 °C"]], active("1.1") ? span("1.1", 9.2) : 0, { w: 300 });
    // Step 1.2: structure tags, one tower at a time (they stay up through 1.3)
    if ((active("1.2") || active("1.3")) && cam.s > 0.6) {
      TOWERS.forEach((x, i) => {
        const k = active("1.2") ? ramp("1.2", 5.2 + i * 0.35, 5.6 + i * 0.35) : 1 - ramp("1.3", 9.2, 9.8);
        const id = 104 + i, lat = (37.52 - i * 0.004).toFixed(3), elev = [142, 151, 147, 160, 171, 166, 158, 149][i];
        tag(`STR ${id}`, X(x), Y(-140), k, P.gold);
        if (cam.s > 1.1) { ctx.save(); ctx.globalAlpha = A(k); font(9.5 * U); ctx.fillStyle = P.dim; ctx.textAlign = "center"; ctx.fillText(`${lat}°N · ${elev} m`, X(x), Y(-140) + 13 * U); ctx.restore(); }
      });
    }
    // Step 1.3: each span joined to its two structures, one at a time
    if (active("1.3")) {
      ctx.save(); ctx.setLineDash([4 * U, 4 * U]); ctx.strokeStyle = P.mint; ctx.lineWidth = 1.4 * U;
      TOWERS.slice(0, -1).forEach((x, i) => {
        const k = ramp("1.3", 4.4 + i * 0.4, 4.8 + i * 0.4) * (1 - ramp("1.3", 9.2, 9.8));
        if (k <= 0) return;
        const mid = (x + TOWERS[i + 1]) / 2 + 30, my = conductorY(x + 30, ATTACH, TOWERS[i + 1] + 30, ATTACH, mid);
        ctx.globalAlpha = A(k);
        ctx.beginPath(); ctx.moveTo(X(mid), Y(my)); ctx.lineTo(X(x), Y(-140) + 2 * U); ctx.moveTo(X(mid), Y(my)); ctx.lineTo(X(TOWERS[i + 1]), Y(-140) + 2 * U); ctx.stroke();
        ctx.beginPath(); ctx.arc(X(mid), Y(my), 3 * U, 0, Math.PI * 2); ctx.fillStyle = P.mint; ctx.fill();
      });
      ctx.restore();
      card(W - 18 * U, 16 * U, "Span map", [["STR 104 → 105", "213 m · Drake"], ["STR 105 → 106", "208 m · Drake"], ["…", ""], ["STR 110 → 111", "221 m · Drake"]], span("1.3", 7.6), { align: "right", w: 220 });
    }
    // Step 1.4: the nearest NOAA station, by distance from the line
    if (active("1.4")) {
      const draw = ramp("1.4", 5.8, 7.2), k = 1 - ramp("1.4", 10.4, 11);
      const ax = X(LINE_MID), bx = X(-700), y0 = Y(-60);
      ctx.save(); ctx.globalAlpha = A(k); ctx.setLineDash([6 * U, 5 * U]); ctx.strokeStyle = P.gold; ctx.lineWidth = 1.8 * U;
      ctx.beginPath();
      for (let i = 0; i <= 40 * draw; i++) { const t = i / 40, x = lerp(ax, bx, t), yy = y0 - Math.sin(t * Math.PI) * 60 * U; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      ctx.stroke(); ctx.restore();
      tag("nearest NOAA station · 11.8 km", (ax + bx) / 2, y0 - 68 * U, ramp("1.4", 7.2, 7.7) * k, P.gold);
    }
    // Step 1.5: what the station measures, a row at a time
    if (active("1.5")) {
      const s = local("1.5"), atmos = s > 13.6;
      card(W - 18 * U, 16 * U, "NOAA weather, hourly", [
        ["Air temperature", `${DATA.air[60].toFixed(1)} °C`, smooth((s - 5.6) / 0.5)],
        ["Solar radiation", "870 W/m²", smooth((s - 8.6) / 0.5)],
        ["Atmosphere", atmos ? "industrial" : "clear?", smooth((s - 13.2) / 0.5)],
        ["Wind speed", `${DATA.wind[60].toFixed(1)} m/s`, smooth((s - 18.6) / 0.5)],
        ["Wind direction", "225° (from the SW)", smooth((s - 19) / 0.5)],
        ["Convection", "forced", smooth((s - 22.4) / 0.5)],
      ], smooth((s - 5.4) / 0.5), { align: "right", w: 250 });
      const windTags = Math.min(smooth((s - 17.4) / 0.5), smooth((24 - s) / 0.5));
      tag("windsock: direction", X(STATION.sock + 6), Y(-104), windTags, P.text, 9.5);
      tag("anemometer: speed", X(STATION.mast), Y(-96), windTags, P.text, 9.5);
      tag("wind 2.7 m/s → forced convection", X(-700), Y(-180), smooth((s - 22.4) / 0.5), P.mint);
    }
    // Step 1.6: both substations, one at each end of the line, mapped to the conductor
    if (active("1.6") || active("1.7")) {
      const k = active("1.6") ? ramp("1.6", 16.6, 17.4) : 1;
      ctx.save(); ctx.globalAlpha = A(k); ctx.setLineDash([5 * U, 5 * U]); ctx.strokeStyle = P.mint; ctx.lineWidth = 1.6 * U;
      for (const sx of [80, 1920]) { ctx.beginPath(); ctx.moveTo(X(LINE_MID), Y(-120)); ctx.quadraticCurveTo(X((LINE_MID + sx) / 2), Y(-260), X(sx), Y(-66)); ctx.stroke(); }
      ctx.restore();
      tag("9.6 km", X(500), Y(-215), k, P.mint, 9.5); tag("14.2 km", X(1460), Y(-215), k, P.mint, 9.5);
      if (active("1.6")) tag("found one: Substation B", X(1920), Y(-150), Math.min(ramp("1.6", 11.6, 12.1), 1 - ramp("1.6", 13.6, 14)), P.gold);
    }
    // Step 1.7: each substation's amperage and its standard deviation, then the pick
    if (active("1.7")) {
      for (const [name, x, at] of [["A", 80, 2.8], ["B", 1920, 4.6]]) {
        const values = DATA.amp[name], k = ramp("1.7", at, at + 0.5) * (1 - ramp("1.7", 11.4, 12));
        const traced = ramp("1.7", at + 0.3, at + 1.8), sigmaIn = ramp("1.7", at + 1.6, at + 2.1);
        const chosen = name === DATA.chosen, pick = chosen ? ramp("1.7", 7, 7.8) : 0;
        const w = 190 * U, h = 92 * U, cx = clamp(X(x), w / 2 + 8, W - w / 2 - 8), top = Y(-300) - h / 2;
        panel(cx - w / 2, top, w, h, k);
        ctx.save(); ctx.globalAlpha = A(k);
        if (pick > 0) { roundRect(cx - w / 2 - 3, top - 3, w + 6, h + 6, 10 * U); ctx.strokeStyle = P.gold; ctx.lineWidth = 2.5 * U * pick; ctx.stroke(); }
        font(10.5 * U, 600); ctx.fillStyle = pick > 0.5 ? P.gold : P.text; ctx.textAlign = "left"; ctx.fillText(`Substation ${name} amperage`, cx - w / 2 + 10 * U, top + 18 * U);
        const gx = cx - w / 2 + 10 * U, gy = top + 26 * U, gw = w - 20 * U, gh = 38 * U;
        const upto = traced * (values.length - 1), sx = (i) => gx + (i / (values.length - 1)) * gw, sy = (v) => gy + gh - (v / 1400) * gh;
        ctx.beginPath();
        for (let i = 0; i <= Math.floor(upto); i++) i ? ctx.lineTo(sx(i), sy(values[i])) : ctx.moveTo(sx(i), sy(values[i]));
        const fi = Math.floor(upto), fv = fi < values.length - 1 ? lerp(values[fi], values[fi + 1], upto - fi) : values[fi];
        ctx.lineTo(sx(upto), sy(fv));
        ctx.strokeStyle = pick > 0 ? P.gold : P.sand; ctx.lineWidth = 1.5 * U; ctx.stroke();
        if (traced > 0 && traced < 1) { ctx.beginPath(); ctx.arc(sx(upto), sy(fv), 3 * U, 0, Math.PI * 2); ctx.fillStyle = P.gold; ctx.fill(); }
        ctx.globalAlpha = A(k * sigmaIn);
        font(12 * U, 600, SERIF); ctx.fillStyle = P.text; ctx.fillText(`σ = ${(DATA.sigma[name] * sigmaIn).toFixed(0)} A`, gx, top + h - 10 * U);
        ctx.globalAlpha = A(k);
        if (pick > 0.5) { font(10 * U, 600); ctx.fillStyle = P.gold; ctx.textAlign = "right"; ctx.fillText("highest σ: selected", cx + w / 2 - 10 * U, top + h - 10 * U); }
        ctx.restore();
      }
    }
    // Step 1.7: once picked, Substation A's amperage signal runs along its link to the conductor
    if (active("1.7")) {
      const run = ramp("1.7", 8, 10.2);
      if (run > 0 && run < 1) {
        const sx = 80, path = (t) => { const x0 = X(sx), y0 = Y(-66), cx = X((LINE_MID + sx) / 2), cy = Y(-260), x1 = X(LINE_MID), y1 = Y(-120), m = 1 - t; return [m * m * x0 + 2 * m * t * cx + t * t * x1, m * m * y0 + 2 * m * t * cy + t * t * y1]; };
        ctx.save(); ctx.globalAlpha = A(1); ctx.shadowColor = P.gold; ctx.shadowBlur = 14 * U;
        for (let j = 0; j < 3; j++) { const t = clamp(run - j * 0.06); if (t <= 0) continue; const [x, y] = path(t); ctx.beginPath(); ctx.arc(x, y, (4.5 - j) * U, 0, Math.PI * 2); ctx.fillStyle = P.gold; ctx.fill(); }
        ctx.restore();
      }
      tag("amperage → conductor", X((LINE_MID + 80) / 2), Y(-176) - 10 * U, Math.min(ramp("1.7", 9.6, 10.2), 1 - ramp("1.7", 11.4, 12)), P.gold);
    }
    // Step 1.7, inside the substation: the amperage being recorded, the meter's needle following it
    if (active("1.7b")) {
      const s = local("1.7b"), k = smooth((s - 3.6) / 0.6) * (1 - ramp("1.7b", 8.4, 9));
      const hour = 50 + clamp((s - 4) / 4.4) * 40, i = Math.floor(hour), a = lerp(DATA.amp.A[i], DATA.amp.A[i + 1], hour - i);
      card(W - 18 * U, 16 * U, "Amperage, Substation A", [["Recorded", "hourly"], ["Now", `${a.toFixed(0)} A`], ["Mean", `${M.mean(DATA.amp.A).toFixed(0)} A`], ["σ", `${DATA.sigma.A.toFixed(0)} A`]], k, { align: "right", w: 230 });
      const mx = X(140), my = Y(-14);
      ctx.save(); ctx.globalAlpha = A(k);
      ctx.beginPath(); ctx.arc(mx, my, 14 * U, Math.PI, 0); ctx.fillStyle = P.screen; ctx.fill(); ctx.strokeStyle = P.sand; ctx.lineWidth = 1.2 * U; ctx.stroke();
      const ang = Math.PI + (a / 1400) * Math.PI;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(ang) * 12 * U, my + Math.sin(ang) * 12 * U); ctx.strokeStyle = P.gold; ctx.lineWidth = 2 * U; ctx.stroke();
      ctx.restore();
    }
  }

  // ---- The bot: in the corner while Step 1 gathers inputs, then at its calculator --------------
  function drawBots(introHead) {
    const say = speech();
    let head = introHead, side = "right";
    const guide = Math.min(smooth((T - SHOT["1"].start - 4.2) / 0.8), 1 - smooth((T - SHOT["1.8"].start - 4.8) / 0.8));
    if (guide > 0) {
      ctx.save(); ctx.globalAlpha = guide;
      head = drawBot(W - 62 * U, H - 12 * U, 96 * U, { look: [-1, -0.3], talking: !!say });
      ctx.restore();
      side = "left";
    }
    if (after("1.8", 8)) {   // at the LRP3 calculator: walks in once, then types only while it calculates
      const v = view(T).land;
      if (v) {
        landCam(v.cam);
        const arrive = ramp("1.8", 8.2, 9.8), typing = active("2.3") && local("2.3") > 3.2 && local("2.3") < 12.8 ? Math.sin(T * 14) * 0.12 : 0;
        ctx.save(); ctx.globalAlpha = v.alpha;
        head = drawBot(X(lerp(DESK.x - 200, DESK.x - 70, arrive)), Y(0), L(150), { walk: arrive > 0 && arrive < 1, arms: [0.25, arrive < 1 ? 0.3 : 1.35 + typing], look: [1, -0.6], talking: !!say });
        ctx.restore();
        side = "up";
      }
    }
    if (say && head) bubble(head, say.text, say.alpha, side);
  }

  // ---- The step's title, in the middle, fading in and out ------------------------------------------
  function drawTitle() {
    const { shot } = shotAt(T);
    const step = STEP[shot.step], begin = STEP_START[shot.step];
    const end = Math.max(...SHOTS.filter((sh) => sh.step === shot.step).map((sh) => sh.start + sh.dur));
    const s = T - begin, appear = smooth(s / 0.7), leave = smooth((end - T) / 0.5);
    const k = Math.min(appear, leave);
    if (k <= 0) return;
    const move = smooth((s - 1.7) / 1.0);   // 0 in the centre, 1 settled in the corner
    // a light veil while the title holds the centre, lifting as it moves away: the scene keeps moving underneath
    ctx.save(); ctx.globalAlpha = appear * (1 - move); ctx.fillStyle = "rgba(2,12,9,0.18)"; ctx.fillRect(0, 0, W, H); ctx.restore();
    font(30 * U, 600, SERIF);
    const w = Math.max(ctx.measureText(step.title).width + 70 * U, 260 * U), h = 104 * U;
    const scale = lerp(1, 0.48, move);
    const x = lerp((W - w) / 2, 14 * U, move), y = lerp((H - h) / 2 - 10 * U, 14 * U, move);
    ctx.save(); ctx.globalAlpha = k;
    ctx.translate(x, y); ctx.scale(scale, scale);
    roundRect(0, 0, w, h, 12 * U); ctx.fillStyle = P.panel; ctx.fill(); ctx.strokeStyle = P.panelEdge; ctx.lineWidth = 1.2 / scale; ctx.stroke();
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    font(12.5 * U * lerp(1, 1.5, move), 600); ctx.fillStyle = step.optional ? P.mint : P.gold;
    ctx.fillText(`STEP ${step.id}${step.optional ? ` · OPTIONAL ${step.optional.toUpperCase()}` : ""}`, w / 2, 36 * U);
    font(30 * U, 600, SERIF); ctx.fillStyle = P.text; ctx.fillText(step.title, w / 2, 76 * U);
    ctx.restore();
  }

  // ---- Frame ---------------------------------------------------------------------------------------
  function render() {
    P = document.documentElement.dataset.theme === "dark" ? DARK : LIGHT;
    ctx.clearRect(0, 0, W, H);
    background();
    const v = view(T);
    drawMap(v.map);
    drawLand(v.land);
    const introHead = v.intro > 0 ? drawIntro(v.intro) : null;
    drawBots(v.intro > 0.5 ? introHead : null);
    drawTitle();
  }

  // ---- Playback and the page around it -------------------------------------------------------------
  const el = {
    run: document.getElementById("story-run"), play: document.getElementById("story-play"), scrub: document.getElementById("story-scrub"),
    speed: document.getElementById("story-speed"), narration: document.getElementById("story-narration"), time: document.getElementById("story-time"),
    list: document.getElementById("step-list"),
  };
  // the step list, grouped, each step a button that jumps there
  let lastGroup = null, groupList = null;
  for (const s of STEPS) {
    if (s.group !== lastGroup) {
      const li = document.createElement("li"); li.className = "step-group";
      li.innerHTML = `<p class="step-group__title">${s.group}</p><ol></ol>`;
      el.list.appendChild(li); groupList = li.querySelector("ol"); lastGroup = s.group;
    }
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" class="step" data-step-id="${s.id}"><span class="step__id">${s.id}</span><span class="step__title">${s.title}</span>${s.optional ? `<span class="step__optional">optional ${s.optional}</span>` : ""}</button>`;
    groupList.appendChild(li);
  }
  const stepItems = [...document.querySelectorAll("[data-step-id]")];
  let playing = false, last = 0, shown = -1;

  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  function sync() {
    const { i, shot } = shotAt(T);
    el.scrub.value = Math.round((T / TOTAL) * 1000);
    el.time.textContent = `${clock(T)} / ${clock(TOTAL)}`;
    if (i !== shown) {
      shown = i;
      el.narration.textContent = shot.text;
      stepItems.forEach((item) => {
        item.classList.toggle("is-active", item.dataset.stepId === shot.step);
        item.classList.toggle("is-done", STEP_START[item.dataset.stepId] < shot.start && item.dataset.stepId !== shot.step);
      });
    }
  }
  function frame(now) {
    if (!playing) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    T = Math.min(TOTAL, T + dt * Number(el.speed.value));
    render(); sync();
    if (T >= TOTAL) { setPlaying(false); return; }
    requestAnimationFrame(frame);
  }
  function setPlaying(on) {
    playing = on;
    el.play.textContent = on ? "❚❚ Pause" : T >= TOTAL ? "↺ Replay" : "▶ Play";
    if (on) { if (T >= TOTAL) T = 0; last = performance.now(); requestAnimationFrame(frame); }
  }
  function seek(t) { T = clamp(t, 0, TOTAL); render(); sync(); }

  el.run.addEventListener("click", () => { el.run.hidden = true; setPlaying(true); });
  el.play.addEventListener("click", () => { el.run.hidden = true; setPlaying(!playing); });
  el.scrub.addEventListener("input", () => { el.run.hidden = true; setPlaying(false); seek((el.scrub.value / 1000) * TOTAL); });
  stepItems.forEach((item) => item.addEventListener("click", () => {
    el.run.hidden = true;
    seek(STEP_START[item.dataset.stepId] + 0.01);
    if (!playing) setPlaying(true);
  }));
  new ResizeObserver(() => { resize(); render(); }).observe(canvas);
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  resize();
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has("t")) { el.run.hidden = true; seek(Number(hash.get("t")) || 0); } else seek(0);
  if (document.fonts) document.fonts.ready.then(render);
  window.PipelineStory = { seek, total: TOTAL, steps: STEPS, shots: SHOTS.map(({ key, step, start, dur }) => ({ key, step, start, dur })), data: DATA };
})();
