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

  function hasElevation(graph, lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    const b = graph.bbox;
    if (b && !(lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east)) return false;
    const node = snapNearest(graph, lat, lon);
    return !!node && (graph.max_snap_m == null ||
      MarsGeodesic.haversineMeters(lat, lon, node.lat, node.lon) <= graph.max_snap_m);
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

  function coverageNode(graph, lat, lon) {
    return graph && hasElevation(graph, lat, lon);
  }

  async function elevationTier(lat, lon) {
    if (coverageNode(await MarsData.loadGraph(), lat, lon)) return "local";
    return coverageNode(await MarsData.loadRegionalGraph(), lat, lon) ? "regional" : null;
  }

  async function solve(latA, lonA, latB, lonB) {
    let graph = await MarsData.loadGraph();
    const local = coverageNode(graph, latA, lonA) && coverageNode(graph, latB, lonB);
    if (!local) {
      graph = await MarsData.loadRegionalGraph();
      const missing = [];
      if (!coverageNode(graph, latA, lonA)) missing.push("start");
      if (!coverageNode(graph, latB, lonB)) missing.push("destination");
      if (missing.length) return {
        status: "out_of_coverage",
        error: "Outside loaded elevation coverage: " + missing.join(" and ") + ".",
      };
    }
    const candidate = local ? await MarsData.loadScores().catch(() => null) : null;
    const scores =
      graph.graph_id != null && candidate?.graph_id === graph.graph_id
        ? candidate
        : null;
    const mode = MarsTravelMode.get();
    const maxSlope = mode.maxSlopeDeg;

    const nodeA = snapNearest(graph, latA, lonA);
    const nodeB = snapNearest(graph, latB, lonB);
    if (!nodeA || !nodeB) {
      return { error: "No graph nodes in area" };
    }

    const geodesic_m = MarsGeodesic.haversineMeters(latA, lonA, latB, lonB);

    const scoreNodes = scores?.nodes || {};
    const edgeCostFn = function (fromId, toId, lengthM, slopeDeg) {
      const fromRisk = nodeRisk(scoreNodes, fromId) ?? 0;
      const toRisk = nodeRisk(scoreNodes, toId) ?? 0;
      const slopeFactor = slopeDeg != null && Number.isFinite(slopeDeg) && maxSlope > 0
        ? Math.pow(slopeDeg / maxSlope, 2) * 3.8
        : 0;
      return lengthM * (1 + slopeFactor + (fromRisk + toRisk) * 1.5);
    };

    let pathResult;
    try {
      pathResult = await MarsRouteWorker.solve(graph, nodeA.id, nodeB.id, maxSlope, scoreNodes);
    } catch {
      pathResult = MarsAstar.findPath(graph, nodeA.id, nodeB.id, {
        maxSlopeDeg: maxSlope, edgeCostFn,
      });
    }

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
        })
      : [];

    const pathNodes = [];
    if (pathResult.found) {
      let cumulativeM = 0;
      for (let i = 0; i < pathResult.path.length; i++) {
        const curr = nodesById[pathResult.path[i]];
        if (i > 0) {
          const prev = nodesById[pathResult.path[i - 1]];
          cumulativeM += MarsGeodesic.haversineMeters(
            prev.lat,
            prev.lon,
            curr.lat,
            curr.lon
          );
        }
        const score = scoreNodes[curr.id] || {};
        pathNodes.push({
          id: curr.id,
          lat: curr.lat,
          lon: curr.lon,
          elev_m: curr.elev_m,
          slope_deg: curr.slope_deg,
          risk: score.risk_0_1 || 0.3,
          dist_m: cumulativeM,
        });
      }
    }

    const feasible =
      pathResult.found &&
      (stats.max_slope_deg == null || stats.max_slope_deg <= maxSlope);

    return {
      regional: !local,
      terrain_spacing_m: graph.spacing_m,
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
      node_ids: pathResult.found ? pathResult.path : [],
      path_nodes: pathNodes,
      geometry:
        coords.length > 1
          ? { type: "LineString", coordinates: coords }
          : null,
    };
  }

  function solveReturn(crew, habitat) {
    return solve(crew.lat, crew.lon, habitat.lat, habitat.lon);
  }

  return { solve, solveReturn, snapNearest, hasElevation, elevationTier };
})();