// contest.js — מיני-מנגנון "תחרות היופי" 🏆
// מודול ES עצמאי: בוחרים סוס מטופח, פותרים תרגיל חשבון, וזוכים בפרס + סרט.
// כל הטקסטים בעברית, פונים לילדה בת 6 בלשון נקבה.
// נכתב כ-factory שמקבל את כל התלויות מבחוץ — לא נוגע באף קובץ אחר.

export function createContest(deps) {
  const { root, Game, Horses, askProblem, spawnAt, Audio, UI, saveAll } = deps;

  // ----- הזרקת CSS פעם אחת בלבד -----
  injectStyleOnce();

  // ====================================================================
  // open() — נקודת הכניסה: בונה את חלון בחירת הסוס
  // ====================================================================
  function open() {
    Audio && Audio.click && Audio.click();

    // אין סוסים? הודעה עדינה ויציאה.
    if (!Horses || !Horses.list || Horses.list.length === 0) {
      const ov = buildOverlay();
      const card = ov.querySelector('.card');
      card.insertAdjacentHTML('beforeend', `
        <div class="contest-empty">
          <span class="contest-empty-emoji">🐴</span>
          <p class="contest-empty-text">אין לך סוסים עדיין</p>
          <p class="contest-empty-sub">קני סוס קודם ואז נתחרה!</p>
        </div>`);
      return;
    }

    // יש סוסים — בונים רשת בחירה
    const ov = buildOverlay();
    const card = ov.querySelector('.card');

    const grid = document.createElement('div');
    grid.className = 'contest-grid';

    for (const horse of Horses.list) {
      const m = horse.mood();
      const face = m > 70 ? '😄' : m > 40 ? '🙂' : '🥺';
      const btn = document.createElement('button');
      btn.className = 'contest-horse';
      btn.innerHTML = `
        <span class="contest-horse-face">${face}</span>
        <span class="contest-horse-name">${horse.name}</span>`;
      btn.onclick = () => onPick(horse, ov);
      grid.appendChild(btn);
    }
    card.appendChild(grid);

    // אזור הודעת "צריך לטפח" (מתמלא רק כשבוחרים סוס לא מוכן)
    const note = document.createElement('div');
    note.className = 'contest-note hidden';
    card.appendChild(note);
  }

  // ====================================================================
  // onPick(horse, ov) — בחירת סוס. בודק אם מטופח מספיק.
  // ====================================================================
  function onPick(horse, ov) {
    Audio && Audio.click && Audio.click();

    if (horse.mood() < 70) {
      // לא מוכן — הודעה עדינה + שלושת הפסים, בלי להמשיך.
      const note = ov.querySelector('.contest-note');
      note.classList.remove('hidden');
      note.innerHTML = `
        <p class="contest-note-text">צריך לטפח את ${horse.name} קודם! (להאכיל, לנקות, לשחק)</p>
        <div class="contest-bars">
          ${bar('שובע 🍎', horse.hunger)}
          ${bar('ניקיון 🧼', horse.clean)}
          ${bar('שמחה 🎈', horse.happy)}
        </div>`;
      Audio && Audio.speak && Audio.speak('צריך לטפח את ' + horse.name + ' קודם');
      return;
    }

    // מוכן! סוגרים את הבורר ועוברים לתרגיל החשבון.
    closeOverlay(ov);
    askProblem('buy', res => award(horse, res));
  }

  // ====================================================================
  // award(horse, res) — מעניק את הפרס וחוגג
  // ====================================================================
  function award(horse, res) {
    const prize = 25 + Game.level * 2;

    // עדכון מצב המשחק
    Game.coins += prize;
    Game.ribbons = (Game.ribbons || 0) + 1;

    // אנימציות בעולם התלת-ממד
    horse.celebrate();
    horse.setAccessory('🏅');
    spawnAt(horse.group.position.x, horse.group.position.z, 'confetti', 20);

    // צליל + דיבור
    Audio && Audio.fanfare && Audio.fanfare();
    Audio && Audio.speak && Audio.speak(horse.name + ' זכה בתחרות!');

    // חלון חגיגה
    showCelebration(horse, prize);

    // עדכון HUD ושמירה
    UI && UI.updateHUD && UI.updateHUD(Game);
    saveAll && saveAll();
  }

  // ====================================================================
  // showCelebration(horse, prize) — חלון "זכית במקום הראשון"
  // ====================================================================
  function showCelebration(horse, prize) {
    const ov = document.createElement('div');
    ov.className = 'overlay light contest-ov';
    ov.dir = 'rtl';

    const card = document.createElement('div');
    card.className = 'card contest-win-card';
    card.innerHTML = `
      <div class="contest-medal">🏅</div>
      <h2 class="contest-win-title">${horse.name} זכה במקום הראשון!</h2>
      <p class="contest-win-prize">קיבלת ${prize} מטבעות 🪙 + סרט 🎀</p>
      <button class="btn-big contest-win-btn">יש! ✨</button>`;

    ov.appendChild(card);
    root.appendChild(ov);

    const finish = () => { Audio && Audio.click && Audio.click(); closeOverlay(ov); };
    card.querySelector('.contest-win-btn').onclick = finish;
    // לחיצה על הרקע סוגרת
    ov.onclick = (e) => { if (e.target === ov) finish(); };
  }

  // ====================================================================
  // עוזרים פנימיים
  // ====================================================================

  // בונה שכבת-כיסוי בסיסית עם כרטיס, כפתור סגירה וכותרת. מחזיר את ה-overlay.
  function buildOverlay() {
    const ov = document.createElement('div');
    ov.className = 'overlay light contest-ov';
    ov.dir = 'rtl';

    const card = document.createElement('div');
    card.className = 'card contest-card';
    card.innerHTML = `
      <button class="close contest-close">✖</button>
      <h2 class="contest-title">🏆 תחרות היופי</h2>`;

    ov.appendChild(card);
    root.appendChild(ov);

    // סגירה בכפתור ✖
    card.querySelector('.contest-close').onclick = () => {
      Audio && Audio.click && Audio.click();
      closeOverlay(ov);
    };
    // לחיצה על הרקע (לא על הכרטיס) סוגרת
    ov.onclick = (e) => { if (e.target === ov) closeOverlay(ov); };

    return ov;
  }

  function closeOverlay(ov) {
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  // פס סטטיסטיקה — תואם לעיצוב הקיים של כרטיס הסוס.
  function bar(label, val) {
    const v = Math.round(val);
    const col = v > 60 ? '#5fbf5f' : v > 30 ? '#e8b53a' : '#e06b6b';
    return `<div class="barrow"><span class="barlbl">${label}</span>
      <div class="bartrack"><div class="barfill" style="width:${v}%;background:${col}"></div></div></div>`;
  }

  // החזרת ה-API הציבורי
  return { open };
}

// ======================================================================
// CSS — מוזרק פעם אחת. כל המחלקות עם תחילית .contest- כדי לא להתנגש.
// ======================================================================
function injectStyleOnce() {
  if (document.getElementById('contest-styles')) return;
  const style = document.createElement('style');
  style.id = 'contest-styles';
  style.textContent = `
  .contest-card{ text-align:center; }
  .contest-title{ font-family:'Fredoka','Heebo',sans-serif; font-size:30px; color:#0a4d57;
    margin:6px 0 16px; }

  /* רשת הסוסים לבחירה */
  .contest-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:6px 2px; }
  .contest-horse{ background:#fff; border-radius:22px; padding:14px 8px; display:flex;
    flex-direction:column; align-items:center; gap:6px; cursor:pointer;
    box-shadow:0 5px 0 #e7d8b0,0 8px 14px rgba(0,0,0,.1);
    transition:transform .1s,box-shadow .1s; font-family:'Heebo',sans-serif; }
  .contest-horse:active{ transform:translateY(3px); box-shadow:0 2px 0 #e7d8b0; }
  .contest-horse-face{ font-size:44px; line-height:1; }
  .contest-horse-name{ font-size:19px; font-weight:700; color:#0a4d57; }

  /* הודעת "צריך לטפח" */
  .contest-note{ margin:14px 4px 4px; background:#eef9ff; border-radius:18px; padding:12px 14px; }
  .contest-note-text{ color:#1d8a99; font-weight:700; font-size:17px; margin:0 0 8px; line-height:1.4; }
  .contest-bars{ margin:4px 2px; }

  /* מצב ריק */
  .contest-empty{ text-align:center; padding:18px 8px 8px; }
  .contest-empty-emoji{ font-size:64px; display:block; }
  .contest-empty-text{ font-family:'Fredoka','Heebo',sans-serif; font-size:24px; color:#0a4d57;
    font-weight:700; margin:10px 0 4px; }
  .contest-empty-sub{ font-size:17px; color:#1d8a99; font-weight:700; margin:0; }

  /* חלון חגיגה */
  .contest-win-card{ text-align:center; padding:30px 28px; }
  .contest-medal{ font-size:88px; animation:contest-pop .5s, bounce 2s .5s infinite; }
  .contest-win-title{ font-family:'Fredoka','Heebo',sans-serif; font-size:30px; color:#d9722a;
    margin:8px 0; line-height:1.25; }
  .contest-win-prize{ font-size:20px; color:#0a4d57; font-weight:700; margin:0 0 20px; }
  .contest-win-btn{ font-size:24px; }

  @keyframes contest-pop{ 0%{ transform:scale(.4); } 70%{ transform:scale(1.15); } 100%{ transform:scale(1); } }
  `;
  document.head.appendChild(style);
}
