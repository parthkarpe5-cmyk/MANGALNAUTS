# MANGALNAUTS — Martian Mission OS & 3D Globe

Google Earth–style **3D Mars Globe and Mission Cockpit** for the NASA Space Apps *Interplanetary Survival Guide: Martian Map* challenge.

Combines high-resolution NASA orbital imagery and USGS elevation with graph-based traversability analysis, GNN safety scoring, dynamic telemetry, and route planning.

---

## Key Features

### 1. 3D Planetary Globe (CesiumJS)
- **True Mars Ellipsoid**: Custom `Cesium.Ellipsoid.MARS` coordinate frame with USGS/Esri **OnMars MDEM200M** digital elevation model.
- **NASA Trek Scientific Basemaps**:
  - Viking Color Mosaic (232 m) & Viking B&W (USGS MDIM 2.1)
  - MOLA Color Hillshade & MOLA Grayscale Relief (463 m)
  - THEMIS Day IR & Night IR (100 m)
  - TES Albedo (7.4 km), TES Dust Cover Index (DCI), and TES Thermal Inertia.
- **Optional Modular Globe Overlays (Toggleable Menu)**:
  - `☑ Landing Sites & Landmarks`: 3D pins for Perseverance, Curiosity, InSight, Opportunity, Spirit, Olympus Mons, and Valles Marineris. Clicking any pin smoothly flies the camera to the site.
  - `☑ Jezero AOI Boundary Footprint`: Orbital bounding box marking the high-resolution mission sector.
  - `☑ Coordinate Graticule`: Equator, prime meridian, and Martian latitude/longitude grid parallels.
  - `☑ Real-time Sun Lighting & Terminator`: Day/night solar illumination across the Martian terrain.

### 2. Hybrid Zoom Transition
- Zooming below **~400 km** camera altitude smoothly transitions into the **2D Surface Detail Mode**, revealing the CTX 5 m/px imagery while fading the globe into the background.

### 3. Surface Detail Engine (Leaflet & Esri)
- **High-Resolution CTX**: 5 m/pixel Murray Lab CTX beta mosaic layered over USGS MColorDEM.
- **GNN Risk & Science Heatmap**: Interactive overlay color-coding 121 traversability nodes by **Risk Index** ($0 \to 1$) or **Science Return** ($0 \to 100\%$) with hover telemetry tooltips.
- **Preset Mission Routes**: Toggleable pre-planned traverses:
  - 🚙 **ROVER Main Highway**: Graded, low-slope arterial route ($\le 8.4^\circ$).
  - 🚶 **MARSWALK Science Loop**: Pedestrian loop visiting high-yield delta outcrops ($\le 13.8^\circ$).
  - 🚨 **EMERGENCY Abort Vector**: Direct low-obstacle evacuation corridor back to the lander.
- **Science Stops & Landmark POIs**: Waypoints marking the **Octavia E. Butler Landing Site**, **Western Delta Scarp**, **Kodiak Butte**, **Belva Crater**, and **Neretva Vallis Inlet**. Clicking any stop displays NASA Perseverance rover imagery, Sol discovered, target mineralogy, and geologic context in the mission drawer.

### 4. Interactive A→B Segment Planner & Mission Telemetry
- Click **Plan segment (A→B)**, pick any two points on the Jezero CTX map.
- Computes geodesic vs. graph path distance, maximum slope, elevation change ($\Delta z$), and mode feasibility:
  - **Marswalk Mode**: Enforces slope limit $\le 15^\circ$.
  - **Rover Mode**: Enforces slope limit $\le 20^\circ$.
- **Responsive Elevation Cross-Section**: Renders an inline SVG elevation profile chart along the route path with slope warnings and risk color highlights.
- **EVA Consumables Estimator**: Automatically calculates estimated travel duration, $O_2$ requirement (liters), and suit/rover battery power consumption (Wh).
- **Environmental Telemetry Bar**: Real-time Mars Local Solar Time (LTST) clock, Sol counter, surface temperature (REMS/MEDA), pressure, wind speed/direction, dust optical depth ($\tau$), and radiation dose rate ($\mu\text{Sv/hr}$).

---

## Data Sources

| Layer | Source |
|---|---|
| Globe Imagery | [NASA Mars Trek WMTS](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) (Viking, MOLA, THEMIS, TES) |
| 3D Digital Elevation | [USGS / Esri OnMars MDEM200M](https://astro.arcgis.com/arcgis/rest/services/OnMars/MDEM200M/ImageServer) |
| High-Res Surface Detail | [OnMars CTX](https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer) (5 m/px), [MColorDEM](https://astro.arcgis.com/arcgis/rest/services/OnMars/MColorDEM/MapServer) |
| Environmental Telemetry | NASA Mars 2020 Perseverance MEDA & Curiosity REMS/RAD archives |
| Science Waypoints & Imagery | NASA / JPL-Caltech / MSSS / USGS / PDS Geosciences Node |

---

## Run Locally

### 1. Launch Mission Web Cockpit
```bash
cd "D:\Sem_5\NASA\MANGALNAUTS"
python run_app.py
```
*(Or run `python -m http.server 8000`)*. Open **[http://localhost:8000](http://localhost:8000)** in your browser.

### 2. Run GNN Scoring Pipeline
```bash
python python/ml/export_scores.py
```

### 3. Run In-Situ Live Telemetry & Radiation Snapshot
```bash
python python/safety/rems_rad_snapshot.py
```

### 4. Run Routing & System Integration Verification
```bash
python python/ml/verify_routing_integration.py
```

---

## Project Structure

```
MANGALNAUTS/
├── index.html                       # Mission cockpit shell
├── css/styles.css                   # Dark sci-fi mission HUD styling
├── data/
│   ├── manifest.json                # Mission dataset registry & citations
│   └── jezero/v1/
│       ├── terrain_graph.json       # Graph traversability nodes & edges
│       ├── gnn_scores.json          # GNN safety risk & science scores
│       ├── science_stops.geojson    # POIs with NASA photography & geology
│       ├── routes.geojson           # Preset Rover, Marswalk, & Abort routes
│       └── environment.json         # Atmospheric & radiation telemetry
├── js/
│   ├── globe.js                     # Cesium 3D Mars globe & optional layers
│   ├── layers/trek-layers.js        # NASA Trek WMTS tile providers
│   ├── detail-map.js                # Leaflet 2D CTX surface map
│   ├── hybrid.js                    # Altitude camera threshold watcher
│   ├── map/
│   │   ├── geodesic.js              # Haversine distance on Mars ellipsoid
│   │   ├── heatmap.js               # Interactive GNN Risk / Science heatmap
│   │   ├── preset-routes.js         # GeoJSON mission routes layer
│   │   ├── science-stops.js         # Interactive POI marker badges
│   │   └── pick.js                  # A->B two-point pick listener
│   ├── routing/
│   │   ├── astar.js                 # A* pathfinder with slope & risk weights
│   │   └── routeBetween.js          # Snap-to-graph solver
│   ├── mission/
│   │   ├── modes.js                 # Travel modes (Marswalk vs Rover)
│   │   ├── telemetry.js             # Environmental HUD bar & consumables
│   │   ├── elevation-profile.js     # Responsive SVG elevation profile
│   │   └── drawer.js                # Slide-out analytics & science cards
│   └── app.js                       # Main application coordinator
└── README.md
```
