# CONTEXT.md: המפה של החווה של אגם

> **הקובץ הראשון שקוראים בסשן חדש.** כאן רואים איך המערכת בנויה, בלי לקרוא את כל הקוד.
> **חוק:** כל שינוי משמעותי (קובץ חדש, טבלה, API, זרימה, החלטת ארכיטקטורה) מעדכן את הקובץ הזה **באותו commit**, ושורה ביומן בתחתית.
> זהות ומטרה: `SKILL.md` · סטטוס חי: `primer.md` · גוטצ'ות: `hindsight.md` · חוקי עבודה וצוות סוכנים: `CLAUDE.md`.

## 1. במשפט אחד
משחק חווה תלת-ממדי בעברית לאגם (6), שבו כל פעולה היא תרגיל חשבון מותאם. אתר סטטי בלי build (Vanilla JS + Three.js r160 מקומי), PWA, ושמירה במכשיר עם ענן Supabase אופציונלי.
**חי:** https://agam-horse-farm.vercel.app · **ריפו:** github.com/hilell-aknine/agam-horse-farm · **push ל-main = עלייה לאוויר** (רק באישור הלל).

## 2. מפת תיקיות
| שכבה | נתיב | מה זה בשפה פשוטה |
|---|---|---|
| Frontend | `index.html` | הדלת: טוען CSS, importmap של Three, ואת `js/main.js` |
| Frontend | `admin.html` | פאנל הורים (רשימת משתמשות), מדבר עם `admin-users` |
| Frontend | `sw.js`, `manifest.webmanifest` | עבודה בלי אינטרנט + התקנה לטלפון. **network-first**. מעלים `CACHE` בכל שינוי |
| Frontend | `css/style.css` | כל העיצוב |
| Frontend | `assets/` | ציורים (PNG) ו-56 מודלים תלת-ממדיים (`assets/models/*.glb`) |
| Frontend | `js/` | הקוד של המשחק (פירוט בסעיף 3) |
| API | `supabase/functions/` | שרתונים בענן: `admin-users`, `farm-email-login` |
| Database | `supabase/sql/` | הטבלאות וחוקי ההרשאות, קובץ ממוספר לכל שינוי (נוצר בשלב האבטחה) |
| כלים | `scripts/backup/backup.ps1` | גיבוי לילי (סעיף 7) |
| כלים | `scripts/smoke.py` | בדיקת עשן: המשחק עולה בלי שגיאות במחשב ובטלפון |
| כלים | `tools/` (לא ב-git), `assets-v2/` | ייצור אמנות. ספר הסגנון: `assets-v2/STYLE-BIBLE.md` |
| מסמכים | `docs/` | מחקרים ותוכניות: `UX-PLAN.md`, `RESEARCH-FARM-GENRE.md` |
| סוכנים | `.claude/agents/farm-*.md` | צוות העוזרים של הפרויקט (ראו CLAUDE.md) |

`.vercelignore` חוסם מהאתר הציבורי: `supabase/ tools/ scripts/ docs/ *.md`.
`vercel.json` חוסם פריסה מענפי `backup/*`.

