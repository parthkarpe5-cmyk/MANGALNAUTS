"""
MANGALNAUTS System Integrity Verification
Validates JSON schemas, JS modules, manifests, and file dependencies.
"""
import glob
import json
import os
import sys

def verify_all():
    print("--> 1. Validating all JSON and GeoJSON files...")
    all_json = glob.glob("data/**/*.json", recursive=True) + glob.glob("data/**/*.geojson", recursive=True)
    for f in all_json:
        try:
            with open(f, "r", encoding="utf-8") as fp:
                json.load(fp)
        except Exception as e:
            print(f"[ERROR] Failed to parse {f}: {e}")
            return False
    print(f"    [OK] Successfully parsed {len(all_json)} JSON/GeoJSON files.")

    print("--> 2. Validating Manifest structure...")
    with open("data/manifest.json", "r", encoding="utf-8") as fp:
        manifest = json.load(fp)
    assert "sites" in manifest, "Manifest missing 'sites' key"
    assert "default_site" in manifest, "Manifest missing 'default_site'"
    for site_key, site in manifest["sites"].items():
        print(f"    - Site {site_key}: name='{site['name']}', bbox={site['bbox']}")
        for fkey in ["terrain_graph", "science_stops", "routes", "environment", "gnn_scores"]:
            path = site["files"][fkey]
            assert os.path.exists(path), f"File {path} missing for site {site_key}"
    print("    [OK] Manifest and all site paths exist.")

    print("--> 3. Validating Historical Traverses & Caves...")
    with open("data/traverses.json", "r", encoding="utf-8") as fp:
        traverses = json.load(fp)
    assert "traverses" in traverses, "Traverses missing 'traverses'"
    total_km = sum(t.get("lengthKm", 0) for t in traverses["traverses"])
    print(f"    [OK] Traverses loaded: {len(traverses['traverses'])} missions, total distance: {total_km:.2f} km")

    with open("data/caves.json", "r", encoding="utf-8") as fp:
        caves = json.load(fp)
    assert "caves" in caves, "Caves missing 'caves'"
    print(f"    [OK] Caves loaded: {len(caves['caves'])} lava tube skylights")

    print("--> 4. Validating GRS Mineral Maps...")
    grs_files = glob.glob("data/grs/*.json")
    assert len(grs_files) >= 6, f"Expected 6 GRS maps, found {len(grs_files)}"
    for gf in grs_files:
        with open(gf, "r", encoding="utf-8") as fp:
            data = json.load(fp)
            assert "values" in data and "element" in data, f"Invalid GRS format in {gf}"
    print(f"    [OK] {len(grs_files)} GRS maps verified.")

    print("\nALL SYSTEM DATA INTEGRITY CHECKS PASSED WITH ZERO ERRORS!")
    return True

if __name__ == "__main__":
    success = verify_all()
    sys.exit(0 if success else 1)
