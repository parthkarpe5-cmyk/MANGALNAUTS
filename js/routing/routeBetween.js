/* global MarsGeodesic, MarsAstar, MarsData, MarsTravelMode, window */
window.MarsRouteBetween = (function () {
  function indexNodes(nodes) {
    const byId = {};
    nodes.forEach(function (n) {
      byId[n.id] = n;
    });
    return byId;
  }

  function snapNearest(graph, lat, lon) {
    let best = null;
    let bestD = Infinity;
    graph.nodes.forEach(function (n) {
      const d = MarsGeodesic.haversineMeters(lat, lon, n.lat, n.lon);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    });
    return best;
  }

  function nodeRisk(nodes, id) {
    const risk = nodes[id]?.risk_0_1;
    return Number.isFinite(risk) && risk >= 0 && risk <= 1 ? risk : null;
  }

  function meanRisk(pathIds, scoresPayload) {
    const nodes = scoresPayload?.nodes || scoresPayload || {};
    let sum = 0;
    let n = 0;
    pathIds.forEach(function (id) {
      const risk = nodeRisk(nodes, id);
      if (risk != null) {
        sum += risk;
        n += 1;
      }
    });
    return n ? sum / n : null;
  }

  async function solve(latA, lonA, latB, lonB) {
    const graph = await MarsData.loadGraph();
    const manifest = await MarsData.loadManifest();
    const bounds = manifest.bbox;
    function inCoverage(lat, lon) {
      return Number.isFinite(lat) && Number.isFinite(lon) &&
        (!bounds || (lat >= bounds.south && lat <= bounds.north &&
          lon >= bounds.west && lon <= bounds.east));
    }
    if (!inCoverage(latA, lonA) || !inCoverage(latB, lonB)) {
      return { status: "out_of_coverage", error: "Choose both points inside the terrain coverage." };
    }
    const candidate = await MarsData.loadScores().catch(() => null);
    const scores = graph.graph_id != null && candidate?.graph_id === graph.graph_id
      ? candidate
      : null;
    const mode = MarsTravelMode.get();
    const maxSlope = mode.maxSlopeDeg;

    const nodeA = snapNearest(graph, latA, lonA);
    const nodeB = snapNearest(graph, latB, lonB);
    if (!nodeA || !nodeB) {
      return { error: "No graph nodes in area" };
    }

    const geodesic_m = MarsGeodesic.haversineMeters(
      latA,
      lonA,
      latB,
      lonB
    );

    const scoreNodes = scores?.nodes || {};
    const edgeCostFn = function (fromId, toId, lengthM) {
      const fromRisk = nodeRisk(scoreNodes, fromId) ?? 0;
      const toRisk = nodeRisk(scoreNodes, toId) ?? 0;
      return lengthM * (1 + fromRisk + toRisk);
    };

    const pathResult = MarsAstar.findPath(graph, nodeA.id, nodeB.id, {
      maxSlopeDeg: maxSlope,
      edgeCostFn: edgeCostFn,
    });

    const path_m = pathResult.found
      ? MarsAstar.pathLengthM(graph, pathResult.path)
      : null;
    const stats = pathResult.found
      ? MarsAstar.pathStats(graph, pathResult.path)
      : { max_slope_deg: null, elev_delta_m: null };

    const nodesById = indexNodes(graph.nodes);
    const coords = pathResult.found
      ? pathResult.path.map(function (id) {
          const n = nodesById[id];
          return [n.lon, n.lat];
        }) : [];

    const feasible =
      pathResult.found &&
      (stats.max_slope_deg == null || stats.max_slope_deg <= maxSlope);

    return {
      from: {
        lat: latA,
        lon: lonA,
        node_id: nodeA.id,
        snap_lat: nodeA.lat,
        snap_lon: nodeA.lon,
      },
      to: {
        lat: latB,
        lon: lonB,
        node_id: nodeB.id,
        snap_lat: nodeB.lat,
        snap_lon: nodeB.lon,
      },
      geodesic_m: geodesic_m,
      path_m: path_m,
      elev_delta_m: stats.elev_delta_m,
      max_slope_deg: stats.max_slope_deg,
      mean_risk: pathResult.found ? meanRisk(pathResult.path, scores) : null,
      mode: mode.id,
      feasible: feasible,
      path_found: pathResult.found,
      status: pathResult.found ? "ok" : "no_route",
      node_ids: pathResult.path,
      geometry: coords.length > 1 ? { type: "LineString", coordinates: coords } : null,
    };
  }

  function solveReturn(crew, habitat) {
    return solve(crew.lat, crew.lon, habitat.lat, habitat.lon);
  }

  return { solve, solveReturn, snapNearest };
})();