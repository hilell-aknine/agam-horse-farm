# CLAUDE.md — החווה של אגם (חוקי הרצה מקומיים)

**[Tier 4 — אישי/תחביב]** · מוח-העל: `SKILL.md` · סטטוס חי: `primer.md` + `dashboard\PROJECTS_STATE.md`.

## Startup
1. קרא `SKILL.md` (זהות) + `primer.md` (איפה אנחנו) + `hindsight.md` (גוטצ'ות).
2. אם ריצה/צילום צריך — הפעל שרת מקומי: `python -m http.server 8753` (חובה http, לא file:// בגלל ES modules).

## ארכיטקטורה
- Vanilla JS + Three.js מקומי (importmap) — **אין שלב build, אין npm run**. עורכים קובץ → מרעננים דפדפן.
- כל שינוי קוד: `node --check js/<file>.js` לפני. אימות ויזואלי: Chrome headless (`--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --screenshot`).
- מודולים דיסיוינטיים (אזורים/מיני-משחקים) — מושלם לפיצול טורבו. שכבות חוצות-מערכת (state/HUD/save) — לבנות ישירות (טורבו יוצר התנגשויות).

## פריסה
- `git push origin main` → **Vercel בונה מחדש אוטומטית** (חובר דרך GitHub). אין Vercel CLI.
- לפני push: `node --check` על כל הקבצים + טעינת-headless ללא שגיאות קונסול.
- קומיט מסיים ב-Co-Authored-By + Claude-Session (פרוטוקול git).

## Supabase
- מפתחות ב-`.secrets\agam-horse-farm.env`. anon key **ציבורי-בטוח** בצד-לקוח (מוגן RLS).
- Management API (יצירת טבלה/הפעלת auth): חובה header `User-Agent: Mozilla/...` אחרת Cloudflare מחזיר 403/1010.

## חוקי תוכן
- הכל עברית, לשון נקבה (פונים לאגם). כפתורים גדולים, הקראה קולית, בלי מסכי-כישלון.
- כל פעולה עוברת דרך `askProblem` (קושי מותאם + מעקב פעילות). משוואות LTR.
- אמנות חדשה: `tools/gen_*.py` (Flux flat-vector + BiRefNet). אישור עלות לפני ריצה גדולה — יש תקציב 30₪ (נוצל ~11.3₪).

## מה לא לשבור
- נתיב ASCII (לא להעביר לתיקייה עברית — שובר ריצה/spawn).
- `preserveDrawingBuffer:true` על ה-renderer (נחוץ לצילום).
- far-plane מצלמה (400) חייב להיות > רדיוס-שמיים (200).
