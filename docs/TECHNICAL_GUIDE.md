# MANGALNAUTS — Technical Architecture & Engineering Guide

**Project:** MANGALNAUTS (NASA Space Apps Challenge 2026: *Interplanetary Survival Guide — Martian Map*)  
**System Classification:** Planetary Geospatial Cockpit, 3D Mars Globe, GNN Traversability & Mission Routing OS  
**Architecture Paradigm:** Client-Centric Vanilla WebGL / WebAssembly Runtime (Zero-Build Vanilla Web Architecture)  
**Primary Engines:** CesiumJS 1.123 (3D Globe) · Leaflet 1.9.4 / Esri-Leaflet 3.0.14 (2D Surface Detail) · Web Workers (A* Engine)

---

## 1. Executive Summary & Mission Scope

MANGALNAUTS is a dual-viewport, multi-scale mission operations cockpit designed for human and autonomous robotic Martian surface exploration. It solves the critical operational challenge of planning safe traverses across rugged terrain by fusing:
- High-resolution NASA orbital spectroscopy and digital elevation models (DEM)
- A 2-Layer Graph Convolutional Network (GCN) that computes terrain traversability and scientific biosignature priority
- Real-time in-situ atmospheric telemetry (NASA Mars 2020 MEDA, MSL REMS) and space weather dosimetry (NOAA SWPC, MSL RAD)
- Google Earth–style 3D globe navigation HUD controls (true Martian North compass rose, 3D oblique tilt, live telemetry chip, map style presets)
- A multi-threaded A* pathfinding engine enforcing physical vehicle slope and EVA physiological consumable constraints

