# Routing handoff

The static app calls MarsRouteBetween.solve(latA, lonA, latB, lonB).
Coordinates use degrees, east-positive longitude, and geometry uses [lon, lat].

- ok: includes ordered node_ids, path_m, geodesic_m, max_slope_deg, and geometry. A route within one snapped node has distance zero and no line.
- no_route: no connection under the current slope cap. Geometry and route metrics are null.
- out_of_coverage: a click is outside the manifest bounds. Show the supplied error.
- solveReturn(crew, habitat) uses the same contract and travel mode. Both arguments are objects with lat and lon.

The solver applies the mode limit to absolute edge grade (elevation change divided by horizontal edge length). WALK uses 15 degrees and ROVER uses 20 degrees. These are prototype limits. It uses a zero heuristic so shortest paths are valid even if edge lengths and map coordinates come from different projections.

For terrain integration, export nodes with id, lat, lon, and elev_m plus undirected edges with from, to, and positive length_m. Set the manifest bounds to the graph coverage. Assign a graph_id that changes when geometry or node IDs change. Score files must carry the same graph_id and a nodes object keyed by node ID. Terrain routing works without scores, and risk values of zero are valid.

The current manifest loads the mock graph. Switch it only when the new graph and its coverage have been verified. The return helper is ready for the cockpit to call once the team agrees on a habitat point.
