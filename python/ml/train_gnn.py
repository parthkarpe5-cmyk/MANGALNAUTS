"""
MANGALNAUTS — Martian Mission OS
Person 1: GNN Model Architect

Script: python/ml/train_gnn.py
Description:
  Physics-informed 2-Layer Graph Convolutional Network (GCN) for Jezero Crater terrain
  evaluation and autonomous traversal risk scoring.
  
  Integrates:
    - NASA PDS Geosciences orbital topography (MOLA / HRSC MDEM elevation & slope)
    - THEMIS Thermal Inertia (TI) soil mechanics proxy (sand dunes vs. bedrock duricrust)
    - CRISM Hyperspectral Mineralogy (Fe/Mg smectite clays & carbonate margins)
    - NASA Perseverance MEDA & NOAA SWPC in-situ atmospheric & radiation telemetry
"""

import os
import json
import math
import numpy as np


class JezeroTerrainGNN:
    """
    2-Layer Graph Convolutional Network (GCN) with Multi-Task Prediction Heads:
      Head 1: Traversability Risk [0.0, 1.0] (terramechanics, slope, sinkage, radiation)
      Head 2: Astrobiological Science Potential [0.0, 100.0%] (clay/carbonate bio-signatures)
    
    Node Features X (8D):
      [0] Normalized Elevation (elev_m relative to Jezero datum)
      [1] Normalized Slope (slope_deg / 25.0)
      [2] THEMIS Thermal Inertia Proxy (TI / 600.0, soil cohesion vs. powder)
      [3] Traction Risk Factor (wheel sinkage & slip probability [0.0, 1.0])
      [4] CRISM Science Score (sedimentary biosignature target ranking [0.0, 1.0])
      [5] Local Surface Temperature (°C, adiabatic lapse rate from Member 4)
      [6] Effective Radiation Dose Proxy (μSv/hr, topography & atmospheric shielding)
      [7] Atmospheric Surface Pressure (Pa, barometric scale height)
    """

    def __init__(self, in_features=8, hidden_dim=16, seed=42):
        self.in_features = in_features
        self.hidden_dim = hidden_dim

        np.random.seed(seed)
        scale_0 = math.sqrt(2.0 / (in_features + hidden_dim))
        self.W0 = np.random.uniform(-scale_0, scale_0, (in_features, hidden_dim)).astype(np.float32)

        scale_1 = math.sqrt(2.0 / (hidden_dim + hidden_dim))
        self.W1 = np.random.uniform(-scale_1, scale_1, (hidden_dim, hidden_dim)).astype(np.float32)

        # Head 1: Traversability Risk Projection (Graph message passing residual)
        self.W_risk = np.random.uniform(-0.20, 0.20, (hidden_dim, 1)).astype(np.float32)
        self.b_risk = -1.4

        # Head 2: Science Potential Projection
        self.W_science = np.random.uniform(-0.20, 0.20, (hidden_dim, 1)).astype(np.float32)
        self.b_science = -1.2

    @staticmethod
    def relu(x):
        return np.maximum(0.0, x)

    @staticmethod
    def sigmoid(x):
        return 1.0 / (1.0 + np.exp(-np.clip(x, -12.0, 12.0)))

    def forward(self, X, A_hat):
        """
        Forward propagation across graph topology:
          H1 = ReLU(A_hat @ X @ W0)
          H2 = ReLU(A_hat @ H1 @ W1)
          
          Risk: Combines Bekker-Wong soil mechanics (THEMIS TI + traction slip),
                slope penalties, and topological neighbor roughness (H2).
          
          Science: Combines CRISM spectroscopic identification (smectite/carbonate),
                   fluvial deposition proximity, and neighbor context (H2).
        """
        H1 = self.relu(A_hat @ X @ self.W0)
        H2 = self.relu(A_hat @ H1 @ self.W1)

        # 1. Traversability Risk Calculation:
        # High slope (>15° walk, >20° rover), high traction risk (sand dunes), and radiation
        risk_spatial = H2 @ self.W_risk
        slope_penalty = X[:, 1:2] * 2.4
        traction_penalty = X[:, 3:4] * 1.8
        rad_penalty = X[:, 6:7] * 0.5
        cold_penalty = (1.0 - X[:, 5:6]) * 0.4

        risk_logits = risk_spatial + self.b_risk + slope_penalty + traction_penalty + rad_penalty + cold_penalty
        risk_scores = self.sigmoid(risk_logits).flatten()

        # 2. Astrobiological Science Potential:
        # CRISM hyperspectral evidence + delta fluvial lowland preservation bonus
        science_spatial = H2 @ self.W_science
        crism_bonus = X[:, 4:5] * 4.2
        fluvial_sediment_bonus = (1.0 - X[:, 0:1]) * 0.8

        science_logits = science_spatial + self.b_science + crism_bonus + fluvial_sediment_bonus
        science_scores = self.sigmoid(science_logits).flatten() * 100.0

        return np.clip(risk_scores, 0.0, 1.0), np.clip(science_scores, 0.0, 100.0)


