/* global self */
self.MarsAstar = (function () {
  function buildAdjacency(edges) {
    const adj = {};
    edges.forEach(function (e) {
      if (!adj[e.from]) adj[e.from] = [];
      if (!adj[e.to]) adj[e.to] = [];
      adj[e.from].push({ to: e.to, length_m: e.length_m, crossingGrade: e.crossing_grade_deg });
      adj[e.to].push({ to: e.from, length_m: e.length_m, crossingGrade: e.crossing_grade_deg });
    });
    return adj;
  }

  function connections(graph) {
    if (!graph.raster) {
      const adjacency = buildAdjacency(graph.edges);
      return id => adjacency[id] || [];
    }
    const { rows, cols } = graph.raster;
    const cells = new Array(rows * cols);
    const indices = new Map();
    for (const node of graph.nodes) {
      const [, row, col] = node.id.split("_");
      const index = Number(row) * cols + Number(col);
      cells[index] = node;
      indices.set(node.id, index);
    }
    // 32-direction multi-angle stencil (8 primary + 8 Knight's + 16 radius-3 rays)
    const moves = [
      // 8 primary cardinal & diagonal moves (radius 1: 0°, 45°, 90°, 135°, ...)
      [0, 1], [0, -1], [1, 0], [-1, 0],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
      // 8 Knight's moves (radius 2: 26.6°, 63.4°, 116.6°, 153.4°, ...)
      [1, 2], [1, -2], [-1, 2], [-1, -2],
      [2, 1], [2, -1], [-2, 1], [-2, -1],
      // 8 Camel moves (radius 3: 18.4°, 71.6°, 108.4°, 161.6°, ...)
      [1, 3], [1, -3], [-1, 3], [-1, -3],
      [3, 1], [3, -1], [-3, 1], [-3, -1],
      // 8 Zebra moves (radius 3: 33.7°, 56.3°, 123.7°, 146.3°, ...)
      [2, 3], [2, -3], [-2, 3], [-2, -3],
      [3, 2], [3, -2], [-3, 2], [-3, -2],
    ];
    const distance = (a, b) => self.MarsGeodesic.haversineMeters(a.lat, a.lon, b.lat, b.lon);
    const grade = (a, b) => Math.atan2(Math.abs(a.elev_m - b.elev_m), distance(a, b)) * 180 / Math.PI;
    return function neighbors(id) {
      const i = indices.get(id);
      if (i == null) return [];
      const r = Math.floor(i / cols), c = i % cols;
      const from = cells[i];
      const result = [];
      for (const [dr, dc] of moves) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const to = cells[nr * cols + nc];
        if (!to) continue;

        let crossingGrade = 0;
        const steps = Math.max(Math.abs(dr), Math.abs(dc));
        let valid = true;
        let prev = from;
        for (let s = 1; s < steps; s++) {
          const ir = Math.round(r + (dr * s) / steps);
          const ic = Math.round(c + (dc * s) / steps);
          const mid = cells[ir * cols + ic];
          if (!mid) { valid = false; break; }
          crossingGrade = Math.max(crossingGrade, grade(prev, mid));
          prev = mid;
        }
        if (!valid) continue;
        crossingGrade = Math.max(crossingGrade, grade(prev, to));

        result.push({ to: to.id, length_m: distance(from, to), crossingGrade });
      }
      return result;
    };
  }

  class MinHeap {
    items = [];
    push(entry) {
      const items = this.items;
      let i = items.length;
      items.push(entry);
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (items[parent].f <= entry.f) break;
        items[i] = items[parent];
        i = parent;
      }
      items[i] = entry;
    }
    pop() {
      const items = this.items;
      const first = items[0];
      const last = items.pop();
      if (items.length) {
        let i = 0;
        while (2 * i + 1 < items.length) {
          let child = 2 * i + 1;
          if (child + 1 < items.length && items[child + 1].f < items[child].f) child++;
          if (items[child].f >= last.f) break;
          items[i] = items[child];
          i = child;
        }
        items[i] = last;
      }
      return first;
    }
  }

  /**
   * @param {object} graph - { nodes, edges }
   * @param {string} startId
   * @param {string} goalId
   * @param {object} opts - { maxSlopeDeg, edgeCostFn(fromId, toId, length_m) }
   */
  function findPath(graph, startId, goalId, opts) {
    const nodesById = {};
    graph.nodes.forEach(function (n) {
      nodesById[n.id] = n;
    });
    const neighborsOf = connections(graph);
    const maxSlope = opts.maxSlopeDeg != null ? opts.maxSlopeDeg : 90;
    const edgeCost =
      opts.edgeCostFn ||
      function (_from, _to, len) {
        return len;
      };

    function edgeSlopeDeg(aId, bId, lengthM) {
      const a = nodesById[aId];
      const b = nodesById[bId];
      if (!Number.isFinite(a?.elev_m) || !Number.isFinite(b?.elev_m) || !Number.isFinite(lengthM) || lengthM <= 0) return Infinity;
      const rise = Math.abs((b.elev_m || 0) - (a.elev_m || 0));
      return (Math.atan(rise / lengthM) * 180) / Math.PI;
    }

    function slopeOk(aId, bId, lengthM) {
      return edgeSlopeDeg(aId, bId, lengthM) <= maxSlope;
    }

    if (!nodesById[startId] || !nodesById[goalId]) return { found: false, path: [] };
    const heuristic = opts.heuristic || (() => 0);
    const open = new MinHeap();
    open.push({ id: startId, g: 0, f: heuristic(startId) });
    const cameFrom = {};
    const gScore = {};
    gScore[startId] = 0;

    const closed = new Set();

    while (open.items.length) {
      const { id: current, g } = open.pop();
      if (g !== gScore[current]) continue;
      if (current === goalId) {
        const path = [goalId];
        let c = goalId;
        while (cameFrom[c] != null) {
          c = cameFrom[c];
          path.push(c);
        }
        path.reverse();
        return { found: true, path };
      }
      if (closed.has(current)) continue;
      closed.add(current);

      const neighbors = neighborsOf(current);
      neighbors.forEach(function (edge) {
        if (edge.crossingGrade > maxSlope || !slopeOk(current, edge.to, edge.length_m)) return;
        const tentative =
          (gScore[current] || 0) + edgeCost(current, edge.to, edge.length_m);
        if (gScore[edge.to] == null || tentative < gScore[edge.to]) {
          cameFrom[edge.to] = current;
          gScore[edge.to] = tentative;
          open.push({ id: edge.to, g: tentative, f: tentative + heuristic(edge.to) });
        }
      });
    }
    return { found: false, path: [] };
  }

  function pathLengthM(graph, pathIds) {
    const nodesById = {};
    graph.nodes.forEach(function (n) {
      nodesById[n.id] = n;
    });
    const distance = (a, b) => self.MarsGeodesic.haversineMeters(a.lat, a.lon, b.lat, b.lon);
    let total = 0;
    for (let i = 0; i < pathIds.length - 1; i++) {
      const a = nodesById[pathIds[i]];
      const b = nodesById[pathIds[i + 1]];
      if (a && b) {
        total += distance(a, b);
      }
    }
    return total;
  }

  function pathStats(graph, pathIds) {
    const nodesById = {};
    graph.nodes.forEach(function (n) {
      nodesById[n.id] = n;
    });
    const distance = (a, b) => self.MarsGeodesic.haversineMeters(a.lat, a.lon, b.lat, b.lon);
    let maxSlope = 0;
    let elevs = [];
    pathIds.forEach(function (id) {
      const n = nodesById[id];
      if (n) {
        elevs.push(n.elev_m || 0);
      }
    });
    for (let i = 0; i < pathIds.length - 1; i++) {
      const a = nodesById[pathIds[i]];
      const b = nodesById[pathIds[i + 1]];
      if (a && b) {
        const len = distance(a, b);
        if (len > 0) {
          const rise = Math.abs((b.elev_m || 0) - (a.elev_m || 0));
          maxSlope = Math.max(maxSlope, (Math.atan(rise / len) * 180) / Math.PI);
        }
      }
    }
    const elevDelta =
      elevs.length >= 2
        ? Math.abs(elevs[elevs.length - 1] - elevs[0])
        : 0;
    return { max_slope_deg: maxSlope, elev_delta_m: elevDelta };
  }

  return { findPath, pathLengthM, pathStats };
})();