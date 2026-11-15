importScripts("../map/geodesic.js?v=terrain2", "astar.js?v=contour-slope-v3");
let graph, nodes, scale;
function distance(a, b) {
  return MarsGeodesic.haversineMeters(a.lat, a.lon, b.lat, b.lon);
}
self.onmessage = ({ data }) => {
  const { id, start, goal, limit, scores } = data;
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
    function risk(id) {
      const value = scores[id]?.risk_0_1;
      return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
    }
    const result = MarsAstar.findPath(graph, start, goal, {
      maxSlopeDeg: limit,
      heuristic: node => scale * distance(nodes.get(node), nodes.get(goal)),
      edgeCostFn: (from, to, length, slopeDeg) => {
        const slopeFactor = slopeDeg != null && Number.isFinite(slopeDeg) && limit > 0
          ? Math.pow(slopeDeg / limit, 2) * 3.8
          : 0;
        return length * (1 + slopeFactor + (risk(from) + risk(to)) * 1.5);
      },
    });
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