def build_multimodal_features(terrain_graph, env_data):
    """
    Constructs multi-modal feature tensor X (N x 8) and normalized graph adjacency A_hat (N x N)
    merging P3 orbital topography, THEMIS, CRISM, and Member 4 live in-situ telemetry.
    """
    nodes = terrain_graph["nodes"]
    edges = terrain_graph["edges"]
    N = len(nodes)
    node_id_to_idx = {n["id"]: i for i, n in enumerate(nodes)}

    # Member 4 environmental baseline constants
    base_temp_C = float(env_data.get("temp_C", -24.2))
    base_rad = float(env_data.get("rad_dose_proxy", 10.5))
    base_press = float(env_data.get("pressure_pa", 618.5))

    X = np.zeros((N, 8), dtype=np.float32)

    for i, node in enumerate(nodes):
        elev = float(node.get("elev_m", -2530.0))
        slope = float(node.get("slope_deg", 5.0))
        ti = float(node.get("themis_ti_val", 310.0))
        traction = float(node.get("traction_risk", 0.35))
        science_val = float(node.get("science_score", 0.05))

        # 1. Adiabatic lapse rate: ~ -1.5°C per 1,000m climb above base (-2530m)
        delta_elev_km = (elev - (-2530.0)) / 1000.0
        node_temp = base_temp_C - (delta_elev_km * 1.5)

        # 2. Radiation: Higher elevation has less atmospheric column shielding;
        #    Steep terrain provides cliff line-of-sight shadowing
        shielding_factor = max(0.2, 1.0 - (slope / 70.0))
        node_rad = base_rad * (1.0 + (delta_elev_km * 0.05)) * shielding_factor

        # 3. Barometric pressure: P = P0 * exp(-z / H), scale height H ~ 11.1 km
        node_press = base_press * math.exp(-delta_elev_km / 11.1)

        # Normalize features to [0.0, 1.0] for stable GNN propagation
        norm_elev = (elev - (-2700.0)) / 400.0
        norm_slope = min(slope / 25.0, 1.0)
        norm_ti = min(ti / 600.0, 1.0)
        norm_traction = min(max(traction, 0.0), 1.0)
        norm_science = min(max(science_val, 0.0), 1.0)
        norm_temp = (node_temp - (-90.0)) / 70.0
        norm_rad = min(node_rad / 25.0, 1.0)
        norm_press = (node_press - 500.0) / 300.0

        X[i] = [
            np.clip(norm_elev, 0.0, 1.0),
            np.clip(norm_slope, 0.0, 1.0),
            np.clip(norm_ti, 0.0, 1.0),
            norm_traction,
            norm_science,
            np.clip(norm_temp, 0.0, 1.0),
            norm_rad,
            np.clip(norm_press, 0.0, 1.0),
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
