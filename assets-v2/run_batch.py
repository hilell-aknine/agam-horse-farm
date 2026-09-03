# -*- coding: utf-8 -*-
"""מייצר מחדש את נכסי החווה של אגם לפי ספר הסגנון.
רץ ברצף בכוונה: הרנר של gpt-image-2 שולף את התמונה מלוג הסשן המשותף של Codex,
ולכן שתי הרצות במקביל מתנגשות ומחזירות את אותה תמונה. אומת בפועל 02.09.2026.
מתחדש: קובץ שכבר קיים מדולג.
"""
import subprocess, sys, time, hashlib
from pathlib import Path
from PIL import Image

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent))
from manifest import ASSETS, OPAQUE

ROOT = Path(__file__).resolve().parent
OLD  = ROOT.parent / "assets"
GEN  = Path.home() / ".claude/skills/gpt-image-2/scripts/generate.mjs"
REF  = ROOT / "_anchor/anchor.png"
LOG  = ROOT / "batch.log"

PREFIX = (
    "Flat vector illustration in the style of a die-cut sticker, for a cheerful children's "
    "mobile farm game. Clean crisp sharp vector art. Bold uniform dark outline of even "
    "thickness around the entire shape. Simple flat colour fills with one soft shading tone, "
    "no complex gradients. Bright, warm, saturated, cheerful palette. High contrast. Friendly "
    "rounded shapes, cute and gentle, made for a six year old. A single subject only, centred, "
    "full body inside the frame, seen straight on or from a slight three-quarter front angle. "
    "SUBJECT: "
)
TRANSPARENT_CLAUSE = " The subject is isolated on a fully transparent background."
NEGATIVE = (
    " No text, no letters, no numbers, no watermark, no logo. No photorealism, no 3D render, "
    "no painterly texture. No blur, no soft focus, no white halo, no glow. No drop shadow, no "
    "ground shadow, no background scenery, no frame, no border."
)
ONE_ONLY = " Only one object in the image."


def log(msg):
    line = f"{time.strftime('%H:%M:%S')}  {msg}"
    print(line, flush=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def main():
    todo = []
    for key, spec in ASSETS.items():
        subject, mode = (spec, "transparent") if isinstance(spec, str) else (spec[0], spec[1])
        out = ROOT / f"{key}.png"
        if out.exists():
            continue
        src = OLD / f"{key}.png"
        if not src.exists():
            log(f"!! אין מקור, מדלג: {key}")
            continue
        todo.append((key, subject, mode, out, Image.open(src).size))

    log(f"=== התחלה. {len(todo)} לייצור, {len(ASSETS)-len(todo)} כבר קיימים. ===")

    seen, stale = {}, 0
    for p in ROOT.rglob("*.png"):
        seen[hashlib.md5(p.read_bytes()).hexdigest()] = str(p.relative_to(ROOT))

    for i, (key, subject, mode, out, (w, h)) in enumerate(todo, 1):
        out.parent.mkdir(parents=True, exist_ok=True)
        transparent = mode != OPAQUE
        prompt = PREFIX + subject
        if transparent:
            prompt += TRANSPARENT_CLAUSE
        prompt += NEGATIVE
        if key != "title_farm":
            prompt += ONE_ONLY

        # --provider codex: כפייה למסלול החינמי. בלי זה, טוקן שנשלל מפיל אותנו
        # ל-FAL בשקט וכל תמונה עולה כסף. קרה בפועל 02.09.2026.
        cmd = ["node", str(GEN), "--provider", "codex", "--ref", str(REF), "--prompt", prompt,
               "--quality", "high", "--output", str(out)]
        if transparent:
            cmd += ["--background", "transparent"]   # מדלג על חיתוך המידה, נתקן ב-PIL
        else:
            cmd += ["--size", f"{w}x{h}"]

        t0 = time.time()
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", cwd=str(ROOT))
        blob = (r.stdout or "") + (r.stderr or "")

        if "falling back to FAL" in blob:
            log(f"[STOP] עצירה ב-{key}: נפילה ל-FAL, זה כסף אמיתי. לא ממשיך.")
            sys.exit(2)
        if r.returncode != 0 or not out.exists():
            log(f"[FAIL] {key} ({r.returncode}): {blob.strip()[-300:]}")
            continue

        # שומר הכפילות. כשהמסלול החינמי נופל, generate.mjs לא נכשל אלא שולף שוב
        # את התמונה האחרונה מלוג הסשן של Codex, והלוג נראה ירוק לגמרי.
        # קרה בפועל 02.09.2026 במשחק ה-NLP: 26 קבצים זהים בייט-בייט עם ✓ על כל אחד.
        h_ = hashlib.md5(out.read_bytes()).hexdigest()
        if h_ in seen:
            out.unlink()
            log(f"[DUP] {key} יצא זהה ל-{seen[h_]}. המסלול החינמי כנראה נפל.")
            stale += 1
            if stale >= 2:
                log("[STOP] שתי כפילויות ברצף. עוצר כדי לא לזייף עוד נכסים.")
                sys.exit(3)
            log("      ממתין 120 שניות וממשיך לנכס הבא.")
            time.sleep(120)
            continue
        stale = 0
        seen[h_] = key

        im = Image.open(out)
        if im.size != (w, h):
            im.convert("RGBA" if transparent else "RGB").resize((w, h), Image.LANCZOS).save(out)
            note = f" (שונה גודל {im.size[0]}x{im.size[1]} -> {w}x{h})"
        else:
            note = ""
        log(f"[OK] [{i}/{len(todo)}] {key}  {w}x{h}  {time.time()-t0:.0f}s{note}")

    log("=== סיום. ===")


if __name__ == "__main__":
    main()
