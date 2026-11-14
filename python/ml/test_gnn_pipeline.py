"""
Test suite for Person 1 (GNN Model Architect) pipeline.
Validates that GNN inference runs, ingests Member 4 environmental data,
and produces schema-compliant data/jezero/v1/gnn_scores.json.
"""

import os
import json
import unittest
from train_gnn import JezeroTerrainGNN, build_multimodal_features

class TestGNNPipeline(unittest.TestCase):
    def setUp(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.graph_path = os.path.join(self.base_dir, "data", "jezero", "v1", "terrain_graph.json")
        self.env_path = os.path.join(self.base_dir, "data", "jezero", "v1", "environment.json")
        self.scores_path = os.path.join(self.base_dir, "data", "jezero", "v1", "gnn_scores.json")

    def test_environment_integration(self):
        """Verify that Member 4's environment features are properly extracted into tensors."""
        with open(self.graph_path, "r", encoding="utf-8") as f:
            graph = json.load(f)
        with open(self.env_path, "r", encoding="utf-8") as f:
            env = json.load(f)

        X, A_hat = build_multimodal_features(graph, env)
        self.assertEqual(X.shape[0], len(graph["nodes"]))
        self.assertEqual(X.shape[1], 6)
        self.assertEqual(A_hat.shape[0], len(graph["nodes"]))
        self.assertEqual(A_hat.shape[1], len(graph["nodes"]))

        # Verify normalized bounds
        self.assertTrue(np_all_in_bounds(X, 0.0, 1.0))

    def test_forward_pass_and_scores_bounds(self):
        """Verify GNN forward pass produces risk in [0, 1] and science in [0, 100]."""
        with open(self.graph_path, "r", encoding="utf-8") as f:
            graph = json.load(f)
        with open(self.env_path, "r", encoding="utf-8") as f:
            env = json.load(f)

        X, A_hat = build_multimodal_features(graph, env)
        model = JezeroTerrainGNN(in_features=6, hidden_dim=16)
        risk, science = model.forward(X, A_hat)

        self.assertEqual(len(risk), len(graph["nodes"]))
        self.assertEqual(len(science), len(graph["nodes"]))
        self.assertTrue(all(0.0 <= r <= 1.0 for r in risk))
        self.assertTrue(all(0.0 <= s <= 100.0 for s in science))

    def test_exported_scores_schema(self):
        """Verify that gnn_scores.json strictly conforms to plan.md line 178."""
        self.assertTrue(os.path.exists(self.scores_path), f"Missing {self.scores_path}")
        with open(self.scores_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIn("nodes", data)
        self.assertIn("model_meta", data)
        for nid, val in data["nodes"].items():
            self.assertIn("risk_0_1", val)
            self.assertIn("science_0_100", val)
            self.assertTrue(0.0 <= val["risk_0_1"] <= 1.0)
            self.assertTrue(0.0 <= val["science_0_100"] <= 100.0)

def np_all_in_bounds(arr, low, high):
    return (arr >= low).all() and (arr <= high).all()

if __name__ == "__main__":
    unittest.main()
