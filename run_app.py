"""
MANGALNAUTS — Mission Application Server
Starts a local HTTP server and opens the 3D Mars Globe & Mission Cockpit.
"""

import os
import sys
import time
import socket
import threading
import subprocess
import webbrowser
import http.server
import socketserver

CANDIDATE_PORTS = [8000, 8085, 8888, 5000, 3000]

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and caching headers for tile assets
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

def find_available_port():
    for port in CANDIDATE_PORTS:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    # Fallback to ephemeral port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]

def start_telemetry_daemon():
    """Background daemon thread to keep NASA & NOAA planetary telemetry fresh."""
    def loop():
        base_dir = os.path.dirname(os.path.abspath(__file__))
        script = os.path.join(base_dir, "python", "safety", "rems_rad_snapshot.py")
        if not os.path.exists(script):
            return
        while True:
            try:
                subprocess.run([sys.executable, script], check=False, capture_output=True)
            except Exception:
                pass
            time.sleep(120)

    t = threading.Thread(target=loop, daemon=True, name="TelemetryUpdater")
    t.start()


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

    start_telemetry_daemon()

    port = find_available_port()
    url = f"http://localhost:{port}"

    print("=" * 65)
    print("🚀 MANGALNAUTS — 3D Martian Mission OS & Cockpit")
    print("=" * 65)
    print(f"\n[OK] Local mission server running at: {url}")
    print(f"[OK] Serving mission directory:       {base_dir}")
    print("\nPress Ctrl+C to terminate the server.\n")

    try:
        webbrowser.open(url)
    except Exception:
        pass

    with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down mission server...")
            sys.exit(0)

if __name__ == "__main__":
    main()
