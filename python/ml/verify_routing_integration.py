"""
Verification script for end-to-end A* routing and GNN integration.
Replicates MarsRouteBetween.solve() from js/routing/routeBetween.js
"""

import os
import json
import math
import heapq

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    manifest_path = os.path.join(base_dir, "data", "manifest.json")
    graph_path = os.path.join(base_dir, "data", "jezero", "v1", "terrain_graph.json")
    scores_path = os.path.join(base_dir, "data", "jezero", "v1", "gnn_scores.json")
    stops_path = os.path.join(base_dir, "data", "jezero", "v1", "science_stops.geojson")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    with open(graph_path, "r", encoding="utf-8") as f:
        graph = json.load(f)
    with open(scores_path, "r", encoding="utf-8") as f:
        scores = json.load(f)
    with open(stops_path, "r", encoding="utf-8") as f:
        stops_geo = json.load(f)

    bounds = graph.get("bbox") or manifest.get("bbox")
    def in_coverage(lat, lon):
        return (
            bounds is None or
            (lat >= bounds["south"] and lat <= bounds["north"] and
             lon >= bounds["west"] and lon <= bounds["east"])
        )

    R_M = 3396190.0
    def haversine(lat1, lon1, lat2, lon2):
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2)**2
        return 2 * R_M * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def snap_nearest(nodes, lat, lon):
        best = None
        best_d = float("inf")
        for n in nodes:
            d = haversine(lat, lon, n["lat"], n["lon"])
            if d < best_d:
                best_d = d
                best = n
        return best, best_d

    # 1. Check graph_id handshake
    g_id = graph.get("graph_id")
    s_id = scores.get("graph_id")
    scores_active = (g_id is not None and s_id == g_id)
    print(f"Graph ID Handshake: graph_id='{g_id}', scores_id='{s_id}', handshake_valid={scores_active}")
    assert scores_active, "Handshake failed: GNN scores will be dropped by routeBetween.js!"

    nodes_by_id = {n["id"]: n for n in graph["nodes"]}
    score_nodes = scores.get("nodes", {})

    adj = {n["id"]: [] for n in graph["nodes"]}
    edge_len = {}
    def edge_key(a, b):
        return f"{a}|{b}" if a < b else f"{b}|{a}"

    for e in graph["edges"]:
        edge_len[edge_key(e["from"], e["to"])] = e["length_m"]
        adj[e["from"]].append((e["to"], e["length_m"], e["slope_deg"]))
        adj[e["to"]].append((e["from"], e["length_m"], e["slope_deg"]))

    def solve(latA, lonA, latB, lonB, max_slope=20.0):
        if not in_coverage(latA, lonA) or not in_coverage(latB, lonB):
            return {"status": "out_of_coverage", "error": "Choose both points inside the terrain coverage."}
        
        nodeA, dA = snap_nearest(graph["nodes"], latA, lonA)
        nodeB, dB = snap_nearest(graph["nodes"], latB, lonB)
        
        def edge_cost(u, v, length_m):
            from_risk = score_nodes.get(u, {}).get("risk_0_1", 0.0)
            to_risk = score_nodes.get(v, {}).get("risk_0_1", 0.0)
            return length_m * (1.0 + from_risk + to_risk)
        
        open_heap = [(0, nodeA["id"])]
        came_from = {}
        g_score = {nodeA["id"]: 0}
        
        while open_heap:
            _, cur = heapq.heappop(open_heap)
            if cur == nodeB["id"]:
                path = [cur]
                while cur in came_from:
                    cur = came_from[cur]
                    path.append(cur)
                path = path[::-1]
                
                tot_len = 0
                max_s = 0
                for i in range(len(path) - 1):
                    u, v = path[i], path[i+1]
                    l = edge_len[edge_key(u, v)]
                    tot_len += l
                    rise = abs(nodes_by_id[v]["elev_m"] - nodes_by_id[u]["elev_m"])
                    max_s = max(max_s, math.degrees(math.atan2(rise, l)))
                elev_delta = abs(nodes_by_id[path[-1]]["elev_m"] - nodes_by_id[path[0]]["elev_m"])
                mean_risk = sum(score_nodes[nid]["risk_0_1"] for nid in path) / len(path)
                
                return {
                    "status": "ok",
                    "path_found": True,
                    "nodes_count": len(path),
                    "path_m": round(tot_len, 1),
                    "max_slope_deg": round(max_s, 1),
                    "elev_delta_m": round(elev_delta, 1),
                    "mean_risk": round(mean_risk, 3),
                    "snap_dA_m": round(dA, 1),
                    "snap_dB_m": round(dB, 1)
                }
            
            for neighbor, length_m, slope_deg in adj[cur]:
                if slope_deg > max_slope:
                    continue
                cost = edge_cost(cur, neighbor, length_m)
                tentative = g_score[cur] + cost
                if neighbor not in g_score or tentative < g_score[neighbor]:
                    came_from[neighbor] = cur
                    g_score[neighbor] = tentative
                    h = haversine(nodes_by_id[neighbor]["lat"], nodes_by_id[neighbor]["lon"], nodeB["lat"], nodeB["lon"])
                    heapq.heappush(open_heap, (tentative + h, neighbor))
                    
        return {"status": "no_route", "path_found": False}

    print("\nPairwise Routing Verification Between Science Stops:")
    stops = stops_geo["features"]
    for i in range(len(stops)):
        for j in range(i + 1, len(stops)):
            s1 = stops[i]["properties"]
            s2 = stops[j]["properties"]
            c1 = stops[i]["geometry"]["coordinates"]
            c2 = stops[j]["geometry"]["coordinates"]
            res = solve(c1[1], c1[0], c2[1], c2[0], max_slope=20.0)
            print(f"  • {s1['name']} -> {s2['name']}: {res['status']}, dist={res.get('path_m')}m, mean_risk={res.get('mean_risk')}, max_slope={res.get('max_slope_deg')}°")
            assert res["status"] == "ok", f"Route failed between {s1['name']} and {s2['name']}"

    print("\nALL ROUTES AND INTEGRATION CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    main()
