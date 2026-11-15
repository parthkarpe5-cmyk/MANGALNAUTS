window.MarsRouteWorker = (() => {
  let worker;
  let loadedGraph;
  let nextId = 0;
  const pending = new Map();
  function solve(graph, start, goal, limit, scores, mode) {
    return new Promise((resolve, reject) => {
      if (!worker) {
        worker = new Worker("js/routing/search-worker.js?v=mode-physics-v5");
        worker.onmessage = ({ data }) => {
          const job = pending.get(data.id);
          if (!job) return;
          pending.delete(data.id);
          if (data.error) job.reject(new Error(data.error));
          else job.resolve(data.result);
        };
        worker.onerror = () => {
          worker.terminate();
          worker = loadedGraph = null;
          for (const job of pending.values()) job.reject(new Error("Routing worker unavailable"));
          pending.clear();
        };
      }
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, graph: graph === loadedGraph ? null : graph, start, goal, limit, scores, mode: mode || "rover" });
      loadedGraph = graph;
    });
  }
  return { solve };
})();
