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
    const modeType = mode.type || mode.id || "rover";
    const isRover = modeType !== "walk";

    const nodeA = snapNearest(graph, latA, lonA);
    const nodeB = snapNearest(graph, latB, lonB);
    if (!nodeA || !nodeB) {
      return { error: "No graph nodes in area" };
    }

    const geodesic_m = MarsGeodesic.haversineMeters(latA, lonA, latB, lonB);

    const cosLatBase = Math.cos((nodeA.lat * Math.PI) / 180);
    const baseDx = (nodeB.lon - nodeA.lon) * cosLatBase;
    const baseDy = nodeB.lat - nodeA.lat;
    const baseLen = Math.hypot(baseDx, baseDy);

    const nodesById = indexNodes(graph.nodes);
    const scoreNodes = scores?.nodes || {};
    const edgeCostFn = function (fromId, toId, lengthM, slopeDeg) {
      const fromRisk = nodeRisk(scoreNodes, fromId) ?? 0;
      const toRisk = nodeRisk(scoreNodes, toId) ?? 0;
      const fromTraction = scoreNodes[fromId]?.traction_risk ?? 0;
      const toTraction = scoreNodes[toId]?.traction_risk ?? 0;
      const avgTraction = (fromTraction + toTraction) * 0.5;

      const fromNode = nodesById[fromId];
      const toNode = nodesById[toId];
      const rise = (fromNode && toNode && Number.isFinite(fromNode.elev_m) && Number.isFinite(toNode.elev_m))
        ? Math.abs(toNode.elev_m - fromNode.elev_m)
        : 0;

      if (isRover) {
        const climbPenalty = lengthM > 0 ? (rise / lengthM) * 10.0 : 0;
        const slopeFactor = slopeDeg != null && Number.isFinite(slopeDeg) && maxSlope > 0
          ? Math.pow(slopeDeg / maxSlope, 2) * 2.8
          : 0;

        let arcPenalty = 0;
        if (baseLen > 1e-7 && toNode && nodeA) {
          const cosLat = Math.cos((nodeA.lat * Math.PI) / 180);
          const px = (toNode.lon - nodeA.lon) * cosLat;
          const py = toNode.lat - nodeA.lat;
          const t = Math.max(0, Math.min(1, (px * baseDx + py * baseDy) / (baseLen * baseLen)));
          const crossDist = (px * baseDy - py * baseDx) / baseLen;
          const arcTarget = baseLen * 0.12 * Math.sin(Math.PI * t);
          const arcDev = Math.abs(crossDist - arcTarget) / (baseLen * 0.12 + 1e-6);
          arcPenalty = arcDev * 0.25;
        }

        const fromTI = scoreNodes[fromId]?.themis_ti_val ?? 450;
        const toTI = scoreNodes[toId]?.themis_ti_val ?? 450;
        const avgTI = (fromTI + toTI) * 0.5;
        const sandHazard = Math.max(avgTraction, Math.max(0, (480 - avgTI) / 300));

        return lengthM * (1.0 + slopeFactor + climbPenalty + sandHazard * 8.0 + (fromRisk + toRisk) * 1.8 + arcPenalty);
      } else {
        const slopeFactor = slopeDeg != null && Number.isFinite(slopeDeg) && maxSlope > 0
          ? Math.pow(slopeDeg / maxSlope, 3.0) * 15.0
          : 0;
        return lengthM * (1.0 + slopeFactor + (fromRisk + toRisk) * 0.6 + avgTraction * 0.2);
      }
    };

    let pathResult;
    try {
      pathResult = await MarsRouteWorker.solve(graph, nodeA.id, nodeB.id, maxSlope, scoreNodes, modeType);
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