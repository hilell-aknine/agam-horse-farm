# hindsight.md — לקחים

פורמט: `[תאריך] נושא — מה קרה → הלקח`.

- **[2026-06-30] Sprite.rotation מקפיא את המשחק** — `sprite.rotation += dt` על Object3D/Sprite זורק TypeError ב-strict mode (ES modules), הלולאה מתה ברגע שנוצר החלקיק הראשון (תשובה נכונה ראשונה). → לחלקיקי-Sprite להשתמש ב-`material.rotation`, לא ב-`.rotation`. תפסתי רק בגלל שהחלקיקים לא נוצרים לפני תשובה נכונה — צילום headless של מסך-הפתיחה לא חושף באגים שקורים תוך-כדי-משחק.

- **[2026-06-30] Flux מרנדר מושאים מבודדים רך/מטושטש** — סצנות שלמות יוצאות חדות, אבל מושא בודד על רקע לבן יוצא airbrushed. → מתכון "flat vector / die-cut sticker" + guidance 6 + 40 steps + BiRefNet cutout + PIL UnsharpMask = חד. (ראה `reference_fal_ai_pipeline`.)

- **[2026-06-30] LTR של משוואות** — ב-RTL, "3 + 2 = ?" מתרנדר הפוך ("? = 2 + 3"). → דגל `problem.ltr` (add/sub/missing=LTR, השאר RTL) ו-`direction:ltr` על אלמנט השאלה. **באג עדין:** הדגל נוסף רק לנתיב focusType, לא לנתיב הרגיל — כל משחק רגיל היה שבור. תמיד לעטוף את *כל* נקודות-היציאה (`_mark`).

- **[2026-06-30] Supabase Management API חוסם python** — `api.supabase.com` מחזיר 403 "error code: 1010" ל-`Python-urllib` (חסימת Cloudflare לפי User-Agent, לא טוקן פגום; curl עובד). → header `User-Agent: Mozilla/...`. (ראה `reference_supabase_management_api_user_agent`.)

- **[2026-07-01] far-plane מול רדיוס-שמיים** — הגדלת כדור-השמיים ל-200 עם far-plane מצלמה=200 → שמיים שחורים למעלה (נחתך). → far-plane חייב להיות גדול מרדיוס-השמיים (הועלה ל-400).

- **[2026-07-01] headless virtual-time לא מריץ אנימציית-נסיעה** — `clock.getDelta()` תחת `--virtual-time-budget` לא מתקדם כמו בדפדפן אמיתי, אז lerp-מבוסס-dt (נסיעת-מצלמה) לא מתכנס בצילום. → לבדיקות, לקבע את היעד ישירות (`controls.target.set` + `camera.position.set`) במקום להסתמך על האנימציה.

- **[2026-06-30] מרוץ-תזמון boot מול וו-בדיקה** — `boot()` האסינכרוני (המתנה לענן) קורא `UI.showTitle()` בסוף, ולפעמים דורס `startGame()` שנקרא מוקדם מוו-בדיקה. לא משפיע על משתמש אמיתי (הוא לוחץ Play אחרי הטעינה). → לזכור בזמן צילומי-headless עם `#auto`.

- **[2026-07-01] חידוד אמנות בלי FAL** — הציורים כבר 1024×1024 (רזולוציה לא הצוואר); הרכות מגיעה מה-airbrush של Flux. חידוד "כל האלמנטים" בבת אחת בלי עלות = שני מנופים: (1) `renderer.capabilities.getMaxAnisotropy()` במקום anisotropy קבוע=4; (2) מעבר PIL מקומי `UnsharpMask + Contrast + Color` שמשמר אלפא (מעבד רק RGB, מחזיר את ערוץ האלפא המקורי). `tools/enhance.py preview` מייצר גריד השוואה (subtle/medium/punchy) → הלל בוחר → `apply`. המקור שמור בהיסטוריית git (שחזור: `git checkout HEAD~1 -- assets/`). medium = נקודת המתיקה; punchy מגזים בסטורציה.

- **[2026-07-01] אימות מודול-אזור בלי דפדפן** — אזורים נבנים רק אחרי לחיצת Play, אז טעינת-headless של מסך-הפתיחה לא מריצה `build*()` ולא חושפת באגי-ריצה במודול. → לכל מודול-אזור/מיני-משחק: הרמס node עם `deps` מדומה שמריץ את `build*()`, מפעיל כל `activity()` שנרשמה (עם res.correct=true), ומריץ כמה פריימים של `onUpdate` — תופס קריאות-API שבורות וחריגות תגמול תוך שניות, בלי דפדפן. (fair_area אומת כך.)

- **[2026-06-30] טורבו לקבצים דיסיוינטיים בלבד** — סוכנים במקביל מצוינים למודולי-אזור/מיני-משחק (קובץ לכל אחד, חוזה `deps`). שכבות חוצות-מערכת (state+HUD+save+audio) — לבנות ישירות; פיצול = התנגשויות. טריק: לעטוף `grantReward` פר-אזור כדי לעקוב אחרי פעילויות בלי לגעת בקבצי-הסוכנים.
