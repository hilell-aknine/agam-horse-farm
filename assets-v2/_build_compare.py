# -*- coding: utf-8 -*-
"""דף השוואה לפני/אחרי לנכסי החווה. עצמאי, התמונות מוטמעות כ-PNG מוקטן
(PNG ולא JPEG כי האלפא היא בדיוק מה שבודקים כאן)."""
import base64, io, sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from manifest import ASSETS

ROOT  = Path(__file__).resolve().parent
OLD   = ROOT.parent / "assets"
THUMB = 260

GROUPS = [
    ("סוסים",           lambda k: k.startswith(("horse_", "pony")) or "pony" in k),
    ("סייחים",          lambda k: k.startswith("foal_")),
    ("חיות",            lambda k: k in {"cow","sheep","goat","pig","chicken","duck","turkey","peacock",
                                        "dog","cat","rabbit","fox","deer","penguin","butterfly"} or "goat_alt" in k),
    ("דמויות",          lambda k: k.startswith("npc_") or k == "shopkeeper"),
    ("מבנים",           lambda k: k in {"barn","barn_big","cottage","bakery","silo","windmill","well",
                                        "doghouse","farm_gate","cave","fountain"}),
    ("צמחייה ונוף",     lambda k: k in {"tree","oak_tree","pine_tree","bush","flower_bush","flowers_wild",
                                        "grass_tuft","mushroom","pond","rock","rainbow","cloud"}),
    ("יבולים",          lambda k: k in {"apple","carrot","corn","wheat","strawberry","pumpkin"}),
    ("ציוד וחפצים",     lambda k: k in {"saddle","brush","water_bucket","watering_can","trough","feed_sack",
                                        "hay_bale","horseshoe","coin","gem","trophy","balloons","bench",
                                        "lamp_post","signpost","scarecrow","weathervane","cone"}),
    ("מסך ואייקונים",   lambda k: k == "title_farm" or k.startswith("icon-")),
]


def thumb_b64(p: Path) -> str:
    im = Image.open(p).convert("RGBA")
    if im.width > THUMB:
        im = im.resize((THUMB, round(im.height * THUMB / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


assigned, sections, missing, total = set(), [], [], 0
for gtitle, pred in GROUPS:
    keys = sorted(k for k in ASSETS if k not in assigned and pred(k))
    assigned |= set(keys)
    cards = []
    for k in keys:
        old_p, new_p = OLD / f"{k}.png", ROOT / f"{k}.png"
        if not new_p.exists():
            missing.append(k)
            continue
        total += 1
        cards.append(
            f'<figure class="c"><div class="p">'
            f'<img src="{thumb_b64(old_p)}" alt=""><img class="a" src="{thumb_b64(new_p)}" alt="">'
            f'</div><figcaption>{k.split("/")[-1]}</figcaption></figure>'
        )
    if cards:
        sections.append(f'<section><h2>{gtitle} <span>{len(cards)}</span></h2>'
                        f'<div class="grid">{"".join(cards)}</div></section>')

leftover = sorted(k for k in ASSETS if k not in assigned)
note = ""
if missing:
    note += (f'<p class="warn">⚠ {len(missing)} נכסים עדיין לא נוצרו ולכן אינם בדף: '
             + ", ".join(missing[:12]) + ("…" if len(missing) > 12 else "") + "</p>")
if leftover:
    note += f'<p class="warn">⚠ לא שויכו לקבוצה: {", ".join(leftover)}</p>'

html = """<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>מיתוג מחדש — החווה של אגם</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700&display=swap" rel="stylesheet">
<style>
 *{box-sizing:border-box}
 body{margin:0;background:#f4f7f4;color:#243027;font-family:Heebo,sans-serif;padding:26px 18px 70px}
 header,main{max-width:1180px;margin:0 auto}
 h1{font-size:30px;margin:0 0 10px;color:#2c6e3f}
 header p{margin:0 0 6px;line-height:1.75;color:#4a5b50;max-width:76ch}
 .warn{color:#a8620a}
 section{margin:34px 0 0}
 h2{font-size:18px;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #cfe3d4}
 h2 span{color:#7b9184;font-weight:400;font-size:14px;margin-inline-start:6px}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
 .c{margin:0}
 .p{display:grid;grid-template-columns:1fr 1fr;gap:6px}
 .p img{width:100%;display:block;border-radius:10px;
   background-color:#fff;
   background-image:linear-gradient(45deg,#e9eee9 25%,transparent 25%,transparent 75%,#e9eee9 75%),
                    linear-gradient(45deg,#e9eee9 25%,transparent 25%,transparent 75%,#e9eee9 75%);
   background-size:16px 16px;background-position:0 0,8px 8px}
 .p .a{outline:3px solid #2c6e3f;outline-offset:-3px}
 figcaption{margin-top:7px;font-size:12px;color:#6d7f74;text-align:center;direction:ltr}
 .legend{display:flex;gap:18px;font-size:13px;color:#6d7f74;margin-top:14px}
 .legend b{color:#2c6e3f}
</style></head><body>
<header>
 <h1>החווה של אגם, מיתוג מחדש</h1>
 <p>__TOTAL__ זוגות. מימין הישן, משמאל החדש במסגרת ירוקה. המשבצות הן שקיפות.</p>
 <p>הכל ב-<code>assets-v2/</code>. הישן לא נגוע, שום דבר לא נפרס ולא נדחף.</p>
 __NOTE__
 <div class="legend"><span>ימין = לפני</span><span><b>שמאל = אחרי</b></span></div>
</header>
<main>__SECTIONS__</main>
</body></html>"""
html = (html.replace("__SECTIONS__", "\n".join(sections))
            .replace("__TOTAL__", str(total))
            .replace("__NOTE__", note))

out = ROOT / "compare.html"
out.write_text(html, encoding="utf-8")
print(f"נכתב: {out}  ({out.stat().st_size/1024/1024:.2f} MB, {total} זוגות, חסרים {len(missing)})")
