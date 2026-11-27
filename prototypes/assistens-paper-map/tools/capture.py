"""Deterministic review captures of the game in any style (the page's window.__capture hook, see src/main.js).

Serves the project folder, opens the page in Chrome (headless, GPU), waits until the style is ready, runs each shot on
the fixed clock and saves a PNG. Prints the build time and pieces (papercraft), the slowest prints and every page
error and console error, and exits non-zero on a page error, a spot the walker can't stand on, or a walk that does not
arrive.

    python tools/capture.py <project folder> [shots ...] [--page src/index.html] [--style flat] [--out frames]
                            [--size 1600x900] [--ss 1]

Shots for every style (default: overview):
    overview              restart, then 3.2 s: the opening frame, risen
    zoom=MODE             the start, in zoom MODE (street, walk or map)
    at=X,Z                the walker put at (X, Z) (world units; the tiles there are loaded first), the camera on him
    stand=X,Z             as at=, then 3.5 s more so the pieces near him have risen
    hold=KEYS,SEC         from the start, hold keys (e.g. ArrowUp+ArrowLeft) for SEC seconds at 60 fps, live input
Papercraft only (they use the harness's window.__papercraft):
    midrise               mid-rise (0.8 s)            test       the ?test page        key   the key light alone
    mood=NAME             ?mood=NAME (golden, dusk, night), risen
    look=X,Z[,DIST[,Y]]   a close look at (X, Z)      spot=NAME[,DIST]  a close look at H.spots[NAME]
    walk=X,Z;X,Z;...      a scripted walk from the start through the waypoints; prints { reached, of, stuck, ... }
Add ZOOM after any at= or stand= shot as a third value to frame it in that zoom (e.g. stand=95,47,street). Name a
shot's file with NAME: before it (e.g. bakery:stand=105,51). Needs Playwright (pip install playwright; it uses your
installed Chrome, or run `playwright install chromium`).
"""
import argparse, functools, http.server, json, os, re, sys, threading


def serve(root):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv.server_address[1]


