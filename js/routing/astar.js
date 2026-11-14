/* global window */
window.MarsAstar = (function () {
  function buildAdjacency(edges) {
    const adj = {};
    edges.forEach(function (e) {
      if (!adj[e.from]) adj[e.from] = [];
      if (!adj[e.to]) adj[e.to] = [];
      adj[e.from].push({ to: e.to, length_m: e.length_m });
      adj[e.to].push({ to: e.from, length_m: e.length_m });
    });
    return adj;
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
    const adj = buildAdjacency(graph.edges);
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

    const open = [{ id: startId, f: 0 }];
    const cameFrom = {};
    const gScore = {};
    gScore[startId] = 0;

    const closed = new Set();

    while (open.length > 0) {
      open.sort(function (x, y) {
        return x.f - y.f;
      });
      const current = open.shift().id;
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

      const neighbors = adj[current] || [];
      neighbors.forEach(function (edge) {
        if (!slopeOk(current, edge.to, edge.length_m)) return;
        const tentative =
          (gScore[current] || 0) + edgeCost(current, edge.to, edge.length_m);
        if (gScore[edge.to] == null || tentative < gScore[edge.to]) {
          cameFrom[edge.to] = current;
          gScore[edge.to] = tentative;
          const f = tentative;
          const existing = open.find(function (o) {
            return o.id === edge.to;
          });
          if (existing) {
            existing.f = f;
          } else {
            open.push({ id: edge.to, f: f });
          }
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
    const key = function (a, b) {
      return a < b ? a + "|" + b : b + "|" + a;
    };
    const edgeLen = {};
    graph.edges.forEach(function (e) {
      edgeLen[key(e.from, e.to)] = e.length_m;
    });
    let total = 0;
    for (let i = 0; i < pathIds.length - 1; i++) {
      const len = edgeLen[key(pathIds[i], pathIds[i + 1])];
      if (len != null) total += len;
    }
    return total;
  }

  function pathStats(graph, pathIds) {
    const nodesById = {};
    graph.nodes.forEach(function (n) {
      nodesById[n.id] = n;
    });
    const key = function (a, b) {
      return a < b ? a + "|" + b : b + "|" + a;
    };
    const edgeLen = {};
    graph.edges.forEach(function (e) {
      edgeLen[key(e.from, e.to)] = e.length_m;
    });
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
      const len = edgeLen[key(pathIds[i], pathIds[i + 1])];
      if (a && b && len) {
        const rise = Math.abs((b.elev_m || 0) - (a.elev_m || 0));
        maxSlope = Math.max(maxSlope, (Math.atan(rise / len) * 180) / Math.PI);
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