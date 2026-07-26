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
- **[2026-07-02] RLS שמפנה לאותה טבלה = רקורסיה אינסופית** — מדיניות SELECT על `farm_profiles` עם `exists(select 1 from farm_profiles ...)` בתוכה מפילה כל שאילתה ("infinite recursion detected in policy"). → פונקציית `security definer` (`public.has_farm()`) שעוקפת את ה-RLS בבדיקה עצמה, והמדיניות קוראת לה.

- **[2026-07-02] גרשיים עבריים ב-git commit -m שוברים את PowerShell 5.1** — הודעת commit עם "מרכאות" בעברית עוברת לגיט כארגומנטים מפוצלים (native arg passing), הקומיט נכשל עם pathspec errors. → תמיד `git commit -F קובץ-הודעה` (הקובץ נכתב עם Write tool).

- **[2026-07-02] ביקור בחווה של חברה = ריענון עם ?visit, לא טעינה דינמית** — ה-state של העולם (מודולים, sprites, updaters) לא בנוי לפירוק. טעינת חווה זרה עשויה בזול ובאמינות ע"י ניווט ל-`?visit=<user_id>&name=<שם>` ובנייה רגילה מנתוני החברה + דגל `Game.visiting` שחוסם את כל נקודות הכתיבה (askProblem/חנות/גלגל/reset/saveAll). דרוש `ignoreSearch:true` ב-service worker כדי ש-PWA יגיש את index.html גם עם query.

- **[2026-07-02] מכשיר משותף: הרשמה חדשה "גונבת" שמירה מקומית** — לוגיקת ה-claim (העלאת localStorage לחשבון החדש) נכונה לאגם אבל מסוכנת כשחברה נרשמת בטאבלט שלה. → מפתח `agam_farm_owner` ב-localStorage: אם השמירה שייכת לחשבון אחר, הרשמה חדשה מתחילה נקי וה-boot לא מערבב. **הרחבה (07-02 ערב):** הכלל הישן ניקה שמירה זרה רק אם `owner` ידוע — משחק-אורח (owner=null) עדיין זלג לחשבון חדש. תוקן: "בעלים לא ידוע" = לא-שלי → מנקים. `claimDeviceForCurrentUser` רץ גם בכניסה וגם בהרשמה, לפני ה-reload.

- **[2026-07-02] cache-first ב-Service Worker = מוות שקט לכל תיקון** — ה-SW היה `caches.match` קודם (עם `ignoreSearch:true`), אז משתמש מותקן קיבל את הקוד הישן **לנצח**; במפ-גרסה לבד לא הספיק והלל דיווח שוב ושוב "לא עובד" על פיצ'רים שכן היו בקוד. → **network-first**: `fetch(req)` קודם (מעדכן מטמון), ו-`catch → caches.match` רק כשאין רשת. בפיתוח פעיל / הפצה לקהל — זו ברירת-המחדל הנכונה, לא cache-first.

- **[2026-07-02] בדיקה סינתטית ≠ קלט אמיתי (drag)** — גרירת פריטים "עבדה" ב-`dispatchEvent(PointerEvent)` אבל הלל אמר שלא עובד. dispatchEvent עוקף את שכבת ה-browser (OrbitControls, `touch-action`, pointer-capture). → לבדוק קלט אמיתי עם `page.mouse.down/move/up` (עכבר) ו-CDP `Input.dispatchTouchEvent` (מגע). שניהם עבדו — מה שאישר שהבעיה מטמון, לא לוגיקה.

- **[2026-07-02] "לעצב את החווה" = גם קישוטי ברירת-המחדל, לא רק שנקנו** — מצב-עיצוב שגורר רק פריטי-חנות נראה שבור בחווה טרייה (אין מה לגרור). → כל קישוטי-החווה הנקובים (`decor()` תחת דגל `_decorMovable` ב-placeDecor/placeZones) ניתנים לגרירה, נשמרים ב-`Game.decorPos` לפי `decorId` יציב (סדר יצירה, לפני כל קוד מותנה). הרקע הפזור (scatter) נשאר קבוע. גרירה מעדכנת ספרייט+צל+רשומה יחד ונצמדת ל-`World.fenceR`.

- **[2026-07-26] הסרת רקע לבן = flood-fill מהקצוות, לא white→alpha** — תמונות ג'מיני עם גוף לבן (סוס-קשת, עז): המרת "כל פיקסל לבן→שקוף" מוחקת גם את הגוף. הפתרון (`tools/integrate_gemini.py`): לתייג רק פיקסלים לבנים **מחוברים לקצה** (scipy.ndimage.label + רכיבים שנוגעים בגבול) → שקוף, והלבן הפנימי נשמר. + autocrop + מרכוז על קנבס 1024² תואם לקיימים.
- **[2026-07-26] מצב-אורח פתר גם את אימות ההדסלס** — שער ההרשמה חסם צילומי-מסך אוטומטיים. כפתור "לשחק בלי חשבון" (דגל דביק `agam_guest`, מדלג על `showAuthGate` ב-boot) איפשר ל-Playwright להיכנס לחווה בלי Supabase auth. פיצ'ר UX שגם שירת בדיקה.
- **[2026-07-26] Playwright MCP קורס לסירוגין (נעילת פרופיל)** — "Browser is already in use ... mcp-chrome-*". פתרון: להרוג רק תהליכי chrome עם `mcp-chrome`/`ms-playwright-mcp` ב-CommandLine (PowerShell CIM), לא את הכרום של הלל, ואז לנווט מחדש. הדף גם נסגר באמצע לפעמים → פשוט לנווט שוב.
- **[2026-07-26] פאנל אדמין ל-static+Supabase = Edge Function, לא בצד-לקוח** — `admin-users` משתמש ב-`SUPABASE_SERVICE_ROLE_KEY` (מוזרק אוטומטית לפונקציות Supabase, לא נשמר בקוד/סקרטס), חסום בטוקן-אדמין בהשוואת-זמן-קבוע (401 בלי טוקן), פרוס `--no-verify-jwt` + הדף שולח `apikey`+`Authorization: Bearer <anon>` לשער. **סיסמאות לא ניתנות לשחזור** (hash) — רק `auth.admin.updateUserById` לאיפוס.
- **[2026-07-26] החלפת-טקסטורה פר-פריים בטוחה = מטמון משותף + שמירת _curTex + הגנת dispose** — תנוחות סוס (רץ/ישן): להחליף `material.map` רק כשה-URL משתנה (`this._curTex`), עם `loadTexture(url, true)` (shared cache), ולא לשחרר ב-`dispose` טקסטורה שנמצאת ב-`World._texCache` (משותפת בין סוסים). בלי זה — דליפת טקסטורות + גמגום.
