# SKILL.md — החווה של אגם (מסמך-העל)

> הזהות הדורסת של הפרויקט. לא סטטוס חי (זה ב-`primer.md` + `dashboard\PROJECTS_STATE.md`).

## מטרת-על · [Tier 4 — אישי/תחביב]
משחק **עולם-פתוח תלת-ממדי בסגנון FarmVille** לבת של הלל, **אגם (גיל 6)**, בעברית מלאה.
החווה היא הבית, ומסביבה עולם מחובר (יער/אגם/כפר/הר). **כל פעולה דורשת תרגיל חשבון מותאם לכיתה א'** — קושי עולה עם הרמה ומחזק את הסוג החלש. גישת "אי אפשר להפסיד" (מחקר גיל 5-7): יבול ממתין, סוס תמיד שמח, טעות חושפת+מקריאה את התשובה.

## Stack
- **Vanilla JS (ES modules) + Three.js r160** (מוטמע מקומית ב-`js/lib/`, importmap — **בלי שלב build**).
- **Supabase** — שמירת ענן + חשבונות (אנונימי + אימייל). **PWA** (התקנה + אופליין).
- אירוח סטטי (Vercel). מנוע חשבון פרוצדורלי, הקראה קולית (Web Speech), צלילים פרוצדורליים (WebAudio).

## מיקומים
- **מקומי:** `C:\Users\saraa\agam-horse-farm\` (נתיב ASCII נקי — קריטי לריצה). הפעלה: `שחקי.bat`.
- **חי:** https://agam-horse-farm.vercel.app/ · **GitHub:** `hilell-aknine/agam-horse-farm` (push→Vercel auto-deploy).
- **סודות:** `C:\Users\saraa\.secrets\agam-horse-farm.env` (Supabase URL/anon/access-token).
- `js/` מודולים · `assets/` (~81 ציורי FAL) · `css/style.css` · `tools/` (סקריפטי ייצור, gitignored).

## ארכיטקטורת מודולים (js/)
- **main.js** — מקשר: אתחול, boot (טעינה מקומית/ענן), בניית עולם, מטפלים, לולאה.
- **world.js** — סצנה תלת-ממד, מצלמה+נסיעה (travelTo), יום/לילה, מזג-אוויר, שמיים/קרקע/גבעות/הרים, חלקיקים, בחירה (raycast), floorPatch, makeSign, makeBillboard.
- **horses.js / animals.js / fields.js** — סוסים / חיות (משק+נוף+נדירות) / חלקות-גידול. כל אחד עם update().
- **game.js** — מצב, כלכלה, שמירה (localStorage `agam_farm_v2`), קטלוג חנות (SHOP), גידולים (CROPS), משימות, גלגל, קושי-מותאם (typeStats/weakType), שדרוגים, worldStats.
- **ui.js** — כל ה-DOM (מסכים, HUD, כרטיס-סוס, חנות, חלון-תרגיל, מפה, יומן, הגדרות+חשבון).
- **audio.js** — SFX פרוצדורלי + הקראה עברית + קולות חיות + צלילי-אזור.
- **math.js** — `generateProblem(difficulty, focusType)` → אובייקט {question, answer, choices, visual, hint, speech, **ltr**}. משוואות=LTR, משפטים עברית=RTL.
- **cloud.js** — Supabase (esm.sh CDN), התחברות אנונימית/אימייל, pull/push (fail-safe: אם אין רשת → localStorage בלבד).
- **מודולי-אזור:** `forest_area.js`, `lake_area.js`, `village_area.js`, `mountain_area.js`, `fair_area.js` — כל אחד `build*(deps)` שבונה אזור סביב מרכז נתון (DI: deps.decor/activity/onUpdate/askProblem/Animals/...).
- **מודולי מיני-משחק:** `contest.js`, `delivery.js`, `photo.js` — `create*(deps)` → API.

## מודל נתונים
- מקומי: `localStorage['agam_farm_v2']` — coins/xp/level/stars/settings/typeStats/quests/upgrades/ribbons/rares/tree/worldStats + horses/fields/placed/animals + savedAt.
- ענן: Supabase `public.game_saves(user_id uuid PK → auth.users, data jsonb, updated_at)` · RLS `auth.uid()=user_id` · Auth: anon+email, `mailer_autoconfirm=true`. Ref `xgqetnlsesgwiypufodf`.

## צנרת אמנות (tools/gen_*.py)
FAL: **Flux dev בסגנון "flat vector / die-cut sticker" (guidance 6, 40 steps) → BiRefNet cutout → PIL UnsharpMask**. מפתח FAL ב-`.secrets\creative-board.env`. תקציב 30₪ · נוצל ~11.3₪.

## חוקי-ברזל
1. **גיל 6, פשוט, בלי הפסד** — כפתורים ענקיים, הקראה, בלי עונש, יבול/חיות תמיד ממתינים.
2. **כל פעולה = תרגיל מותאם** דרך `askProblem(actionType, onCorrect)` (מרכז את הקושי-המותאם + מעקב).
3. **עברית מלאה RTL, אבל משוואות (3+2=?) חייבות LTR** (`problem.ltr`).
4. **בלי build** — importmap ל-Three מקומי; supabase-js מ-esm.sh בזמן ריצה.
5. **ענן fail-safe** — תמיד נופל ל-localStorage; לא חוסם משחק.
6. **אזור חדש = מודול נפרד** עם חוזה `deps` (טורבו-ידידותי: קבצים דיסיוינטיים).
7. אימות: `node --check js/*.js` + צילום headless (Chrome swiftshader) + מבחן חשבון 36K.

## גוטצ'ות (ראה hindsight.md)
`p.rotation` על Sprite זורק (freeze) · Supabase Mgmt API חוסם python-UA · far-plane<sky=שמיים שחורים · headless virtual-time לא מריץ אנימציית-נסיעה.
