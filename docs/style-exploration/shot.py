#!/usr/bin/env python3
"""Screenshot mockup.html in each style, for the style comparison.

    cd docs/style-exploration && python3 shot.py illustrated pixel flat isometric crayon treasure

Serves this folder, opens mockup.html?style=<name> in Chrome (Playwright) and saves 2026-11-23-style-<name>.png.
Needs Playwright: pip install playwright (it uses the installed Chrome).
"""
import functools
import http.server
import sys
import threading

from playwright.sync_api import sync_playwright

VIEWPORT = {'width': 1520, 'height': 960}
SETTLE_MS = 2500  # let the mockup draw and its fonts load


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main(styles):
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory='.'))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        for style in styles:
            page = browser.new_page(viewport=VIEWPORT)
            page.on('console', lambda m: print('console:', m.text))
            page.on('pageerror', lambda e: print('page error:', e))
            page.goto(f'http://127.0.0.1:{port}/mockup.html?style={style}')
            page.wait_for_timeout(SETTLE_MS)
            page.locator('canvas').screenshot(path=f'2026-11-23-style-{style}.png')
            print('ok', style)
        browser.close()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
