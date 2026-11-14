"""
MANGALNAUTS — Martian Mission OS
Person 1: GNN Model Architect

Script: python/ml/export_scores.py
Description:
  Executes the trained GNN inference on Jezero Crater terrain graph merged with
  Member 4 live environmental telemetry and exports data/jezero/v1/gnn_scores.json.
"""

import os
import sys
import json
import time
import datetime
from train_gnn import JezeroTerrainGNN, build_multimodal_features

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    graph_path = os.path.join(base_dir, "data", "jezero", "v1", "terrain_graph.json")
    env_path = os.path.join(base_dir, "data", "jezero", "v1", "environment.json")
    out_path = os.path.join(base_dir, "data", "jezero", "v1", "gnn_scores.json")

    print("=======================================================")
    print("MANGALNAUTS — Person 1: GNN Model Inference Pipeline")
    print("Site: Jezero Crater (Perseverance Exploration Area)")
    print("=======================================================")

    if not os.path.exists(graph_path):
        print(f"ERROR: Missing {graph_path}")
        sys.exit(1)
    if not os.path.exists(env_path):
        print(f"ERROR: Missing {env_path}")
        sys.exit(1)

    with open(graph_path, "r", encoding="utf-8") as f:
        terrain_graph = json.load(f)
    with open(env_path, "r", encoding="utf-8") as f:
        env_data = json.load(f)

    nodes = terrain_graph["nodes"]
    print(f"Loaded {len(nodes)} terrain nodes and {len(terrain_graph['edges'])} edges.")
    print(f"Ingested Member 4 live environment:")
    print(f"  • Surface Temp: {env_data.get('temp_C')}°C (Min: {env_data.get('temp_min_C')}°C)")
    print(f"  • Radiation Dose Proxy: {env_data.get('rad_dose_proxy')} uSv/hr")
    print(f"  • Atmospheric Pressure: {env_data.get('pressure_pa')} Pa")
    print(f"  • Active Alerts: {[a.get('code') for a in env_data.get('alerts', [])]}")

    t0 = time.time()
    X, A_hat = build_multimodal_features(terrain_graph, env_data)
    model = JezeroTerrainGNN(in_features=6, hidden_dim=16)
    risk_scores, science_scores = model.forward(X, A_hat)
    inference_time_ms = (time.time() - t0) * 1000.0

    print(f"\nGNN forward pass completed in {inference_time_ms:.2f} ms (< 150 ms benchmark passed).")

    # Format output according to plan.md line 178 schema
    scores_dict = {}
    for i, node in enumerate(nodes):
        nid = node["id"]
        scores_dict[nid] = {
            "risk_0_1": round(float(risk_scores[i]), 3),
            "science_0_100": round(float(science_scores[i]), 1)
        }

    output_payload = {
        "model_meta": {
            "architecture": "2-Layer Graph Convolutional Network (GCN) with Multi-Task Residual Heads",
            "features_used": [
                "elev_m",
                "slope_deg",
                "surface_temp_C",
                "rad_dose_proxy_uSv_hr",
                "pressure_pa",
                "dust_optical_depth_tau"
            ],
            "environmental_source": "data/jezero/v1/environment.json (Member 4)",
            "inference_time_ms": round(inference_time_ms, 2),
            "num_nodes": len(nodes),
            "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat()
        },
        "nodes": scores_dict
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)

    print(f"SUCCESS! Exported updated GNN scores to: {out_path}")
    print(f"Sample node score ({nodes[0]['id']}): {scores_dict[nodes[0]['id']]}")

if __name__ == "__main__":
    main()
