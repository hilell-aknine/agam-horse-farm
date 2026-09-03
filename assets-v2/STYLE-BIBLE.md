# ספר הסגנון — נכסי החווה של אגם

אותו קונספט שהופעל על משחק ה-NLP בבית המטפלים, אבל **הסגנון נגזר מהמשחק הזה**, לא מועתק ממנו.
זה משחק לילדה בת 6. זהב על טורקיז כהה היה הורג אותו.

## למה בכלל מחליפים
הנכסים הקיימים נוצרו ב-FAL: Flux dev → חיתוך BiRefNet → חידוד PIL.
שתי בעיות שנראות בעין:
1. **הילה לבנה רכה** סביב הדמויות, שריד של החיתוך האוטומטי.
2. **חדות לא אחידה.** חלק מהנכסים מטושטשים ממש (`barn.png` הוא הדוגמה הבולטת).

gpt-image-2 מייצר אלפא נקייה ישירות עם `--background transparent`, בלי שלב חיתוך.
זה מבטל את שני הפגמים במקור, ולא בדיעבד.

## עלות
FAL עלה עד היום כ-11.3₪ מתוך תקציב 30₪.
**המסלול החדש חינם**, gpt-image-2 דרך Codex על המנוי.
אם הלוג מדפיס `falling back to FAL` הריצה נעצרת מיד. זה כסף אמיתי.

## STYLE_PREFIX (קבוע, באנגלית)
```
Flat vector illustration in the style of a die-cut sticker, for a cheerful
children's mobile farm game. Clean crisp sharp vector art. Bold uniform dark
outline of even thickness around the entire shape. Simple flat colour fills
with one soft shading tone, no complex gradients. Bright, warm, saturated,
cheerful palette. High contrast. Friendly rounded shapes, cute and gentle,
made for a six year old. A single subject only, centred, full body inside the
frame, seen straight on or from a slight three-quarter front angle. Isolated
on a fully transparent background. SUBJECT:
```

## NEGATIVE (קבוע)
```
No text, no letters, no numbers, no watermark, no logo. No photorealism, no 3D
render, no painterly texture. No blur, no soft focus, no white halo, no glow.
No drop shadow, no ground shadow, no background scenery, no frame, no border.
Only one object in the image.
```

**למה "בלי טקסט":** מודלי תמונה לא כותבים עברית. כל כיתוב במשחק נשאר HTML מעל.
**למה "בלי צל":** הנכסים מונחים על העולם דינמית, צל צרוב נראה שבור.
**למה "אובייקט אחד":** נכס שמכיל שני דברים אי אפשר להציב במשחק.

## מידות ייצור (זהות לקיים)
| קבוצה | מידה | רקע |
|---|---|---|
| 89 ספרייטים | 1024x1024 | שקוף |
| `title_farm` | 1024x576 | שקוף |
| `icon-180/192/512` | לפי המקור | **אטום**, זה אייקון האפליקציה |

עודכן: 2026-09-02
