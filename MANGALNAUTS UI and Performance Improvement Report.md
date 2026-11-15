# MANGALNAUTS: UI and Performance Improvement Report

Based on the two screenshots (3D Globe and Dual Split views) and the technical architecture guide. Performance figures are expected effects, so measure before and after (see section 6).

## 1. Summary

The app has a strong identity and a real differentiator (hazard-aware routing with consumables). The main problems are (a) overlapping and clipped UI elements, (b) a dense route panel, and (c) likely GPU and main-thread cost from running two map engines at once with frosted-glass panels over a WebGL canvas.

Top five changes by impact for effort:

1. Turn on Cesium request-render mode and pause the hidden pane's render loop.
2. Reduce `backdrop-filter` cost over the canvas.
3. Convert terrain graph JSON to compact binary typed arrays, loaded lazily per sector.
4. Fix the status chip, altitude unit, and bottom-dock overlap.
5. Restructure the route panel into a summary, then expandable details.

## 2. UI Improvements

### 2.1 Layout and overlap bugs

| Issue | Where | Fix |
| --- | --- | --- |
| Altitude reads "EYE 11.5M km" | Status chip | Format by range: m below 10 km, km below 10,000 km, Mm above. Never append a unit to an already-scaled value. |
| Status chip collides with Cesium logo and attribution | Bottom-left | Move to a dedicated status strip above the attribution. Keep the Cesium and data credits visible, as the license requires. |
| Coordinates clipped in split view | Bottom-left of left pane | Let the chip shrink to lat/lon only when the pane is narrow, and move altitude and heading to a tooltip. |
| Dock covers globe and map content | Bottom | Reserve bottom padding for the viewport, make the dock collapsible, or auto-hide it after 4 s of idle. |
| Labels truncated ("AI…", "OBJECTI…") | Nav banner, objective label | Set a minimum width, use `text-overflow: ellipsis` with a tooltip, and pad the map's safe area against the side panel. |
| Rover label overlaps km marker | 2D map | Add label collision handling (offset or hide lower-priority labels). |
| Duplicate controls | Two compass/zoom clusters; "Route" in dock and panel | One cluster per view. In split mode keep a single shared cluster. Rename "Plan Route" to "Set waypoints" or "Compute route" and "Route" to "Route details". |

### 2.2 Route panel (highest UI value)

The panel is rich but crowded. Proposed structure:

1. **Header, two lines.** Line 1: route name. Line 2: coordinates. Badges (NAV LOCKED, FEASIBLE) on their own row.
2. **Summary strip, always visible.** Path distance, ETA, max slope against limit, risk. Four numbers, large type.
3. **Collapsible sections:** Consumables and safety, Terrain risk, ISRU and regolith telemetry. Default only the first open.
4. **Elevation profile** pinned under the summary and linked to the map. Hovering the profile moves a marker on the map and in the 3D pane.
5. **Warnings** (slope near limit, low reserve) appear as a short list at the top rather than being buried in cards.
6. Label the 200 m grid caveat as a small inline note, and show "Feasible at regional scale" rather than a flat "FEASIBLE".

Use consistent units, a single numeric font (JetBrains Mono) with tabular numerals, and align values to the right so changing digits don't jitter.

### 2.3 Information hierarchy and clarity

- **Top bar:** it has seven chips. Group them: Time (Sol, local time), Weather (temp, pressure, wind), Radiation. Add tooltips and an "as of" timestamp. Label "B5.4" as "Solar X-ray class (GOES, Earth-side)".
- Add **Ls (solar longitude)** beside Sol for season and dust-storm context.
- Clarify **MTC vs local solar time**: show the local time for the selected sector.
- Show **cursor readout** (elevation, slope, imagery source) in the status strip, as Google Earth does.
- Use **color plus shape** for risk and slope (not color alone) so the heatmap works for color-blind users.
- Add a **legend** for the traversability heatmap and keep it in the same corner always.

### 2.4 Dual Split view

- Sync cameras: moving the rover or cursor on one pane shows a marker on the other.
- Draw the route draped on terrain in the Cesium pane so both panes tell the same story.
- Make the divider draggable with a snap to 30/50/70%, and persist the choice.
- On narrow widths, switch to tabs (3D | 2D) instead of side by side.

### 2.5 Mobile and touch

- Move the dock to a bottom sheet with large touch targets (minimum 44 px).
- The route panel becomes a draggable bottom sheet with three snap heights.
- Use one-finger pan, pinch zoom, and two-finger tilt, and disable page scroll over the globe.
- Respect safe-area insets on phones.

### 2.6 Accessibility

- Keyboard: focus rings, tab order through the dock, arrow keys to pan, +/- to zoom.
- Contrast: check small grey labels on the glass panels against WCAG AA (4.5:1).
- `aria-label` on icon-only buttons (compass, 3D, zoom), and `aria-live="polite"` for route status updates.
- A `prefers-reduced-motion` option that shortens fly-to animations and stops animated glows.

