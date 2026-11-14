"""
MANGALNAUTS — Martian Mission OS
Person 1: GNN Model Architect

Script: python/ml/train_gnn.py
Description:
  Graph Neural Network (GCN/GAT) implementation for Jezero Crater terrain evaluation.
  Integrates orbital geometry (P3) with live in-situ environmental & radiation
  telemetry published by Member 4 (data/jezero/v1/environment.json).
"""

import os
import json
import math
import datetime
import numpy as np

class JezeroTerrainGNN:
    """
    2-Layer Graph Convolutional Network (GCN) with Multi-Task Prediction Heads:
      Head 1: Traversability Risk [0.0, 1.0] (for rover & spacesuit safety)
      Head 2: Astrobiological Science Potential [0.0, 100.0%] (delta sediments & carbonates)
    
    Node Features X (6D):
      [0] Normalized Elevation (elev_m)
      [1] Normalized Slope (slope_deg)
      [2] Surface Temperature (°C, adiabatic elevation lapse rate from Member 4)
      [3] Radiation Dose Proxy (μSv/hr, terrain & atmospheric shielded from Member 4)
      [4] Atmospheric Pressure (Pa, barometric scaled from Member 4)
      [5] Dust Optical Depth (tau, from Member 4)
    """
    def __init__(self, in_features=6, hidden_dim=16, seed=42):
        self.in_features = in_features
        self.hidden_dim = hidden_dim
        
        np.random.seed(seed)
        scale_0 = math.sqrt(2.0 / (in_features + hidden_dim))
        self.W0 = np.random.uniform(-scale_0, scale_0, (in_features, hidden_dim))
        
        scale_1 = math.sqrt(2.0 / (hidden_dim + hidden_dim))
        self.W1 = np.random.uniform(-scale_1, scale_1, (hidden_dim, hidden_dim))
        
        # Head 1: Traversability Risk Projection
        self.W_risk = np.random.uniform(-0.25, 0.25, (hidden_dim, 1))
        self.b_risk = -0.3
        
        # Head 2: Science Potential Projection
        self.W_science = np.random.uniform(-0.25, 0.25, (hidden_dim, 1))
        self.b_science = 0.1

    @staticmethod
    def relu(x):
        return np.maximum(0.0, x)

    @staticmethod
    def sigmoid(x):
        return 1.0 / (1.0 + np.exp(-np.clip(x, -15.0, 15.0)))

    def forward(self, X, A_hat):
        """
        Forward propagation across graph topology:
          H1 = ReLU(A_hat @ X @ W0)
          H2 = ReLU(A_hat @ H1 @ W1)
          risk = Sigmoid(H2 @ W_risk + residuals)
          science = Sigmoid(H2 @ W_science + residuals) * 100.0
        """
        H1 = self.relu(A_hat @ X @ self.W0)
        H2 = self.relu(A_hat @ H1 @ self.W1)

        # 1. Traversability Risk Calculation with Physical Grounding:
        # High slope (>15° for suit, >20° for rover) and elevated radiation increase risk
        risk_raw = (H2 @ self.W_risk) + self.b_risk
        slope_penalty = X[:, 1:2] * 2.8           # normalized slope gradient
        cold_penalty = (1.0 - X[:, 2:3]) * 0.8    # extreme cold penalty below -60°C
        rad_penalty = X[:, 3:4] * 0.9             # radiation flux penalty
        
        risk_logits = risk_raw + slope_penalty + cold_penalty + rad_penalty
        risk_scores = self.sigmoid(risk_logits).flatten()

        # 2. Astrobiological Science Value Calculation:
        # Crater delta lowlands (low elevation, moderate slope) have highest water sediment preservation
        science_raw = (H2 @ self.W_science) + self.b_science
        delta_proximity_bonus = (1.0 - X[:, 0:1]) * 1.6  # lower elevation delta deposits
        science_logits = science_raw + delta_proximity_bonus - 0.2
        science_scores = (self.sigmoid(science_logits).flatten() * 100.0)

        return np.clip(risk_scores, 0.0, 1.0), np.clip(science_scores, 0.0, 100.0)

def build_multimodal_features(terrain_graph, env_data):
    """
    Constructs feature tensor X and normalized adjacency matrix A_hat
    merging P3 terrain graph with Member 4 environmental data.
    """
    nodes = terrain_graph["nodes"]
    edges = terrain_graph["edges"]
    N = len(nodes)
    node_id_to_idx = {n["id"]: i for i, n in enumerate(nodes)}

    # Member 4 environmental baseline constants
    base_temp_C = float(env_data.get("temp_C", -52.0))
    base_rad = float(env_data.get("rad_dose_proxy", 28.5))
    base_press = float(env_data.get("pressure_pa", 778.9))
    base_tau = float(env_data.get("dust_optical_depth_tau", 0.65))

    X = np.zeros((N, 6), dtype=np.float32)

    for i, node in enumerate(nodes):
        elev = float(node.get("elev_m", -2500.0))
        slope = float(node.get("slope_deg", 5.0))

        # Physical scaling for node environmental features:
        # 1. Adiabatic lapse rate: ~ -1.5°C per 1,000m climb above base (-2500m)
        delta_elev_km = (elev - (-2500.0)) / 1000.0
        node_temp = base_temp_C - (delta_elev_km * 1.5)

        # 2. Radiation: Higher elevation has less atmospheric column shielding;
        #    Steep terrain provides cliff line-of-sight shadowing
        shielding_factor = max(0.2, 1.0 - (slope / 70.0))
        node_rad = base_rad * (1.0 + (delta_elev_km * 0.05)) * shielding_factor

        # 3. Barometric pressure: P = P0 * exp(-z / H), scale height H ~ 11.1 km
        node_press = base_press * math.exp(-delta_elev_km / 11.1)

        # Normalize features to [0.0, 1.0] for stable GNN propagation
        norm_elev = (elev - (-2800.0)) / 1200.0       # range roughly -2800 to -1600m
        norm_slope = min(slope / 30.0, 1.0)           # 0 to 30 degrees
        norm_temp = (node_temp - (-90.0)) / 70.0      # -90°C to -20°C
        norm_rad = node_rad / 35.0                    # 0 to 35 uSv/hr
        norm_press = (node_press - 650.0) / 250.0     # 650 to 900 Pa
        norm_tau = base_tau / 2.0                     # 0 to 2.0 tau

        X[i] = [
            np.clip(norm_elev, 0.0, 1.0),
            np.clip(norm_slope, 0.0, 1.0),
            np.clip(norm_temp, 0.0, 1.0),
            np.clip(norm_rad, 0.0, 1.0),
            np.clip(norm_press, 0.0, 1.0),
            np.clip(norm_tau, 0.0, 1.0)
        ]

    # Build Adjacency Matrix with Self-Loops: A_tilde = A + I
    A = np.eye(N, dtype=np.float32)
    for edge in edges:
        u = node_id_to_idx.get(edge["from"])
        v = node_id_to_idx.get(edge["to"])
        if u is not None and v is not None:
            A[u, v] = 1.0
            A[v, u] = 1.0

    # Symmetric Normalization: A_hat = D^(-1/2) * A * D^(-1/2)
    degrees = np.sum(A, axis=1)
    d_inv_sqrt = np.power(degrees, -0.5)
    d_inv_sqrt[np.isinf(d_inv_sqrt)] = 0.0
    D_mat = np.diag(d_inv_sqrt)
    A_hat = D_mat @ A @ D_mat

    return X, A_hat
