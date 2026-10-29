# smoke.py - בדיקת עשן: המשחק עולה, כל המודולים נטענים, אין שגיאות קונסול ואין 404.
# הרצה: python scripts/smoke.py   (מרים שרת מקומי זמני על פורט 8765)
# בודק במחשב ובאמולציית טלפון. יוצא עם קוד 1 אם משהו נשבר.
import http.server, threading, functools, sys, os
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')   # טרמינל ווינדוס = cp1255, נופל על אמוג'י

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8765
# python scripts/smoke.py https://agam-horse-farm.vercel.app/  → בודק את האתר החי במקום המקומי
BASE = sys.argv[1] if len(sys.argv) > 1 else f'http://127.0.0.1:{PORT}/'

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

def run(p, name, ctx_args):
    errors, missing, js_ok = [], [], set()
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(**ctx_args)
    page = ctx.new_page()
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.on('pageerror', lambda e: errors.append(str(e)))
    def on_resp(r):
        if r.url.startswith(BASE):
            if r.status >= 400: missing.append(f'{r.status} {r.url}')
            elif r.url.endswith('.js'): js_ok.add(r.url[len(BASE):])
    page.on('response', on_resp)
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(12000)
    gate = page.query_selector('#agGuest')   # שער "בואי נשחק" (לא תמיד מוצג, תלוי בגרסה ובשמירה)
    if gate and gate.is_visible():
        gate.evaluate('el => el.click()')   # קליק DOM: הכפתור מונפש ו-Playwright מחכה ליציבות לנצח
        page.wait_for_timeout(6000)
    screen = page.evaluate("(document.querySelector('#ui') || document.body).innerText.slice(0, 160)")
    print(f'   [{name}] screen text: {screen!r}')
    canvas = page.evaluate("(() => { const c = document.getElementById('scene'); return c ? [c.width, c.height] : null })()")
    shot = os.path.join(os.environ.get('TEMP', '.'), f'agam-smoke-{name}.png')
    try: page.screenshot(path=shot, timeout=60000)   # רינדור תוכנה איטי: צילום הוא רשות, לא תנאי
    except Exception: shot = '(no screenshot)'
    b.close()
    # שגיאות רשת חיצוניות (גוגל פונטים, esm.sh ברשת מסוננת) לא נחשבות
    errors = [e for e in errors if 'esm.sh' not in e and 'fonts.g' not in e and 'net::ERR' not in e]
    ok = not errors and not missing and canvas and canvas[0] > 0
    print(f'[{name}] {"OK" if ok else "FAIL"} · {len(js_ok)} js modules · canvas {canvas} · shot {shot}')
    for e in errors[:10]: print('   console:', e[:200])
    for m in missing[:10]: print('   http:', m)
    return ok, js_ok

with sync_playwright() as p:
    ok1, mods = run(p, 'desktop', {'viewport': {'width': 1280, 'height': 800}})
    ok2, _ = run(p, 'phone', {**p.devices['Pixel 7']})
srv.shutdown()
print('modules:', ', '.join(sorted(mods)))
sys.exit(0 if ok1 and ok2 else 1)
