# SKILL.md — החווה של אגם (מסמך-העל)

> הזהות הדורסת של הפרויקט. לא סטטוס חי (זה ב-`primer.md` + `dashboard\PROJECTS_STATE.md`).

## מטרת-על · [Tier 4 — אישי/תחביב]
משחק **עולם-פתוח תלת-ממדי בסגנון FarmVille** לבת של הלל, **אגם (גיל 6)**, בעברית מלאה.
החווה היא הבית, ומסביבה עולם מחובר (יער/אגם/כפר/הר). **כל פעולה דורשת תרגיל חשבון מותאם לכיתה א'** — קושי עולה עם הרמה ומחזק את הסוג החלש. גישת "אי אפשר להפסיד" (מחקר גיל 5-7): יבול ממתין, סוס תמיד שמח, טעות חושפת+מקריאה את התשובה.
**עולם חברתי (2026-07-02):** כניסה של הורה פעם אחת במכשיר (מייל מורשה בלבד, בלי סיסמה, ובחירת שחקנית) — לכל חברה של אגם חווה משלה בענן, וכפתור "👭 החוות של החברות" מאפשר לבקר בחווה של חברה **במצב צפייה בלבד** (`?visit=<user_id>` — כל הפעולות/שמירה חסומות, באנר "חזרה הביתה").

## Stack
- **Vanilla JS (ES modules) + Three.js r160** (מוטמע מקומית ב-`js/lib/`, importmap — **בלי שלב build**).
- **Supabase** — שמירת ענן + חשבונות (אנונימי + אימייל). **PWA** (התקנה + אופליין).
- אירוח סטטי (Vercel). מנוע חשבון פרוצדורלי, הקראה קולית (Web Speech), צלילים פרוצדורליים (WebAudio).

## מיקומים
- **מקומי:** `C:\Personal\Kids\agam-horse-farm\` (נתיב ASCII נקי, קריטי לריצה). הפעלה: `שחקי.bat`.
- **חי:** https://agam-horse-farm.vercel.app/ · **GitHub:** `hilell-aknine/agam-horse-farm` (push→Vercel auto-deploy).

## ארכיטקטורה, נתונים, API, גיבויים
**הכל ב-`CONTEXT.md`** (מפת תיקיות וקוד, זרימת המשחק, מודל הנתונים, שרתונים, שחזור). לא משכפלים לכאן.

## צנרת אמנות (tools/gen_*.py)
FAL: **Flux dev בסגנון "flat vector / die-cut sticker" (guidance 6, 40 steps) → BiRefNet cutout → PIL UnsharpMask**. מפתח FAL ב-`.secrets\creative-board.env`. תקציב 30₪ · נוצל ~11.3₪.

## חוקי-ברזל
1. **גיל 6, פשוט, בלי הפסד** — כפתורים ענקיים, הקראה, בלי עונש, יבול/חיות תמיד ממתינים.
2. **כל פעולה = תרגיל מותאם** דרך `askProblem(actionType, onCorrect)` (מרכז את הקושי-המותאם + מעקב).
3. **עברית מלאה RTL, אבל משוואות (3+2=?) חייבות LTR** (`problem.ltr`).
4. **בלי build** — importmap ל-Three מקומי; supabase-js מ-esm.sh בזמן ריצה.
5. **ענן fail-safe** — תמיד נופל ל-localStorage; לא חוסם משחק.
6. **אזור חדש = מודול נפרד** עם חוזה `deps` (טורבו-ידידותי: קבצים דיסיוינטיים).
7. אימות: `node --check` + `python scripts/smoke.py` + צילום headless (Chrome swiftshader) + מבחן חשבון 36K.

## גוטצ'ות (ראה hindsight.md)
`p.rotation` על Sprite זורק (freeze) · Supabase Mgmt API חוסם python-UA · far-plane<sky=שמיים שחורים · headless virtual-time לא מריץ אנימציית-נסיעה.

## צוות סוכנים (מ-28.10.2026)
Opus מנהל ומטמיע. סוכני משנה `farm-researcher/artist/writer/characters/module-builder/qa` ב-`.claude/agents/`, ו-Codex כמסלול מקביל על המנוי. כותבים רק ל-`_handoff/` עם דוח `HANDOFF.md` אחיד. הפרוטוקול המלא: `CLAUDE.md`, סעיף "צוות סוכנים".
