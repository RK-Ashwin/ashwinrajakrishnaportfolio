#!/usr/bin/env python3
"""
Ashwin Rajakrishna — Portfolio Local Dev Server
================================================
Run this script to preview the portfolio locally.

Usage:
    python3 serve.py

Then open: http://localhost:8080
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Clean log output
        print(f"  [{self.log_date_time_string()}]  {format % args}")


def main():
    os.chdir(DIRECTORY)

    print()
    print("=" * 50)
    print("  Ashwin Rajakrishna — Portfolio Dev Server")
    print("=" * 50)
    print(f"  Serving:  {DIRECTORY}")
    print(f"  URL:      http://localhost:{PORT}")
    print(f"  Stop:     Ctrl+C")
    print("=" * 50)
    print()

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            webbrowser.open(f"http://localhost:{PORT}")
        except Exception:
            pass

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n  Server stopped. Goodbye!\n")
            sys.exit(0)


if __name__ == "__main__":
    main()