```
+----------------------------------------------------------------------------------------------------+
|                                    MANGALNAUTS RUNTIME ARCHITECTURE                                |
+----------------------------------------------------------------------------------------------------+
|  Top Cockpit Bar: Live Mars Sol Time (LTST), MEDA/REMS Weather, NOAA GOES Flare Flux, RAD Dosimetry|
+--------------------------------------------------+-------------------------------------------------+
|               3D PLANETARY GLOBE                 |            2D TACTICAL SURFACE MAP              |
|                   (CesiumJS)                     |              (Leaflet + Esri)                   |
|  - Custom Mars Ellipsoid (IAU/IAG)               |  - CTX 5 m/px Murray Lab Mosaic                 |
|  - MDEM200M 3D Elevation Terrain Mesh            |  - MColorDEM Topographic Relief                 |
|  - 10 NASA Trek Global Basemaps                  |  - Interactive GNN Risk & Science Heatmap       |
|  - 6 Odyssey GRS Elemental Spectroscopy Overlays |  - Verified POIs & Perseverance/Curiosity Stops |
|  - 3D Spacecraft Models & Ephemeris Orbits       |  - Real-Time Geodesic & Graph Segment Planner   |
|  - Compass Rose, Oblique Tilt (-45°/-90°), Chip  |  - Responsive SVG Cross-Section Elevation Curve |
+--------------------------------------------------+-------------------------------------------------+
|  Bottom Mission Dock: Sector Selector · View Mode (3D/Split/2D) · Travel Physics · Route Drawer    |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Mathematical Coordinate & Geodetic Models

### 2.1. Mars Reference Ellipsoid
Mars is an oblate spheroid with significant polar flattening ($\approx 0.00589$). The application configures CesiumJS to use the IAU/IAG Martian triaxial reference ellipsoid rather than Earth's WGS84:

$$\text{Semi-Major Axis } (a) = 3,396,190.0\text{ m}$$
$$\text{Semi-Minor Axis } (b) = 3,396,190.0\text{ m}$$
$$\text{Polar Axis } (c) = 3,376,200.0\text{ m}$$

In `js/config/mars-ellipsoid.js`:
```javascript
Cesium.Ellipsoid.MARS = new Cesium.Ellipsoid(
  3396190.0, // X radius in meters
  3396190.0, // Y radius in meters
  3376200.0  // Z polar radius in meters
);
Cesium.Ellipsoid.default = Cesium.Ellipsoid.MARS;
```

### 2.2. Great-Circle Geodesic Distance (Haversine on Mars)
For spherical distance approximations across the Martian surface, the volumetric mean radius $R_M = 3,389,500\text{ m}$ is utilized:

$$d = 2 R_M \arcsin \left( \sqrt{ \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right) } \right)$$

Where $\phi$ represents planetographic latitude and $\lambda$ represents longitude.

### 2.3. $O(1)$ Mathematical Grid Snapping for Regional DEM Rasters
The mission operational sites (Jezero, Gale, Olympus Mons) are sampled as uniform $201 \times 201$ node grids ($40,401$ topological nodes). A naive nearest-neighbor search through $40,401$ vertices would require $O(N)$ linear scans ($\approx 40,000$ trigonometric calls per mouse movement). 

To achieve lock-free $60\text{ FPS}$ interaction, `js/routing/routeBetween.js` employs $O(1)$ closed-form raster quantization:

$$\text{row} = \text{clamp}\left( \text{round}\left( \frac{\text{north} - \text{lat}}{\text{north} - \text{south}} \cdot (\text{rows} - 1) \right), 0, \text{rows} - 1 \right)$$

$$\text{col} = \text{clamp}\left( \text{round}\left( \frac{\text{lon} - \text{west}}{\text{east} - \text{west}} \cdot (\text{cols} - 1) \right), 0, \text{cols} - 1 \right)$$

$$\text{node\_id} = \text{"n\_" } + \text{row} + \text{"\_"} + \text{col}$$

---

## 3. Data Engineering & Scientific Datasets

The platform integrates 46 validated JSON/GeoJSON datasets, manifests, and spatial rasters registered in `data/manifest.json`.

```
data/
├── manifest.json                     # System manifest & citation database
├── caves/
│   └── mars_cave_candidates.geojson # 1,062 USGS lava tube skylight entrances
├── traverses/
│   └── historical_traverses.geojson # 128.98 km of NASA rover tracks (5 missions)
├── jezero/v1/
│   ├── terrain_graph.json           # 201x201 raster mesh (40,401 vertices, 160,000 edges)
│   ├── gnn_scores.json              # Model risk indices & science yield scores
│   ├── science_stops.geojson        # Validated NASA science waypoints & imagery
│   ├── routes.geojson               # Pre-calculated highway, loop, & abort corridors
│   └── environment.json             # Perseverance MEDA & REMS sensor logs
├── gale/v1/                         # Curiosity MSL Mount Sharp operational sector
└── olympus/v1/                      # Olympus Mons summit caldera exploration sector
```

### 3.1. Scientific Basemaps & Overlays

| Layer Name | Satellite / Sensor | Spatial Resolution | Spectrum / Product | Purpose |
|---|---|---|---|---|
| **Viking Color Mosaic** | Viking Orbiter 1 & 2 | $232\text{ m/px}$ | True Color Visible | Global visual context |
| **Viking MDIM 2.1** | USGS Astrogeology | $232\text{ m/px}$ | Calibrated Panchromatic | Photometric control |
| **MOLA Hillshade** | Mars Global Surveyor | $463\text{ m/px}$ | Laser Altimeter DEM | Global topographic relief |
| **THEMIS Day IR** | 2001 Mars Odyssey | $100\text{ m/px}$ | Thermal IR ($100\text{ m}$) | Rock abundance & surface roughness |
| **THEMIS Night IR** | 2001 Mars Odyssey | $100\text{ m/px}$ | Nighttime Thermal Inertia | Bedrock vs. loose sand detection |
| **TES Thermal Inertia** | MGS TES | $7.4\text{ km/px}$ | Thermal Emission Spectrometer | Soil grain size & drift hazards |
| **OnMars CTX** | Mars Reconnaissance Orbiter | $5.0\text{ m/px}$ | Context Camera (Murray Lab) | Tactical surface planning |
| **OnMars MColorDEM** | MRO CTX + HRSC | $6.0\text{ m/px}$ | Colorized DEM Elevation | Micro-slope cross-sections |

### 3.2. Odyssey GRS Elemental Spectroscopy Maps
Derived from Boynton et al. (2007) via the NASA PDS Geosciences Node, the Gamma Ray Spectrometer suite provides global subsurface elemental concentrations:
- **Water-Equivalent Hydrogen ($\text{H}_2\text{O}\text{ wt\%}$)**: Critical for In-Situ Resource Utilization (ISRU), hydration extraction, and radiation shielding.
- **Elemental Iron ($\text{Fe}\text{ wt\%}$)**: Identifies basaltic versus highly weathered oxidic terrains.
- **Potassium ($\text{K}\text{ wt\%}$) & Thorium ($\text{Th}\text{ ppm}$)**: Traces incompatible lithophile elements and igneous crustal differentiation.
- **Silicon ($\text{Si}\text{ wt\%}$)**: Distinguishes ultramafic volcanic plains from silica-rich sedimentary delta deposits.
- **Chlorine ($\text{Cl}\text{ wt\%}$)**: Measures toxic surface perchlorate salt distributions impacting EVA suit seals.

---

## 4. AI & Graph Neural Network (GCN) Traversability Engine

### 4.1. Network Architecture
Traversability analysis is performed using a vectorized 2-Layer Spatial Graph Convolutional Network (GCN) implementing symmetric normalized adjacency message passing:

$$H^{(l+1)} = \sigma \left( \tilde{D}^{-\frac{1}{2}} \tilde{A} \tilde{D}^{-\frac{1}{2}} H^{(l)} W^{(l)} \right)$$

Where:
- $\tilde{A} = A + I_N$ is the graph adjacency matrix with inserted self-loops
- $\tilde{D}_{ii} = \sum_j \tilde{A}_{ij}$ is the diagonal degree matrix
- $H^{(0)} \in \mathbb{R}^{N \times 6}$ is the input feature matrix:
  $$\mathbf{x}_i = [\text{Slope}^\circ, \text{Roughness (RMS)}, \text{Thermal Inertia}, \text{Albedo}, \text{Elevation (m)}, \text{Radiation Proxy}]$$
- $W^{(0)} \in \mathbb{R}^{6 \times 16}$ and $W^{(1)} \in \mathbb{R}^{16 \times 2}$ are learned spatial weight matrices
- $\sigma(\cdot)$ is the LeakyReLU activation function

```
[6-Dim Input Features]
  - Slope (deg)
  - Roughness (RMS)
  - Thermal Inertia
  - Albedo
  - Elevation (m)
  - Radiation Proxy
         |
         v