def plan(shot):
    """(file name, url query, what to run, kind). Kinds: 'generic' (window.__capture, any style), 'paper' (papercraft
    harness), 'at' (generic placement), 'walk', 'hold'."""
    name = None
    if ':' in shot.split('=')[0]:
        name, shot = shot.split(':', 1)
    key, _, arg = shot.partition('=')
    base = 'C.restart(); C.step(3.2);'
    if key == 'overview': return name or 'overview', '', base, 'generic'
    if key == 'zoom': return name or f'zoom-{arg}', '', base + f' C.zoom({json.dumps(arg)}); C.step(0.1);', 'generic'
    if key in ('at', 'stand'):
        x, z, *rest = arg.split(',')
        return name or f'{key}-{float(x):g}_{float(z):g}', '', (float(x), float(z), 0.5 if key == 'at' else 3.5, rest[0] if rest else None), 'at'
    if key == 'hold':
        keys, _, sec = arg.partition(',')
        return name or 'hold', '', (keys.split('+'), float(sec or 1)), 'hold'
    pbase = 'restart(); step(3.2);'
    if key == 'midrise': return name or 'midrise', '', 'restart(); step(0.8);', 'paper'
    if key == 'test': return name or 'test', 'test', 'restart(); step(2.5);', 'paper'
    if key == 'key': return name or 'key', 'diag=key', pbase, 'paper'
    if key == 'mood': return name or f'mood-{arg}', f'mood={arg}', pbase, 'paper'
    if key == 'look':
        v = [float(t) for t in arg.split(',')]
        return name or 'look-' + '_'.join(f'{t:g}' for t in v[:2]), '', pbase + f' look({", ".join(str(t) for t in v)}); step(1 / 60);', 'paper'
    if key == 'spot':
        sp, _, d = arg.partition(',')
        return name or f'spot-{sp}', '', pbase + f' look(spots[{json.dumps(sp)}][0], spots[{json.dumps(sp)}][1], {d or 30}); step(1 / 60);', 'paper'
    if key == 'walk':
        pts = [[float(t) for t in p.split(',')] for p in arg.split(';') if p]
        return name or 'walk', '', pts, 'walk'
    raise SystemExit(f'capture.py: unknown shot "{shot}" (see the docstring)')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('project'); ap.add_argument('shots', nargs='*')
    ap.add_argument('--page', default='src/index.html'); ap.add_argument('--out', default='frames')
    ap.add_argument('--style', default='', help='the style to open (?style=NAME); default: the game default')
    ap.add_argument('--size', default='1600x900'); ap.add_argument('--ss', default='1')
    a = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit('capture.py needs Playwright: pip install playwright (and `playwright install chromium` if Chrome is not installed)')
    root = os.path.abspath(a.project); out = os.path.join(root, a.out) if not os.path.isabs(a.out) else a.out
    os.makedirs(out, exist_ok=True)
    W, H = (int(t) for t in a.size.lower().split('x'))
    port = serve(root)
    failed = False
    with sync_playwright() as p:
        args = ['--enable-gpu', '--ignore-gpu-blocklist'] + (['--use-angle=d3d11'] if os.name == 'nt' else [])
        try: b = p.chromium.launch(channel='chrome', headless=True, args=args)
        except Exception: b = p.chromium.launch(headless=True, args=args)
        logs, errors = [], []
        pg, cur = None, None
        for shot in (a.shots or ['overview']):
            name, query, js, kind = plan(shot)
            q = '&'.join(t for t in ('capture', f'style={a.style}' if a.style else '', f'ss={a.ss}' if a.ss != '1' else '', query, os.environ.get('EXTRA_Q', '')) if t)
            if q != cur:   # a fresh page per URL: a reload in the same tab builds slower (the old page's canvases)
                if pg: pg.close()
                pg = b.new_page(viewport={'width': W, 'height': H})
                pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
                pg.on('pageerror', lambda e: errors.append(str(e)))
                pg.goto(f'http://127.0.0.1:{port}/{a.page}?{q}')
                try:
                    pg.wait_for_function('window.__capture && window.__capture.ready', timeout=180000)
                except Exception:
                    print('the page never became ready (no window.__capture.ready):')
                    for e in errors: print('  PAGE ERROR', e)
                    for l in logs[:30]: print('  ', l[:300])
                    raise SystemExit(1)
                cur = q
                paper = pg.evaluate('Boolean(window.__papercraft)')
                if paper:
                    s = pg.evaluate('__papercraft.printStats ? __papercraft.printStats(5) : null')
                    print(f'[{q}] build {pg.evaluate("__papercraft.buildMs")} ms, pieces {pg.evaluate("__papercraft.pieces")}'
                          + (f', {s["prints"]} prints {s["printMs"]} ms ({s["mpx"]} Mpx)' if s else ''))
                    if s:
                        for e in s['top']: print(f'    {e["ms"]:6d} ms  {e["prints"]:4d} x {e["each"]:6.1f} ms  {e["at"]}')
                else:
                    print(f'[{q}] style {pg.evaluate("__capture.style")} ready')
            if kind in ('paper', 'walk') and not paper:
                raise SystemExit(f'capture.py: the {shot} shot needs the papercraft style')
            if kind == 'walk':
                r = pg.evaluate('(pts) => { const P = __papercraft; P.restart(); P.step(3.2); const r = P.walkPath(pts); P.step(1 / 60); return r; }', js)
                r.pop('heights', None); print(f'{name}: walk {json.dumps(r)}')
                if r.get('reached', 0) < r.get('of', 0): failed = True
            elif kind == 'hold':
                keys, sec = js
                pg.evaluate('() => { __capture.restart(); __capture.step(3.2); }')
                for k in keys: pg.evaluate('(k) => dispatchEvent(new KeyboardEvent("keydown", { code: k, key: k }))', k)
                pg.evaluate(f'() => __capture.step({sec})')
                for k in keys: pg.evaluate('(k) => dispatchEvent(new KeyboardEvent("keyup", { code: k, key: k }))', k)
                h = pg.evaluate('__capture.hero()')
                print(f'{name}: hero at [{h["x"]:.2f}, {h["z"]:.2f}]')
            elif kind == 'at':
                x, z, sec, zoom = js
                pg.evaluate('() => { __capture.restart(); __capture.step(0.5); }')
                ok = pg.evaluate('([x, z]) => __capture.goTo(x, z)', [x, z])
                if zoom: pg.evaluate('(m) => __capture.zoom(m)', zoom)
                pg.evaluate(f'() => __capture.step({sec})')
                print(f'{name}: walker at ({x:g}, {z:g})' + ('' if ok else '  (he can\'t stand there: blocked)'))
                if not ok: failed = True
            elif kind == 'generic':
                pg.evaluate(f'(() => {{ const C = __capture; {js} }})()')
            else:
                pg.evaluate(f'(() => {{ const P = __papercraft; with (P) {{ {js} }} }})()')
            cards = pg.evaluate('window.__papercraft && __papercraft.cards ? __papercraft.cards() : null')
            pg.screenshot(path=os.path.join(out, f'{name}.png'))
            print(f'  -> {os.path.join(a.out, name + ".png")}' + (f'  ({cards} standing cards in frame)' if cards is not None else ''))
        b.close()
    noise = re.compile(r'X4000|willReadFrequently|favicon')
    shown = [l for l in logs if not noise.search(l)]
    for e in errors: print('PAGE ERROR', e)
    for l in shown[:40]: print(l[:400])
    if errors or failed: sys.exit(1)


if __name__ == '__main__':
    main()
