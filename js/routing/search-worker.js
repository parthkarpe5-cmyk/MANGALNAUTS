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

    const isRover = mode !== "walk";
    const result = MarsAstar.findPath(graph, start, goal, {
      maxSlopeDeg: limit,
      heuristic: node => scale * distance(nodes.get(node), nodes.get(goal)),
      edgeCostFn: (from, to, length, slopeDeg) => {
        const fromRisk = risk(from);
        const toRisk = risk(to);
        const avgTraction = (traction(from) + traction(to)) * 0.5;

        if (isRover) {
          // ROVER AUTONAV:
          // Rocker-bogie chassis avoids wheel entrapment in loose sand dunes / ripples (high traction penalty)
          // Tolerates moderate slopes with quadratic mechanical drag
          const slopeFactor = slopeDeg != null && Number.isFinite(slopeDeg) && limit > 0
            ? Math.pow(slopeDeg / limit, 2) * 2.8
            : 0;
          return length * (1.0 + slopeFactor + (fromRisk + toRisk) * 1.8 + avgTraction * 5.0);
        } else {
          // MARSWALK (Astronaut on foot EVA):
          // Human EVA metabolism: steep non-linear penalty for climbing slopes (Tobler/Minetti metabolic work)
          // Astronaut steps easily over sand ripples (near-zero traction penalty)
          // Prioritizes direct, flat routes to conserve EVA oxygen timeline
          const slopeFactor = slopeDeg != null && Number.isFinite(slopeDeg) && limit > 0
            ? Math.pow(slopeDeg / limit, 2.5) * 8.5
            : 0;
          return length * (1.0 + slopeFactor + (fromRisk + toRisk) * 1.0 + avgTraction * 0.2);
        }
      },
    });
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