+-------------------------------+
|  GCN Layer 1 (16 Hidden)      |  <-- Topological Message Passing
|  (A_norm * X * W_0) + ReLU    |      over 8-connected grid neighbors
+-------------------------------+
         |
         v
+-------------------------------+
|  GCN Layer 2 (Multitask Head) |
+-------------------------------+
         |
         +-------------------------------------+
         |                                     |
         v                                     v
[Risk Index R in [0, 1]]           [Science Yield S in [0, 100%]]
(Traversability Safety Metric)     (Biosignature Preservation Priority)
```

### 4.2. Slope & Mechanical Traversability Physics
Paths are constrained by physical locomotion limitations:
- **Rover Mode (AutoNav)**: Maximum operational slope $\theta_{\max} \le 20.0^\circ$. Wheels experience excessive slip and motor thermal stalls beyond $20^\circ$.
- **Marswalk Mode (Human EVA)**: Maximum operational slope $\theta_{\max} \le 15.0^\circ$. Pressurized EVA spacesuits present severe fall and metabolic exhaustion risks on loose scree above $15^\circ$.

Edge traversal cost calculation:

$$\text{Cost}(u, v) = d(u, v) \cdot \left( 1.0 + 3.5 \cdot \left(\frac{\theta_{u,v}}{\theta_{\max}}\right)^2 + 2.0 \cdot R_v \right)$$

Where $\theta_{u,v}$ is the slope angle between vertices and $R_v$ is the GNN risk index of destination node $v$.

### 4.3. Multi-Threaded Web Worker A* Engine
To prevent UI thread lock during complex route expansions across $40,401$ nodes, search execution is offloaded to a dedicated Web Worker (`js/routing/search-worker.js`). The search employs an optimized min-heap priority queue ($O(\log N)$ extraction) and early-exit Euclidean distance heuristics.

---

## 5. UI/UX Cockpit & Glassmorphism Design System

The visual design system adheres to an aerospace flight cockpit standard:

### 5.1. Typography Stack
- **UI Chrome & Text (`--font-display`, `--font-body`)**: **Space Grotesk**  
  A clean, wide geometric grotesque typeface suited for aerospace telemetry panels, buttons, and headers.
- **Numerical Data & Coordinates (`--font-mono`)**: **JetBrains Mono**  
  Tabular-numeral monospace typeface used strictly for live coordinate streaming, Sol clocks, elevation meters, and heading angles.

### 5.2. Glassmorphism Design System
All floating panels use unified optical styling:
- **Frosted Translucency**: `background: rgba(14, 14, 20, 0.85); backdrop-filter: blur(16px) saturate(140%);`
- **Beveled Specular Edge**: `border: 1px solid rgba(255, 255, 255, 0.12); inset 0 1px 0 0 rgba(255, 255, 255, 0.1);`
- **Mars Palette Accents**:
  - Mars Orange: `#FF6B00`
  - NASA Gold: `#FFC107`
  - Deep Red: `#B22222`
  - Space Obsidian: `#0B0B0F`

### 5.3. Google Earth–Inspired HUD Controls
Positioned directly in `#globe-pane`:
1. **Compass Rose & North Snap (`#globe-compass`)**:
   - The needle dynamically rotates via CSS transform matching `viewer.camera.heading`. True Martian North always points upward.
   - Clicking smoothly flies the camera to `heading: 0` in $0.8\text{ s}$.
