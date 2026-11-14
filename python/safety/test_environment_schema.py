"""
Test suite for Person 4 environment.json deliverable.
Validates that all required fields, alert structures, and data types
conforming to MANGALNAUTS/plan.md lines 128 and 133-142 are present.
"""

import os
import json
import unittest

class TestEnvironmentArtifact(unittest.TestCase):
    def setUp(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.json_path = os.path.join(base_dir, "data", "jezero", "v1", "environment.json")
        self.assertTrue(os.path.exists(self.json_path), f"Missing {self.json_path}")
        with open(self.json_path, "r", encoding="utf-8") as f:
            self.data = json.load(f)

    def test_top_level_contract_fields(self):
        """Check all required top-level contract fields from plan.md line 128."""
        required = [
            "site", "sol", "temp_C", "wind_m_s",
            "sunset_utc", "rad_dose_proxy", "flare_level", "alerts"
        ]
        for field in required:
            self.assertIn(field, self.data, f"Missing required contract field: {field}")

    def test_alert_object_structure(self):
        """Check alert object structure from plan.md lines 133-142."""
        self.assertIsInstance(self.data["alerts"], list)
        for alert in self.data["alerts"]:
            self.assertIn("code", alert)
            self.assertIn("severity", alert)
            self.assertIn("message", alert)
            self.assertIn("sunset_in_min", alert)
            self.assertIn(alert["severity"], ["info", "advisory", "warning", "critical"])

    def test_physical_ranges(self):
        """Ensure physical parameters are within realistic Martian boundaries."""
        self.assertGreater(self.data["sol"], 0)
        self.assertGreaterEqual(self.data["temp_C"], -130.0)
        self.assertLessEqual(self.data["temp_C"], 30.0)
        self.assertGreaterEqual(self.data["wind_m_s"], 0.0)
        self.assertGreaterEqual(self.data["rad_dose_proxy"], 10.0)

if __name__ == "__main__":
    unittest.main()