### 2.7 Visual polish

- Add a subtle atmosphere limb and a lit terminator to the globe, which also helps depth perception.
- Use a MOLA colorized hillshade as the global base layer, since the albedo-only look is soft near the limb.
- Add terrain exaggeration (1x to 3x) and enable terrain lighting at close range.
- Keep the orange accent for primary actions only. Currently "Plan Route" turns red in split view, which reads as an error. Use one color per role.
- Add loading skeletons and a tile-loading indicator, so blank areas read as "loading" rather than "broken".

## 3. Performance Improvements

### 3.1 CesiumJS (3D pane)

| Setting | Why | Notes |
| --- | --- | --- |
| `requestRenderMode: true` with `maximumRenderTimeChange: Infinity` | Renders only when something changes, which cuts idle GPU use sharply. | Call `scene.requestRender()` after manual changes (new route, overlay toggle). Needed because the telemetry chip updates would otherwise keep waking the scene. |
| Stop or hide the 3D pane when in 2D-only mode | Two engines should not both render. | Hide the container and set `scene.useDepthPicking`/render loop off, or call `viewer.useDefaultRenderLoop = false` and drive it manually. |
| `viewer.resolutionScale` and `useBrowserRecommendedResolution` | High-DPI screens render 4x pixels. | Cap the scale at 1.0 to 1.25 on laptops, and lower it while the camera is moving. |
| `scene.globe.maximumScreenSpaceError` | Default is 2. | Raise to 3 to 4 on weak GPUs, or adapt it from measured FPS. |
| `scene.globe.tileCacheSize` | Controls memory. | Raise for desktop, lower for mobile. |
| `scene.fxaa` / `msaaSamples` | Anti-aliasing cost. | FXAA is cheap, so use that and skip MSAA. |
| `scene.globe.enableLighting`, `fog`, `skyAtmosphere` | Each adds per-pixel work. | Enable lighting only at close zoom, and keep atmosphere subtle. |
| `depthTestAgainstTerrain` | Costs per frame. | Enable only when draped routes or pick-through are needed. |
| Disable unused default widgets | Smaller DOM and fewer listeners. | `animation`, `timeline`, `baseLayerPicker`, `geocoder`, `homeButton`, `sceneModePicker`, `navigationHelpButton`, `fullscreenButton` all set to false, since you have your own HUD. |

Overlays and entities:

- Prefer **Primitive collections / PolylineCollection / GroundPolylinePrimitive** over thousands of Entities for the 1,062 cave points and traverses. Use clustering or LOD (show caves only below a certain altitude).
- Batch the 128.98 km of historical traverses into a single primitive.
- Spacecraft ephemeris orbits: compute with a sampled property and update at 1 Hz, not per frame.
- Terrain: confirm the quantized-mesh or heightmap tile source is served with gzip, and use `requestVertexNormals` only when lighting is on.

### 3.2 Leaflet (2D pane)

- Use `L.map({ preferCanvas: true })` for vectors, since SVG gets slow with thousands of paths.
- Render the GNN risk and science heatmap as **a single canvas or pre-rendered raster tile layer**, not 40,401 polygons. A 201x201 raster drawn once to an offscreen canvas and used as an `L.imageOverlay` is far cheaper, and can be recolored in a shader or `ImageData` pass.
- Tile layers: `keepBuffer: 2`, `updateWhenIdle: true` on mobile, `updateWhenZooming: false`.
- Route labels (the km markers): render with `L.divIcon` only for the visible range, or draw them on the canvas.
- Throttle `mousemove` handlers (the O(1) grid snap is fine, but the DOM updates it triggers should run at most once per animation frame).

### 3.3 CSS and rendering cost

- `backdrop-filter: blur(16px) saturate(140%)` over a live WebGL canvas forces the browser to re-composite the blurred region every frame. This is often the biggest hidden cost. Options:
  1. Reduce to `blur(8px)` and drop `saturate`.
  2. Use a near-opaque background (0.92) with no blur on the large panels (route panel, left sidebar). Keep blur only on small chips.
  3. Provide a "Performance mode" toggle that removes blur and shadows.
- Add `will-change: transform` only to the compass needle and animated elements, and remove glow animations when idle.
- Update the compass with `transform: rotate()` only, never layout properties.
- Promote the HUD to its own compositor layer (`transform: translateZ(0)`) when it overlaps the canvas.

### 3.4 Data loading

- `terrain_graph.json` (40,401 vertices, about 160k edges per sector) as JSON is large and slow to parse. Convert to:
  - Elevation: `Float32Array` or `Int16Array` (meters).
  - Slope, roughness, risk, science: `Uint8Array` quantized 0 to 255.
  - Edges implicit from the grid (8-connected neighbors computed from row and column), so there is no edge list at all. That shrinks each sector from several MB of JSON to roughly 200 to 400 KB raw, and less after Brotli.
