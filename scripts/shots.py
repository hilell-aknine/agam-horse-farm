# shots.py - צילומי לפני/אחרי קבועים לעבודה גרפית.
# הרצה: py scripts/shots.py <שם-שלב>      → שומר ל-_handoff/gfx/<שם-שלב>/
# אותן זוויות, אותה שעה ואותו פיזור עצים (?seed=7) בכל הרצה, כדי שאפשר להשוות תמונה מול תמונה.
# רץ ברינדור תוכנה (swiftshader): איטי, וה-FPS שלו לא מייצג טלפון אמיתי.
import http.server, threading, functools, sys, os
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8791                      # פורט ייחודי: 8753/8754/8765 תפוסים לפעמים בידי סשנים אחרים
STAGE = sys.argv[1] if len(sys.argv) > 1 else 'tmp'
ONLY = set(sys.argv[2:])         # אפשר לבקש רק חלק מהצילומים: py scripts/shots.py s1 farm-day lake
OUT = os.path.join(ROOT, '_handoff', 'gfx', STAGE)
os.makedirs(OUT, exist_ok=True)
URL = f'http://127.0.0.1:{PORT}/?seed=7&q=high&dbg=1'

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

# (שם, מרכז x, מרכז z, שעה ביממה 0..1, היסט מצלמה)
FAR = (0, 12, 22)
WORLD = [
    ('farm-day',    0,   0,   0.50, FAR),
    ('farm-dusk',   0,   0,   0.78, FAR),
    ('farm-night',  0,   0,   0.00, FAR),
    ('farm-close',  0,   2,   0.42, (0, 6.5, 12)),
    ('forest',      0,  -70,  0.45, FAR),
    ('lake',        70,  6,   0.45, FAR),
    ('village',    -72,  0,   0.45, FAR),
    ('mountain',    0,   72,  0.45, FAR),
    ('fair',        64, -64,  0.45, FAR),
]

SETUP = """
() => {
  const W = window.__World;
  W._travel = null; W.travelTo = () => {};
  W._wState = 'clear'; W._wt = 0; W._wNext = 1e9;
  document.getElementById('ui').style.visibility = 'hidden';
  const l = document.getElementById('loading'); if (l) l.style.display = 'none';
}
"""
AIM = """
([x, z, tod, off]) => {
  const W = window.__World;
  W.dayNight = true; W.tod = tod; W._updateDayNight(0); W.dayNight = false;
  const c = W.controls;
  c.minAzimuthAngle = -Infinity; c.maxAzimuthAngle = Infinity;
  c.target.set(x, 1.5, z);
  W.camera.position.set(x + off[0], 1.5 + off[1], z + off[2]);
  c.update();
}
"""

def enter(page):
    page.goto(URL, wait_until='load', timeout=120000)
    page.wait_for_function('window.__World && window.__World.scene', timeout=120000)
    page.wait_for_timeout(9000)
    gate = page.query_selector('#agGuest')
    if gate and gate.is_visible():
        gate.evaluate('el => el.click()')
    else:
        play = page.query_selector('#playBtn')
        if play and play.is_visible(): play.evaluate('el => el.click()')
    page.wait_for_timeout(9000)      # מודלים נטענים, רינדור תוכנה איטי

def shot(page, name):
    path = os.path.join(OUT, name + '.png')
    try:
        page.screenshot(path=path, timeout=120000)
        print('  ok ', name)
    except Exception as e:
        print('  FAIL', name, str(e)[:120])

with sync_playwright() as p:
    b = p.chromium.launch(args=['--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    errors = []
    # --- עולם (מחשב, 1280x720) ---
    ctx = b.new_context(viewport={'width': 1280, 'height': 720})
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and 'net::ERR' not in m.text and 'fonts.g' not in m.text and errors.append(m.text))
    enter(page)
    page.evaluate(SETUP)
    for name, x, z, tod, off in WORLD:
        if ONLY and name not in ONLY: continue
        page.evaluate(AIM, [x, z, tod, list(off)])
        page.wait_for_timeout(3500)
        shot(page, name)
    info = page.evaluate("(() => { const r = window.__World.renderer.info; return { calls: r.render.calls, tris: r.render.triangles, geo: r.memory.geometries, tex: r.memory.textures }; })()")
    print('  render info (last view):', info)
    ctx.close()
    # --- ממשק (טלפון) ---
    if not ONLY or ONLY & {'ui-title', 'ui-hud', 'ui-shop'}:
        ctx = b.new_context(**p.devices['Pixel 7'])
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL, wait_until='load', timeout=120000)
        page.wait_for_function('window.__World && window.__World.scene', timeout=120000)
        page.wait_for_timeout(9000)
        shot(page, 'ui-title')
        for sel in ('#agGuest', '#playBtn'):
            el = page.query_selector(sel)
            if el and el.is_visible(): el.evaluate('el => el.click()'); break
        page.wait_for_timeout(9000)
        page.evaluate("() => { const W = window.__World; W._wState = 'clear'; W._wNext = 1e9; W.dayNight = true; W.tod = 0.5; W._updateDayNight(0); W.dayNight = false; }")
        page.wait_for_timeout(2500)
        shot(page, 'ui-hud')
        sb = page.query_selector('#shopBtn')
        if sb:
            page.evaluate("() => document.querySelectorAll('.overlay:not(.hidden) .close').forEach(c => c.click())")
            sb.evaluate('el => el.click()')
            page.wait_for_timeout(2500)
            shot(page, 'ui-shop')
        ctx.close()
    b.close()

srv.shutdown()
for e in errors[:12]: print('  console:', e[:220])
print(f'saved to {OUT} · {len(errors)} errors')
sys.exit(1 if errors else 0)
