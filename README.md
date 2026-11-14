# Martian Map — 3D hybrid globe

Google Earth–style **Mars globe** for the NASA Space Apps *Interplanetary Survival Guide: Martian Map* challenge.

## Features

- **3D globe** (Cesium): rotate, tilt, zoom on Mars with **MDEM200M** terrain (OnMars).
- **NASA Trek imagery filters**: Viking color, MOLA hillshade, THEMIS day/night IR, TES albedo.
- **Hybrid detail mode**: zoom below ~400 km camera height → **2D CTX (5 m)** map slides up (lazy-loaded Leaflet).
- **Jump to** Jezero, Gale, Olympus Mons, or global view.

## Data sources

| Layer | Source |
|-------|--------|
| Globe imagery | [Mars Trek WMTS](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) |
| 3D terrain | [OnMars MDEM200M](https://astro.arcgis.com/arcgis/rest/services/OnMars/MDEM200M/ImageServer) |
| Surface detail | [OnMars CTX](https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer), [MColorDEM](https://astro.arcgis.com/arcgis/rest/services/OnMars/MColorDEM/MapServer) |

Educational [NASA Mars glTF model](https://science.nasa.gov/resource/planet-mars-3d-model/) — linked in the app header (not used as the scientific basemap).

## Run locally

```bash
cd "D:\NASA Space challenge\MANGALNAUTS"
python -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). Requires network access for NASA/Esri tiles and the Cesium CDN.

## Optional: Cesium Ion Mars 3D Tiles

For Jezero/Gale centimeter–meter 3D Tiles, add a free [Cesium ion](https://cesium.com/ion/) token and load asset `3644333` in `js/globe.js` (not required for this build).

## Project layout

- `js/globe.js` — Cesium viewer, terrain, filter switching  
- `js/layers/trek-layers.js` — lazy Trek WMTS providers  
- `js/detail-map.js` — 2D CTX map (init once)  
- `js/hybrid.js` — camera threshold → detail pane  
- `js/app.js` — UI wiring  

## Plan segment (A→B)

In **surface detail** mode (zoom the globe below ~400 km):

1. Enable **Plan segment (A→B)** on the detail pane toolbar.
2. Click **point A**, then **point B** on the CTX map.
3. The drawer shows **geodesic** vs **graph path** distance, slope, and feasibility for **Marswalk (15°)** or **Rover (20°)**.

Mock graph data lives in `data/jezero/v1/` (replace with P3 pipeline output).

## Next steps

- Replace mock `terrain_graph.json` with real MOLA/THEMIS/CRISM pipeline  
- Point query for NASA Ames Mars climate reference (MCS)  
- HiRISE / CRISM footprints from PDS ODE