- **Lazy-load per sector** and keep only the active sector in memory. Prefetch the next likely sector on idle.
- Serve with **Brotli or gzip** and long `Cache-Control` for versioned data (`v1/`). Add a service worker for offline use, which also suits a mission-ops tool.
- Load `historical_traverses.geojson` and `mars_cave_candidates.geojson` only when their layers are turned on.
- Telemetry feeds (MEDA, REMS, NOAA): cache for a few minutes, fetch in parallel with `Promise.allSettled`, and keep the last good value on failure, with an "as of" label.

### 3.5 A\* worker

- Pass the grid to the worker once (transfer the `ArrayBuffer`), and do not re-send it for each query.
- Use typed arrays for `gScore`, `cameFrom`, and the closed set, and a binary heap over typed arrays instead of object nodes. Reuse the buffers between searches.
- **Cancel stale searches** when the user drags a waypoint: tag each request with an id and drop outdated results.
- Use an admissible heuristic that matches the cost (for example, distance times the minimum cost multiplier) so it stays correct, and consider weighted A\* for the live drag preview, then run exact A\* on release.
- Add a hard block for edges above the slope limit, so the search never relies on penalties alone.
- Post progress messages for long searches so the UI can show a spinner and a cancel button.

### 3.6 Startup and bundle

- Load the Cesium build with `defer`, and load Leaflet and Esri-Leaflet only when the 2D pane is first shown.
- Use a custom or tree-shaken Cesium build if you move to ES modules later, since the full build is several MB.
- Subset the fonts (Latin only), use `font-display: swap`, and preload the two used weights.
- Remove the default Cesium Ion token warning and imagery by not relying on Ion at all.
- Compress images and icons, and inline critical CSS for the top bar and dock.

### 3.7 Memory and stability

- Remove event listeners and destroy Cesium primitives when switching sectors (`primitives.remove`, `destroy`).
- Revoke object URLs and clear canvas contexts for old heatmaps.
- Watch for leaks in the camera `changed` listener (a common source of slow degradation).
- Handle WebGL context loss with a clear message and a reload button.

## 4. Interaction polish

- Debounce and cancel the fly-to animation when the user starts dragging.
- Add inertia on drag release for the 2D map, matching the 3D globe.
- Show route computing state: a short progress indicator, then fade the route in.
- Add undo and redo for waypoints and a visible "clear route" action.
- Persist the last sector, view mode, layer choices, and travel mode in `localStorage`.
- Add search (IAU names with fly-to) and a measure tool; both are expected from a Google Earth-style app.

## 5. Prioritized roadmap

| # | Task | Impact | Effort |
| --- | --- | --- | --- |
| 1 | Cesium `requestRenderMode`, pause hidden pane | High (performance) | Low |
| 2 | Reduce or remove large-panel `backdrop-filter`, add Performance mode | High | Low |
| 3 | Fix altitude units, status strip, attribution, dock overlap | High (UI) | Low |
| 4 | Route panel restructure with summary strip and collapsibles | High (UI) | Medium |
| 5 | Heatmap as a raster overlay instead of polygons | High | Medium |
| 6 | Binary terrain grid and lazy per-sector load | Medium to High | Medium |
| 7 | Worker buffer reuse, cancel stale searches, hard slope block | Medium | Medium |
| 8 | Primitive collections for caves and traverses | Medium | Medium |
| 9 | Sync markers and the draped route between panes | High (UX) | Medium |
| 10 | Mobile bottom sheets, keyboard and accessibility pass | Medium | Medium |
| 11 | Service worker and offline cache | Medium | Medium |
| 12 | Atmosphere, MOLA hillshade base, terrain exaggeration | Medium (visual) | Medium |

## 6. How to measure

- **FPS and GPU:** set `viewer.scene.debugShowFramesPerSecond = true` and use Chrome DevTools Performance with the GPU track. Record idle, orbit, and split-view dragging.
- **Main thread:** look for long tasks over 50 ms (JSON parsing, heatmap building, DOM updates).
- **Memory:** take heap snapshots after switching sectors five times. The heap should return to baseline.
- **Load:** Lighthouse, plus the Network panel with cache disabled. Track total transferred size and time to first rendered globe.
- **Targets:** 60 FPS while interacting on a mid-range laptop, near 0% GPU when idle, first globe visible under 3 s on broadband, and a route computed in under 500 ms for a 201x201 grid.

## 7. Suggested next step

Start with items 1 to 3 in the roadmap (one afternoon of work). They give the biggest visible and measurable gain. Share `js/globe.js`, the viewer constructor, and the dock and panel CSS, and the exact patches can be written from there.
