importScripts("../map/geodesic.js?v=terrain2", "astar.js?v=contour-slope-v3");
let graph, nodes, scale;
function distance(a, b) {
  return MarsGeodesic.haversineMeters(a.lat, a.lon, b.lat, b.lon);
}
self.onmessage = ({ data }) => {
  const { id, start, goal, limit, scores, mode } = data;
  try {
    if (data.graph) {
      graph = data.graph;
      nodes = new Map(graph.nodes.map(node => [node.id, node]));
      scale = 1;
      for (const edge of (graph.raster ? [] : graph.edges)) {
        const a = nodes.get(edge.from), b = nodes.get(edge.to);
        if (!a || !b || !(edge.length_m > 0)) continue;
        const meters = distance(a, b);
        if (meters > 0) scale = Math.min(scale, edge.length_m / meters);
      }
      scale *= 0.999999;
    }
    const scoreMap = scores || {};
    function risk(nodeId) {
      const value = scoreMap[nodeId]?.risk_0_1;
      return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
    }
    function traction(nodeId) {
      const value = scoreMap[nodeId]?.traction_risk;
      return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
    }

    const startNode = nodes.get(start);
    const goalNode = nodes.get(goal);
    let baseDx = 0, baseDy = 0, baseLen = 0;
    if (startNode && goalNode) {
      const cosLat = Math.cos((startNode.lat * Math.PI) / 180);
      baseDx = (goalNode.lon - startNode.lon) * cosLat;
      baseDy = goalNode.lat - startNode.lat;
      baseLen = Math.hypot(baseDx, baseDy);
    }

    const isRover = mode !== "walk";
    const result = MarsAstar.findPath(graph, start, goal, {
      maxSlopeDeg: limit,
      heuristic: node => scale * distance(nodes.get(node), nodes.get(goal)),
      edgeCostFn: (from, to, length, slopeDeg) => {
        const fromRisk = risk(from);
        const toRisk = risk(to);
        const avgTraction = (traction(from) + traction(to)) * 0.5;
        const fromNode = nodes.get(from);
        const toNode = nodes.get(to);

        const rise = (fromNode && toNode && Number.isFinite(fromNode.elev_m) && Number.isFinite(toNode.elev_m))
          ? Math.abs(toNode.elev_m - fromNode.elev_m)
          : 0;

        if (isRover) {
          // ROVER AUTONAV:
          // 1. Rocker-bogie chassis avoids wheel entrapment in loose sand dunes / ripples (high traction penalty)
          // 2. High climb drag against elevation rises (prefer contour-following)
          const climbPenalty = length > 0 ? (rise / length) * 10.0 : 0;
          const slopeFactor = slopeDeg != null && Number.isFinite(slopeDeg) && limit > 0
            ? Math.pow(slopeDeg / limit, 2) * 2.8
            : 0;

          // 3. JPL AutoNav arc clearance corridor (lateral sweeping arc)
          let arcPenalty = 0;
          if (baseLen > 1e-7 && toNode && startNode) {
            const cosLat = Math.cos((startNode.lat * Math.PI) / 180);
            const px = (toNode.lon - startNode.lon) * cosLat;
            const py = toNode.lat - startNode.lat;
            const t = Math.max(0, Math.min(1, (px * baseDx + py * baseDy) / (baseLen * baseLen)));
            const crossDist = (px * baseDy - py * baseDx) / baseLen;
            const arcTarget = baseLen * 0.12 * Math.sin(Math.PI * t);
            const arcDev = Math.abs(crossDist - arcTarget) / (baseLen * 0.12 + 1e-6);
            arcPenalty = arcDev * 0.25;
          }

          const fromTI = scoreMap[from]?.themis_ti_val ?? 450;
          const toTI = scoreMap[to]?.themis_ti_val ?? 450;
          const avgTI = (fromTI + toTI) * 0.5;
          const sandHazard = Math.max(avgTraction, Math.max(0, (480 - avgTI) / 300));

          return length * (1.0 + slopeFactor + climbPenalty + sandHazard * 8.0 + (fromRisk + toRisk) * 1.8 + arcPenalty);
        } else {
          // MARSWALK (Astronaut on foot EVA):
          // 1. Direct Euclidean line-of-sight path (Apollo EVA style)
          // 2. Severe non-linear metabolic penalty for steep slope climbs (Tobler/Minetti metabolic fatigue)
          // 3. Astronaut steps over sand ripples without entrapment
          const slopeFactor = slopeDeg != null && Number.isFinite(slopeDeg) && limit > 0
            ? Math.pow(slopeDeg / limit, 3.0) * 15.0
            : 0;
          return length * (1.0 + slopeFactor + (fromRisk + toRisk) * 0.6 + avgTraction * 0.2);
        }
      },
    });
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
