# IEEE 738 Thermal Pipeline

An animated walkthrough of the IEEE 738 thermal pipeline, published at **https://ethan-gueck.github.io/ieee738-pipeline/**.

The pipeline estimates the temperature of every overhead transmission conductor in a network, hour by hour, with the IEEE Std 738 heat balance, and counts the thermal cycles each conductor goes through. The page follows the line risk bot (a square-headed robot in a Waldo hat and glasses) through one run, asking the pipeline's questions as it goes:

| Step | What it does |
| --- | --- |
| 0 | Installs dependencies |
| 0.2 | Archives the last run's logs |
| 1 | Runs every Step 1 substep |
| 1.1 | Fetches conductor metadata |
| 1.2 | Extracts structure information |
| 1.3 | Maps the conductor and structure information |
| 1.4 | Retrieves the nearest weather station |
| 1.5 | Pulls weather data from the nearest weather station |
| 1.6 | Finds the two nearest substations and maps them to the conductor |
| 1.7 | Of the two substations, pulls data from the one with the highest standard deviation |
| 1.8 | Loads metadata to the database |
| 2 | Runs every Step 2 substep |
| 2.0 | Flight check on date ranges: metadata, weather data, amperage data |
| 2.1 | Clears out old temperature data |
| 2.2 | Creates temperature data tables if needed |
| 2.3 | Calculates temperatures for the conductors |
| 2.4 | Drops and recreates the thermal cycle detail and summary tables |
| 2.5 | Cleans up the historian, or points to it when thermal cycles must initialize from a half cycle (thermal cycle stitching) |
| 2.6 | Calculates thermal cycles and the thermal cycle summary table |
| 4 | Converts files to CSV for viewing (optional validation) |
| 5 | Conforms each config to its .dist template: global_config, prod_config, batch_config (optional configuration) |
| 6 | Visualizes temperature results on a dashboard (optional validation) |
| 7 | Visualizes resource metrics (optional validation) |

A thermal cycle is an up event of 35 °C followed by a down event of 35 °C.

## Layout

A standalone static site: no build step and nothing shared with the portfolio.

```
ieee738-pipeline/
├── site/                         published as is to GitHub Pages
│   ├── index.html
│   └── assets/
│       ├── css/pipeline.css      light and dark themes
│       ├── js/story.js           the animation: archive → map → line → weather station → substations → LRP3 calculator
│       ├── js/pipeline_math.js   browser mirror of core/formula.py (parity tested)
│       ├── js/theme.js           the light / dark toggle
│       └── data/us_states.js     lower-48 state outlines (us-atlas, Albers USA, simplified)
├── core/formula.py               the arithmetic the story shows: the substation pick (σ), conductor temperature, thermal cycle events
├── tests/                        the formulas, JS-vs-Python parity, and the page
└── .github/workflows/pages.yml   test, then publish site/ on every push to main
```

```bash
uv sync && uv run pytest                  # tests (parity tests use Node.js, or osascript on macOS)
python3 -m http.server 8010 -d site       # preview at http://localhost:8010
```

Open the page with `#t=42` to jump to 42 seconds into the animation. The animation's numbers are illustrative (one conductor over 100 hours, with a one-line stand-in for the heat balance); the pipeline itself solves the full IEEE Std 738 balance for every reading. State outlines: [us-atlas](https://github.com/topojson/us-atlas) (ISC licence).
