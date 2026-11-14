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
      const d =
        (n.lat - lat) * (n.lat - lat) + (n.lon - lon) * (n.lon - lon);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    });
    return best;
  }

  function meanRisk(pathIds, scoresPayload) {
    const nodes = scoresPayload.nodes || scoresPayload;
    let sum = 0;
    let n = 0;
    pathIds.forEach(function (id) {
      const s = nodes[id];
      if (s && s.risk_0_1 != null) {
        sum += s.risk_0_1;
        n += 1;
      }
    });
    return n ? sum / n : 0;
  }

  async function solve(latA, lonA, latB, lonB) {
    const graph = await MarsData.loadGraph();
    const scores = await MarsData.loadScores();
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

    const edgeCostFn = function (fromId, toId, len) {
      const sn = scores.nodes || scores;
      const a = (sn[fromId] && sn[fromId].risk_0_1) || 0.3;
      const b = (sn[toId] && sn[toId].risk_0_1) || 0.3;
      const risk = (a + b) / 2;
      return len * (1 + 2 * risk);
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
        })
      : [
          [lonA, latA],
          [lonB, latB],
        ];

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
      geometry: { type: "LineString", coordinates: coords },
    };
  }

  return { solve, snapNearest };
})();