## 3. מפת הקוד (`js/`)
| קובץ | תפקיד | מייצא |
|---|---|---|
| `main.js` | המנצח: אתחול, טעינה (מקומי/ענן), בניית העולם, `askProblem`, הדרכה, `Bedtime`, הלולאה | (נקודת כניסה) |
| **engine/** `world.js` | סצנה, מצלמה ונסיעה (`travelTo`), אור, יום/לילה, מזג אוויר, בחירה בנגיעה, `makeBillboard`/`makeSign` | `World`, `THREE` |
| engine/ `models3d.js` | טעינת ה-GLB והחלפת ציורים במודלים, אנימציות | `Models3D` |
| engine/ `horse3d.js` | סוס תלת-ממדי (צבעים, סייח) | `Horse3D`, `loadModel`, `FOAL_SCALE` |
| **farm/** `horses.js` | הסוסים בחווה | `Horses`, `Horse`, `COLORS`, `NAMES` |
| farm/ `animals.js` | חיות משק, נוף ונדירות | `Animals`, `Animal`, `NAMES` |
| farm/ `fields.js` | שדות וגידולים | `Fields` |
| **areas/** `forest/lake/village/mountain/fair_area.js` | אזור בעולם: `build*(deps)` סביב מרכז נתון | `buildForest` וכו' |
| areas/ `interiors.js` | כניסה למבנים: כל חדר `THREE.Scene` נפרד | `Interiors` |
| areas/ `track3d.js` | מסלול רכיבה עם משוכות ותרגילים | `Track3D`, `LAP` |
| **minigames/** `contest/delivery/photo.js` | משחקונים: `create*(deps)` | `createContest` וכו' |
| minigames/ `transfer3d.js` | חשבון בתוך העולם: גזרים לשוקת, שתילים לערוגה | `Transfer3D` |
| **systems/** `game.js` | מצב המשחק, כלכלה, חנות, גידולים, משימות, קושי מותאם, **שמירה מקומית** | `Game`, `CROPS`, `SHOP`, `msUntilMorning` |
| systems/ `math.js` | מנוע התרגילים: `generateProblem(difficulty, focusType)`, `makeTransferTask` | |
| systems/ `story.js` | סיפור החווה: 8 פרקים × 3 משימות | `Story`, `CHAPTERS` |
| systems/ `audio.js` | צלילים פרוצדורליים + הקראה בעברית | `Audio` |
| **net/** `cloud.js` | Supabase: כניסה, משיכה ודחיפה של שמירה, פרופילים, ביקור אצל חברות. **נכשל בשקט ל-localStorage** | `Cloud` |
| net/ `allowlist.js` | טביעות SHA-256 של מיילים מורשים (שער ידידותי בדפדפן) | `isAllowedEmail` |
| **ui/** `ui.js` | כל ה-DOM: מסכים, HUD, חנות, חלון תרגיל, מפה, הגדרות | `UI` |
| `lib/` | Three.js r160 + addons (OrbitControls, GLTFLoader, BufferGeometryUtils). **לא עורכים** | |

**פרטים שקל לשבור:**
- `math.js`: `generateProblem` מחזיר `{question, answer, choices, visual, hint, speech, ltr}`. משוואות LTR, משפטים בעברית RTL.
- `story.js`: `main` שולח `Story.event(name)` (דרך `questBump` + אירועי `visit_/act_/enter_/buy_/sell/ride/jump/birth`). `Game.story = {ch, prog, seen}`. פרק יכול לפתוח אזור נעול (`opens`).
- `track3d.js`: טבלת אורך-קשת לאליפסה, `Track3D.start(horse)` בונה סוס-רוכב נפרד ורוכבת מפרימיטיבים, מצלמה רודפת שמבטלת זמנית את גבולות OrbitControls, השמש עוקבת אחרי הסוס בשביל הצל. `Game.rides`.
- `interiors.js`: `World.activeScene` מחליף סצנה ברינדור. לא משתמשים שם ב-`makeBillboard` (Models3D מסנכרן רק את הסצנה הראשית), ונגיעה בפנים עוברת רק ל-`Interiors.pick`.
- `world.js`: `preserveDrawingBuffer:true` נחוץ לצילום (`photo.js`). far-plane (400) חייב להיות גדול מרדיוס השמיים (200).

**חוזה בין חלקים:** אזורים ומשחקונים לא מייבאים את `main.js`. הם מקבלים `deps` (decor/activity/onUpdate/askProblem/Animals...). אזור חדש = קובץ חדש ב-`areas/` שמעתיק את מבנה `lake_area.js`, ושורת ייבוא ב-`main.js` + נתיב ב-`CORE` של `sw.js`.

## 4. זרימת המשחק
1. `index.html` → `main.js` → `Cloud.init()` (מחכה לענן עד 4.5 שניות, לא יותר).
2. טעינת שמירה: `localStorage['agam_farm_v2']`, ואם מחוברת וקיימת שמירה בענן, משיכה משם.
3. `World` בונה סצנה → חווה (`Horses/Animals/Fields`) → אזורים → `Models3D` מחליף ציורים במודלים.
4. כל פעולה: `askProblem(actionType, onCorrect)` → `generateProblem` לפי `Game.mastery` → `UI` מציג → נכון = הפעולה מתבצעת + מטבעות (רק בניסיון ראשון).
5. כל שינוי מצב: `Game.save()` → localStorage מיד, ו-`Cloud.push()` מאוגד אחרי 1.5 שניות (רק לחשבון שנקשר ב-boot).

## 5. מודל הנתונים
**במכשיר (localStorage):**
- `agam_farm_v2`: כל מצב החווה (coins/xp/level/stars/settings/typeStats/mastery/quests/upgrades/story/horses/fields/animals/placed/decorPos/savedAt...).
- `agam_farm_owner`: מי מחזיקה את השמירה במכשיר (הגנת מכשיר משותף).
- `agam_sb_auth`: ה-session של Supabase · `agam_local_email`: החשבון הפעיל במכשיר.

**בענן:** Supabase `xgqetnlsesgwiypufodf` (חשבון hilelltohar). ⚠️ **משותף עם פורטל קגן** (אותו Auth ואותו מסד). לכן: אסור `supabase db push`, מריצים SQL קובץ-קובץ דרך Management API, וכל משתמשת חווה מסומנת `app_metadata.agam_farm = true`.
- `game_saves(user_id PK, data jsonb, updated_at)` · `farm_profiles(user_id PK, name, level, updated_at)`.
- **נוצר ב-29.10.2026** מ-`supabase/sql/001_farm_core.sql` (הרצה: `python scripts/run_sql.py <קובץ>`).
- **מחיצה:** כל מדיניות דורשת `public.is_farm_user()` = `app_metadata.agam_farm` בטוקן. קריאה: כל משתמשות החווה (ביקור אצל חברה). כתיבה: רק השורה של עצמך. anon: אין גישה בכלל.
- `public.has_farm()` עם **security definer**, כי מדיניות שמפנה לאותה טבלה ישירות = רקורסיה אינסופית.
- **נגד הצפה:** `game_saves_size` (עד 256KB), טריגר `farm_save_throttle` (עדכון אחד לשנייה לאותה שורה, `updated_at` נקבע בשרת).
- **הגבלת קצב:** `farm_rate_hits` + `farm_rate_check(key, limit, window_s)` (רק service role). משותף לכל מופעי השרתונים.
- **בדיקה:** `supabase/sql/tests/001_rls_test.sql` (מתבטל אחרי עצמו). 29.10: כל 11 הבדיקות עברו, כולל משתמש בלי סימון חווה שרואה 0 שורות.
- **עדיין ריק:** אף משתמש לא מסומן חווה עד שהכניסה בגוגל תעלה.
- במסד יש גם טבלאות דמו ישנות של ג'ף (06.2026, נטושות). ג'ף החי רץ בחשבון נפרד. למחוק רק באישור הלל.

## 6. API
| שרתון | קלט | פלט | מצב |
|---|---|---|---|
| `farm-claim` | POST, `Authorization: Bearer <טוקן גוגל מ-Supabase>` | `200 {ok}` + סימון `agam_farm` · `403 google_required / not_allowed` · `401` · `429` | **כתוב, לא פרוס** |
| `farm-email-login` | POST `{email}` | session בלי סיסמה | **לא פרוס, יימחק**: מי שיודע מייל מורשה נכנס כמוהו |
| `admin-users` | כותרת `x-admin-token` | רשימת משתמשות חווה בלבד + איפוס למשתמשת חווה בלבד · `429` | הגרסה הפרוסה עדיין מציגה את כל משתמשי המסד המשותף. התיקון כתוב, ממתין לפריסה |

רשימת המורשים: סוד `FARM_ALLOWED_EMAILS` בשרת (הקובע) + טביעות ב-`js/net/allowlist.js` (הודעה ידידותית בלבד).

## 7. גיבויים ושחזור
- משימה מתוזמנת `AgamFarmBackup` כל לילה ב-23:30 → `scripts/backup/backup.ps1`:
  - `C:\Backups\agam-horse-farm\git\YYYY-MM-DD.bundle`: כל הענפים וכל ההיסטוריה.
  - ענף `backup/auto` ב-GitHub: צילום של התיקייה כולל עבודה לא שמורה (Vercel לא פורס אותו).
  - `C:\Backups\agam-horse-farm\db\YYYY-MM-DD.json`: שורות החווה מהמסד (לא ל-GitHub, יש שם שמות של ילדות) + עותק לשרת הישן `C:/server/backups/`.
  - יומן: `C:\Backups\agam-horse-farm\logs\`. נשמר 30 יום.
- **שחזור:**
  1. כל הפרויקט מגיבוי: `git clone C:\Backups\agam-horse-farm\git\<תאריך>.bundle agam-restore`
  2. עבודה לא שמורה מאתמול: `git fetch origin backup/auto && git checkout FETCH_HEAD -- <קובץ>`
  3. מסד: מעלים את שורות ה-JSON בחזרה עם service role (`upsert` ל-`game_saves`/`farm_profiles`).

## 8. סודות (מצביעים בלבד)
`C:\Users\saraa\.secrets\agam-horse-farm.env`: URL, anon, access token, service role (לגיבוי בלבד), `ADMIN_PANEL_TOKEN`. מפתח ה-anon בקוד ציבורי ובטוח (מוגן RLS).

## 9. בדיקות
- `node --check` על כל קובץ שנגעו בו.
- `python scripts/smoke.py` (מקומי) או `python scripts/smoke.py https://agam-horse-farm.vercel.app/` (חי): המשחק עולה, כל המודולים נטענים, 0 שגיאות קונסול, 0 קבצים חסרים, במחשב ובאמולציית Pixel 7.
- בטלפון אמיתי: עדיין ידני (הלל/אגם).

## 10. יומן שינויים
- **2026-10-29** · אבטחה במסד: טבלאות + RLS לפי סימון חווה + תקרת גודל + טריגר נגד הצפה + הגבלת קצב (`001_farm_core.sql`), כולל בדיקת מחיצה שעברה. נכתבו `farm-claim` ותיקון ל-`admin-users` (לא פרוסים).
- **2026-10-29** · מבנה היררכי: `js/` פוצל ל-engine/farm/areas/minigames/systems/net/ui, מסמכים ל-`docs/`, נוצרו `CONTEXT.md` ו-`scripts/smoke.py`. CACHE v23. נבדק ב-smoke (מחשב + טלפון): 29 מודולים, 0 שגיאות.
- **2026-10-28** · גיבוי לילי (bundle + `backup/auto` + מסד) ו-`vercel.json` שחוסם פריסת ענפי גיבוי. שחזור ניסיון מה-bundle עבר.