2. **3D Oblique Perspective / 2D Nadir Tilt (`#globe-tilt-btn`)**:
   - Toggles camera pitch between flat nadir ($-90^\circ$) and oblique relief perspective ($-45^\circ$).
3. **Telemetry Status Chip (`#globe-status-chip`)**:
   - Positioned at the bottom-left of the globe. Displays real-time coordinates, eye altitude (`EYE 1,200 km`), and heading (`HDG 000°`).
4. **Map Style Preset Dropdown (`#map-style-preset`)**:
   - One-click bulk layer selector: **Clean** (pristine Mars), **Exploration** (landmarks & traverses), **Orbital Fleet** (spacecraft & moons), or **Custom**.

```
+---------------------------------------------------------------------------------------+
|  TOP COCKPIT BAR (Frosted Glass, Space Grotesk + JetBrains Mono)                     |
|  [Logo] MANGALNAUTS   |  SOL 4745   14:22 LTST   -62°C   612 Pa   0.24 uSv/h   [NASA] |
+---------------------------------------------------------------------------------------+
|                                                      |                                |
|                     3D GLOBE PANE                    |       TACTICAL 2D MAP PANE     |
|                      (CesiumJS)                      |            (Leaflet)           |
|                                                      |                                |
|  [Site Entry Banner]                                 |  [CTX Imagery 5 m/px]          |
|  Jezero Crater - 18.44°N, 77.35°E                    |  [GNN Traversability Heatmap]  |
|                                                      |  [Historical Rover Tracks]     |
|                                                      |                                |
|                                      [HUD Cluster]   |                                |
|                                      (N) Compass     |                                |
|                                      [3D] Tilt       |                                |
|                                      (+) Zoom In     |                                |
|                                      (-) Zoom Out    |                                |
|                                                      |                                |
|  [Status Chip]                                       |                                |
|  18.445°N, 77.451°E · EYE 1,200 km · HDG 000°        |                                |
+------------------------------------------------------+--------------------------------+
|  FLOATING MISSION DOCK (Rounded Glass Capsule)                                        |
|  [SECTOR: Jezero v]  [VIEW: 3D | Split | 2D]  [TRAVEL: Rover v]  [Plan Route] [Layers]|
+---------------------------------------------------------------------------------------+
```

---

## 6. Verification & Automated Quality Assurance

The codebase includes full data and schema verification scripts:

### 6.1. Comprehensive Data Integrity Check
```bash
python python/verify_all.py
```
Validates:
1. All 46 JSON/GeoJSON files parse with valid syntax.
2. Manifest coordinates and bounding boxes match regional DEM files.
3. Historical traverse distances sum correctly ($128.98\text{ km}$).
4. All 6 Odyssey GRS elemental maps are present with correct range limits.

### 6.2. In-Situ Environment Schema Unit Test
```bash
python -m unittest python/safety/test_environment_schema.py
```
Validates atmospheric pressure, temperature, solar flare flux, and ionizing radiation dosimetry structures against PDS standards.

### 6.3. JavaScript Syntax Verification
```bash
node -c js/app.js
node -c js/globe.js
node -c js/detail-map.js
node -c js/map/pick.js
node -c js/routing/routeBetween.js
```

---

## 7. Developer Extension Guide

### Adding a New Martian Exploration Sector
1. **Register Dataset in Manifest**:
   Open `data/manifest.json` and append the new sector under `sites`:
   ```json
   "valles_marineris": {
     "id": "valles_marineris",
     "name": "Valles Marineris (Coprates Chasma)",
     "center": { "lat": -14.0, "lon": -59.0 },
     "bbox": { "west": -61.0, "east": -57.0, "north": -12.5, "south": -15.5 },
     "layers": {
       "terrain_graph": "data/valles_marineris/v1/terrain_graph.json",
       "gnn_scores": "data/valles_marineris/v1/gnn_scores.json",
       "environment": "data/valles_marineris/v1/environment.json"
     }
   }
   ```
2. **Add Preset to Place Registry**:
   In `js/config/places.js`:
   ```javascript
   valles_marineris: {
     name: "Valles Marineris",
     lat: -14.0,
     lon: -59.0,
     globeHeight: 1200000,
     siteKey: "valles_marineris"
   }
   ```
3. **Add Option to Location Selector**:
   In `index.html`:
   ```html
   <option value="valles_marineris">Valles Marineris (Chasma)</option>
   ```
4. **Run Verification**:
   ```bash
   python python/verify_all.py
   ```
