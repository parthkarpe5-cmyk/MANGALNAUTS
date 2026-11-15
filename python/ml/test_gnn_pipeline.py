"""
Test suite for Person 1 (GNN Model Architect) pipeline.
Validates that GNN inference runs, ingests Member 4 environmental data,
ingests Member 3 THEMIS/CRISM orbital features, and produces schema-compliant
and routing-compatible data/jezero/v1/gnn_scores.json.
"""

import os
import sys
import json
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from train_gnn import JezeroTerrainGNN, build_multimodal_features


class TestGNNPipeline(unittest.TestCase):
    def setUp(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.graph_path = os.path.join(self.base_dir, "data", "jezero", "v1", "terrain_graph.json")
        self.env_path = os.path.join(self.base_dir, "data", "jezero", "v1", "environment.json")
        self.scores_path = os.path.join(self.base_dir, "data", "jezero", "v1", "gnn_scores.json")

    def test_multimodal_features_integration(self):
        """Verify that 8D multi-modal features are properly extracted into tensors."""
        with open(self.graph_path, "r", encoding="utf-8") as f:
            graph = json.load(f)
        with open(self.env_path, "r", encoding="utf-8") as f:
            env = json.load(f)

        X, A_hat = build_multimodal_features(graph, env)
        self.assertEqual(X.shape[0], len(graph["nodes"]))
        self.assertEqual(X.shape[1], 8, "Expected 8 multi-modal feature channels")
        self.assertEqual(A_hat.shape[0], len(graph["nodes"]))
        self.assertEqual(A_hat.shape[1], len(graph["nodes"]))

        # Verify normalized bounds [0, 1]
        self.assertTrue(np_all_in_bounds(X, 0.0, 1.0))

    def test_forward_pass_and_scores_bounds(self):
        """Verify GNN forward pass produces risk in [0, 1] and science in [0, 100]."""
        with open(self.graph_path, "r", encoding="utf-8") as f:
            graph = json.load(f)
        with open(self.env_path, "r", encoding="utf-8") as f:
            env = json.load(f)

        X, A_hat = build_multimodal_features(graph, env)
        model = JezeroTerrainGNN(in_features=8, hidden_dim=16)
        risk, science = model.forward(X, A_hat)

        self.assertEqual(len(risk), len(graph["nodes"]))
        self.assertEqual(len(science), len(graph["nodes"]))
        self.assertTrue(all(0.0 <= r <= 1.0 for r in risk))
        self.assertTrue(all(0.0 <= s <= 100.0 for s in science))

    def test_exported_scores_schema_and_graph_id_contract(self):
        """Verify that gnn_scores.json strictly matches graph_id for A* routing integration."""
        self.assertTrue(os.path.exists(self.scores_path), f"Missing {self.scores_path}")
        with open(self.graph_path, "r", encoding="utf-8") as f:
            graph = json.load(f)
        with open(self.scores_path, "r", encoding="utf-8") as f:
            scores = json.load(f)

        # CRITICAL ROUTING CONTRACT:
        # routeBetween.js line 66 requires: graph.graph_id != null && candidate.graph_id === graph.graph_id
        self.assertIsNotNone(graph.get("graph_id"), "terrain_graph.json must define top-level graph_id")
        self.assertIsNotNone(scores.get("graph_id"), "gnn_scores.json must define top-level graph_id")
        self.assertEqual(graph["graph_id"], scores["graph_id"], "graph_id mismatch blocks A* routing scores")

        self.assertIn("nodes", scores)
        self.assertIn("model_meta", scores)
        self.assertEqual(len(scores["nodes"]), len(graph["nodes"]))

        for nid, val in scores["nodes"].items():
            self.assertIn("risk_0_1", val)
            self.assertIn("science_0_100", val)
            self.assertTrue(0.0 <= val["risk_0_1"] <= 1.0)
            self.assertTrue(0.0 <= val["science_0_100"] <= 100.0)


def np_all_in_bounds(arr, low, high):
    return (arr >= low).all() and (arr <= high).all()


if __name__ == "__main__":
    unittest.main()
