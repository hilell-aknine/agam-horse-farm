// ui.js — שכבת DOM: מסכים, HUD, כרטיס סוס, חנות, חלון תרגיל חשבון (עברית RTL)
import { Audio } from '../systems/audio.js';
import { SHOP, CROPS } from '../systems/game.js';
import { Cloud } from '../net/cloud.js';

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

// צבעים לסוס בחנות הצבעים (כרטיס הסוס)
const PAINTS = [
  { id: 'brown', name: 'חום', cost: 120 }, { id: 'white', name: 'לבן', cost: 120 },
  { id: 'golden', name: 'זהוב', cost: 120 }, { id: 'gray', name: 'אפור', cost: 120 },
  { id: 'black', name: 'שחור', cost: 120 }, { id: 'spotted', name: 'מנומר', cost: 120 },
  { id: 'pink', name: 'ורוד', cost: 160 }, { id: 'unicorn', name: 'חד-קרן', cost: 250 },
  { id: 'rainbow', name: 'קשת', cost: 350 }
];

const ACTIONS = {
  feed:    { icon: '🥕', label: 'להאכיל' },
  brush:   { icon: '🧼', label: 'לנקות' },
  play:    { icon: '🎾', label: 'לשחק' },
  grow:    { icon: '🌱', label: 'לגדול' },
  plant:   { icon: '🌱', label: 'לשתול' },
  harvest: { icon: '🌾', label: 'לקצור' },
  buy:     { icon: '🛒', label: 'לקנות' },
  field:   { icon: '🟫', label: 'שדה חדש' },
  race:    { icon: '🏁', label: 'מירוץ' },
  jump:    { icon: '🐎', label: 'משוכה' },
  sell:    { icon: '💰', label: 'למכור' },
  birth:   { icon: '🍼', label: 'גור חדש' },
  ride:    { icon: '🎡', label: 'רכיבה' },
  game:    { icon: '🎯', label: 'משחק' },
  treat:   { icon: '🍭', label: 'ממתק' },
  growNow: { icon: '⚡', label: 'לגדל מיד' },
  morning: { icon: '🌅', label: 'בוקר טוב' }
};

const UI = {
  root: null, handlers: {},
  hud: null, els: {},
  _mathOpen: false,

  init(handlers) {
    this.handlers = handlers || {};
    this.root = document.getElementById('ui');
    this._buildTitle();
    this._buildHUD();
    this._buildSettings();
  },

  // ---------- מסך פתיחה ----------
  _buildTitle() {
    const s = el('div', 'screen title-screen hidden');
    s.id = 'titleScreen';
    s.innerHTML = `
      <div class="title-card">
        <img class="title-hero" src="assets/title_farm.png" alt="" onerror="this.remove()">
        <div class="title-emoji">🐴</div>
        <h1 class="game-title">החווה של אגם</h1>
        <p class="game-sub" id="titleHello">מגדלים סוסים ולומדים חשבון!</p>
        <button class="btn-big btn-play" id="playBtn">בואו נשחק! ▶</button>
        <button class="btn-ghost" id="titleFriends">👭 החוות של החברות</button>
        <button class="btn-ghost" id="titleSettings">⚙️ הגדרות</button>
        <button class="btn-ghost" id="titleSwitch">🔄 להחליף שחקנית</button>
        <p class="credit">נבנה באהבה ע״י אבא 💙</p>
      </div>`;
    this.root.appendChild(s);
    s.querySelector('#titleSwitch').onclick = () => { Audio.click(); this.handlers.onSwitchPlayer && this.handlers.onSwitchPlayer(); };
    s.querySelector('#playBtn').onclick = () => { Audio.resume(); Audio.click(); this.handlers.onStart && this.handlers.onStart(); };
    s.querySelector('#titleSettings').onclick = () => { Audio.click(); this.openSettings(); };
    s.querySelector('#titleFriends').onclick = () => { Audio.resume(); Audio.click(); this.handlers.onFriends && this.handlers.onFriends(); };
  },

  showTitle() {
    const g = this.handlers.getGame && this.handlers.getGame();
    const name = g ? g.playerName() : '';
    const hello = document.getElementById('titleHello');
    if (hello) hello.textContent = name ? 'שלום ' + name + '! מגדלים סוסים ולומדים חשבון!'
      : (Cloud.accountEmail() ? 'מגדלים סוסים ולומדים חשבון!' : 'משחקת בלי חשבון · מגדלים סוסים ולומדים חשבון!');
    document.getElementById('titleFriends').classList.toggle('hidden', !Cloud.loggedIn());
    // החלפת שחקנית: מחוברת → יציאה לשער, אורחת → חזרה לשער
    const sw = document.getElementById('titleSwitch');
    if (sw) sw.classList.remove('hidden');
    document.getElementById('titleScreen').classList.remove('hidden');
    this.hud.classList.add('hidden');
  },
  showGame() { document.getElementById('titleScreen').classList.add('hidden'); this.hud.classList.remove('hidden'); },

  // ---------- שער כניסה: הרשמה / כניסה (דף הבית לכל שחקנית) ----------
  showAuthGate() {
    let s = document.getElementById('authScreen');
    if (s) { s.classList.remove('hidden'); return; }
    s = el('div', 'screen title-screen');
    s.id = 'authScreen';
    s.innerHTML = `
      <div class="title-card auth-card">
        <img class="title-hero" src="assets/title_farm.png" alt="" onerror="this.remove()">
        <div class="title-emoji">🐴</div>
        <h1 class="game-title">החווה של אגם</h1>
        <p class="game-sub">לכל חברה יש חווה משלה בעולם!</p>
        <button class="btn-big btn-play gate-play" id="agGuest">בואי נשחק! ▶</button>
        <div class="auth-note">משחקות בלי חשבון · החווה נשמרת במכשיר הזה</div>
        <button class="btn-ghost gate-parents" id="agParents">👤 כניסה במייל של אמא או אבא</button>
        <div id="parentBox" class="hidden"></div>
        <p class="credit">נבנה באהבה ע״י אבא 💙</p>
      </div>`;
    this.root.appendChild(s);
    s.querySelector('#agGuest').onclick = () => { Audio.resume(); Audio.click(); this.handlers.onGuest && this.handlers.onGuest(); };
    s.querySelector('#agParents').onclick = () => {
      Audio.click();
      const box = s.querySelector('#parentBox');
      box.classList.toggle('hidden');
      if (!box.classList.contains('hidden')) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    this._emailLoginForm(s.querySelector('#parentBox'));
  },

  // ---------- כניסה במייל של הורה בלבד (בלי סיסמה, רק מייל מורשה) ----------
  // שדה אחד: מייל. מורשה → מסך "מי משחקת?". לא מורשה → הודעה רכה, ואפשר להמשיך לשחק בלי חשבון.
  _emailLoginForm(box) {
    box.innerHTML = `
      <input class="auth-in" data-f="email" type="email" placeholder="המייל של אמא או אבא" dir="ltr" autocomplete="email">
      <button class="btn-big btn-play" data-f="go">נכנסות לחווה! 🐴</button>
      <div class="auth-msg" data-f="msg"></div>
      <div class="auth-note">בלי סיסמה. רק מייל שאבא הוסיף לרשימה של החווה.</div>`;
    const q = (f) => box.querySelector(`[data-f="${f}"]`);
    const msg = (t, ok) => { const m = q('msg'); m.textContent = t; m.className = 'auth-msg ' + (!t ? '' : ok ? 'ok' : 'err'); };
    let busy = false;   // Enter כפול או Enter+לחיצה שולחים בקשה אחת בלבד
    const go = async () => {
      if (busy) return;
      Audio.resume(); Audio.click();
      const email = q('email').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg('צריך מייל של אמא או אבא 😊'); return; }
      busy = true; q('go').disabled = true; msg('בודקות... 🐴', true);
      try {
        const info = await this.handlers.onAuth.login(email);
        msg('');
        this.showPlayerPicker(info);
      } catch (e) {
        busy = false; q('go').disabled = false;
        msg(this._authErr(e));
        if (/not_allowed/.test((e && e.message) || '')) Audio.speak('המייל הזה עוד לא ברשימה של החווה. אפשר לבקש מאבא להוסיף אותו');
      }
    };
    q('go').onclick = go;
    q('email').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  },

  // ---------- מי משחקת עכשיו? (אחרי מייל של הורה) ----------
  // info = { email, players:[{id,name}], canAdopt, current }
  showPlayerPicker(info) {
    const gate = document.getElementById('authScreen'); if (gate) gate.classList.add('hidden');
    const old = document.getElementById('pickScreen'); if (old) old.remove();
    const s = el('div', 'screen title-screen'); s.id = 'pickScreen';
    const esc = (t) => String(t || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    const faces = ['👧', '👩‍🌾', '🧒', '👱‍♀️'];
    const list = info.players || [];
    const rows = list.map((p, i) => `
      <button class="friend-row pick-row${p.id === info.current ? ' on' : ''}" data-pid="${esc(p.id)}">
        <span class="friend-face">${faces[i % 4]}</span>
        <span class="friend-name">${esc(p.name) || 'השחקנית הראשונה'}</span>
        <span class="friend-go">▶</span>
      </button>`).join('');
    s.innerHTML = `
      <div class="title-card auth-card">
        <div class="title-emoji">🐴</div>
        <h1 class="game-title">מי משחקת עכשיו?</h1>
        <div class="auth-note" dir="ltr">${esc(info.email)}</div>
        ${rows}
        <button class="btn-ghost" data-f="new">➕ שחקנית חדשה</button>
        <div class="hidden" data-f="newBox">
          <input class="auth-in" data-f="name" type="text" placeholder="איך קוראים לך?" maxlength="20" autocomplete="off">
          <div class="${info.canAdopt ? '' : 'hidden'}" data-f="adoptBox">
            <div class="auth-title">החווה ששיחקת בה עכשיו, לקחת אותה איתך?</div>
            <button class="btn-big btn-play" data-f="yes">🐴 כן, זו החווה שלי</button>
            <button class="btn-ghost" data-f="no">🌱 לא, חווה חדשה</button>
          </div>
          <button class="btn-big btn-play ${info.canAdopt ? 'hidden' : ''}" data-f="create">יוצאות לדרך! ✨</button>
        </div>
        <div class="auth-msg" data-f="msg"></div>
        <button class="btn-ghost gate-parents" data-f="out">🚪 יציאה מהמייל הזה</button>
      </div>`;
    this.root.appendChild(s);
    const q = (f) => s.querySelector(`[data-f="${f}"]`);
    const msg = (t, ok) => { const m = q('msg'); m.textContent = t; m.className = 'auth-msg ' + (!t ? '' : ok ? 'ok' : 'err'); };
    const lockAll = () => s.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const finish = async (choice) => {
      lockAll(); msg('טוענים את החווה שלך... 🐴', true);
      try { await this.handlers.onAuth.finish(choice); } catch (e) {}
      setTimeout(() => location.replace(location.pathname), 400);
    };
    s.querySelectorAll('.pick-row').forEach(b => b.onclick = () => { Audio.click(); finish({ pid: b.dataset.pid }); });
    const newName = () => {
      const name = q('name').value.trim();
      if (!name) { msg('איך קוראים לך? 😊'); Audio.speak('איך קוראים לך?'); q('name').focus(); return null; }
      return name;
    };
    q('new').onclick = () => { Audio.click(); q('newBox').classList.remove('hidden'); q('new').classList.add('hidden'); q('name').focus(); };
    q('create').onclick = () => { Audio.click(); const n = newName(); if (n) finish({ newName: n, adopt: false }); };
    q('yes').onclick = () => { Audio.click(); const n = newName(); if (n) finish({ newName: n, adopt: true }); };
    q('no').onclick = () => { Audio.click(); const n = newName(); if (n) finish({ newName: n, adopt: false }); };
    q('out').onclick = async () => {
      Audio.click(); lockAll();
      if (this.handlers.onAuth && this.handlers.onAuth.signOut) await this.handlers.onAuth.signOut();
      else { await Cloud.signOut(); location.replace(location.pathname); }
    };
    if (!list.length) { q('new').classList.add('hidden'); q('newBox').classList.remove('hidden'); }
    Audio.speak(list.length ? 'מי משחקת עכשיו?' : 'איך קוראים לך?');
  },

  // חשבון ותיק בלי שם — שואלים פעם אחת
  askPlayerName(onDone) {
    const ov = el('div', 'overlay light');
    ov.innerHTML = `<div class="card name-card">
      <h2>👋 איך קוראים לך?</h2>
      <p class="auth-note">כדי שהחברות יזהו את החווה שלך</p>
      <input class="auth-in" id="pnIn" type="text" placeholder="שם פרטי" maxlength="20">
      <button class="btn-big btn-play" id="pnOk">זה השם שלי! ✨</button></div>`;
    this.root.appendChild(ov);
    ov.querySelector('#pnOk').onclick = () => {
      const name = ov.querySelector('#pnIn').value.trim();
      if (!name) { Audio.wrong(); return; }
      Audio.click(); ov.remove(); onDone(name);
    };
  },

  // ---------- החוות של החברות ----------
  openFriends(farms, onVisit) {
    const old = document.getElementById('friendsOv'); if (old) old.remove();
    const ov = el('div', 'overlay light'); ov.id = 'friendsOv';
    const rows = farms.length ? farms.map((f, i) => `
      <button class="friend-row" data-i="${i}">
        <span class="friend-face">${['👧', '👩‍🌾', '🧒', '👱‍♀️'][i % 4]}</span>
        <span class="friend-name">${String(f.name).replace(/</g, '&lt;')}</span>
        <span class="friend-lvl">⭐ רמה ${f.level}</span>
        <span class="friend-go">🐴 לבקר</span>
      </button>`).join('')
      : `<div class="auth-note" style="padding:14px">עוד אין חוות של חברות 🌱<br>ספרי לחברות שלך להיכנס וליצור חווה משלהן!</div>`;
    ov.innerHTML = `<div class="card friends-card"><button class="close" id="frClose">✖</button>
      <h2>👭 החוות של החברות</h2>${rows}</div>`;
    this.root.appendChild(ov);
    ov.querySelector('#frClose').onclick = () => { Audio.click(); ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.querySelectorAll('.friend-row').forEach(b => b.onclick = () => {
      Audio.click(); ov.remove(); onVisit(farms[Number(b.dataset.i)]);
    });
    Audio.speak('אצל מי מבקרות?');
  },

  // ---------- מצב ביקור: צופים בחווה של חברה ----------
  startVisit(name, g) {
    document.getElementById('titleScreen').classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.hud.classList.add('visiting');
    this.updateHUD(g);
    this.setLocation('👀', 'החווה של ' + name);
    this.setTip('👀 מבקרות אצל ' + name + ' — מטיילות ומסתכלות');
    const bar = el('div', 'visit-banner');
    bar.innerHTML = `<span>👀 את מבקרת בחווה של <b>${String(name).replace(/</g, '&lt;')}</b></span>
      <button class="btn-home" id="visitHome">🏡 חזרה הביתה</button>`;
    this.root.appendChild(bar);
    bar.querySelector('#visitHome').onclick = () => { Audio.click(); location.href = location.pathname; };
    Audio.speak('הגענו לחווה של ' + name + '. אפשר לטייל ולהסתכל');
  },

  // ---------- HUD ----------
  _buildHUD() {
    const h = el('div', 'hud hidden');
    h.innerHTML = `
      <div class="topbar">
        <div class="stat coins"><span class="ic">🪙</span><span id="coinVal">0</span></div>
        <div class="stat level">
          <span class="ic">⭐</span><span class="lvl-txt">רמה <span id="lvlVal">1</span></span>
          <div class="xpbar"><div class="xpfill" id="xpFill"></div></div>
        </div>
        <div class="stat streak hidden" id="streakBox"><span class="ic">🔥</span><span id="streakVal">0</span></div>
        <div class="left-tools">
          <button class="gear" id="homeBtn" title="חזרה למרכז">🏠</button>
          <button class="gear" id="arrangeBtn" title="לסדר את החווה">🎨</button>
          <button class="gear" id="mapBtn" title="מפה">🗺️</button>
          <button class="gear" id="fsBtn" title="מסך מלא">⛶</button>
          <button class="gear" id="gameSettings">⚙️</button>
        </div>
      </div>
      <div class="loc-chip" id="locChip">🏡 החווה</div>
      <div class="bottombar">
        <button class="btn-fun" id="funBtn">🎯</button>
        <div class="tip" id="tip">👆 געי בסוס או בשדה</div>
        <button class="btn-buy" id="shopBtn">🛒 חנות</button>
      </div>`;
    this.root.appendChild(h);
    this.hud = h;
    this.els.coin = h.querySelector('#coinVal');
    this.els.lvl = h.querySelector('#lvlVal');
    this.els.xp = h.querySelector('#xpFill');
    this.els.streakBox = h.querySelector('#streakBox');
    this.els.streak = h.querySelector('#streakVal');
    this.els.tip = h.querySelector('#tip');
    this.els.loc = h.querySelector('#locChip');
    h.querySelector('#shopBtn').onclick = () => { Audio.click(); this.handlers.onOpenShop && this.handlers.onOpenShop(); };
    h.querySelector('#gameSettings').onclick = () => { Audio.click(); this.openSettings(); };
    h.querySelector('#fsBtn').onclick = () => { Audio.click(); this._toggleFs(); };
    h.querySelector('#funBtn').onclick = () => { Audio.click(); this.openFun(); };
    h.querySelector('#mapBtn').onclick = () => { Audio.click(); this.handlers.onMap && this.handlers.onMap(); };
    h.querySelector('#arrangeBtn').onclick = () => { Audio.click(); this.handlers.onArrange && this.handlers.onArrange(); };
    h.querySelector('#homeBtn').onclick = () => { Audio.click(); this.handlers.onHome && this.handlers.onHome(); };
  },

  // מצב עיצוב: מדגיש את הכפתור ומראה באנר עם כפתור "סיימתי"
  setArrangeMode(on) {
    const btn = document.getElementById('arrangeBtn');
    if (btn) btn.classList.toggle('active', on);
    let bar = document.getElementById('arrangeBar');
    if (on) {
      if (!bar) {
        bar = el('div', 'arrange-bar'); bar.id = 'arrangeBar';
        bar.innerHTML = `<span>🎨 גררי כל קישוט לאן שתרצי</span>
          <button class="btn-home" id="arrangeDone">✔ סיימתי</button>`;
        this.root.appendChild(bar);
        bar.querySelector('#arrangeDone').onclick = () => { Audio.click(); this.handlers.onArrange && this.handlers.onArrange(); };
      }
    } else if (bar) { bar.remove(); }
  },

  updateHUD(g) {
    this.els.coin.textContent = g.coins;
    this.els.lvl.textContent = g.level;
    this.els.xp.style.width = Math.round((g.xp / g.xpForNext()) * 100) + '%';
    if (g.streak > 1) { this.els.streakBox.classList.remove('hidden'); this.els.streak.textContent = g.streak; }
    else this.els.streakBox.classList.add('hidden');
  },

  setTip(t) { if (this.els.tip) this.els.tip.textContent = t; },
  setLocation(emoji, name) { if (this.els.loc) this.els.loc.textContent = emoji + ' ' + name; },

  _toggleFs() {
    const d = document, el2 = d.documentElement;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        (el2.requestFullscreen || el2.webkitRequestFullscreen || function () {}).call(el2);
      } else {
        (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d);
      }
    } catch (e) { /* ignore */ }
  },

  // ---------- כרטיס סוס ----------
  showHorseCard(horse, g) {
    this.closeHorseCard();
    const ov = el('div', 'overlay light');
    ov.id = 'horseCard';
    const moodFace = horse.mood() > 70 ? '😄' : horse.mood() > 40 ? '🙂' : '🥺';
    const growLocked = horse.stage === 'foal' && horse.feedCount < 3;
    const growBtn = horse.stage === 'foal'
      ? `<button class="act ${growLocked ? 'locked' : ''}" data-act="grow">
           <span class="act-ic">🌱</span><span class="act-lbl">לגדול</span>
           ${growLocked ? `<span class="lock">🔒 האכילי עוד ${3 - horse.feedCount}</span>` : ''}
         </button>` : '';
    ov.innerHTML = `
      <div class="card horse-pop">
        <button class="close" id="closeCard">✖</button>
        <div class="card-head">
          <span class="big-face">${moodFace}</span>
          <h2>${horse.name}</h2>
          <span class="stage-tag">${horse.stage === 'adult' ? 'סוס גדול' : 'סייח קטן'}</span>
        </div>
        <div class="bars">
          ${this._bar('🍎 שובע', horse.hunger)}
          ${this._bar('🧼 ניקיון', horse.clean)}
          ${this._bar('🎾 שמחה', horse.happy)}
        </div>
        <div class="acts">
          <button class="act" data-act="feed"><span class="act-ic">🥕</span><span class="act-lbl">להאכיל</span></button>
          <button class="act" data-act="brush"><span class="act-ic">🧼</span><span class="act-lbl">לנקות</span></button>
          <button class="act" data-act="play"><span class="act-ic">🎾</span><span class="act-lbl">לשחק</span></button>
          ${growBtn}
        </div>
        ${horse.birthReady ? `<button class="birth-btn" id="birthBtn">🍼 הפתעה! ל${horse.name} נולד סייח</button>` : ''}
        <button class="ride-btn ${horse.stage === 'adult' ? '' : 'locked'}" id="rideBtn">🏇 ${horse.stage === 'adult' ? 'לרכוב על ' + horse.name + ' במסלול' : 'כשיגדל אפשר לרכוב'}</button>
        <button class="dress-btn" id="dressBtn">👒 להלביש את ${horse.name}</button>
        <button class="paint-btn" id="paintBtn">🎨 לצבוע את ${horse.name} בצבע חדש</button>
      </div>`;
    this.root.appendChild(ov);
    ov.querySelector('#dressBtn').onclick = () => { Audio.click(); this.chooseAccessory(horse); };
    ov.querySelector('#paintBtn').onclick = () => { Audio.click(); this.chooseColor(horse, g); };
    ov.querySelector('#rideBtn').onclick = () => {
      if (horse.stage !== 'adult') { Audio.wrong(); Audio.speak('אני עוד קטן. האכילי אותי ואז אגדל, ונוכל לרכוב'); return; }
      Audio.click(); this.closeHorseCard(); this.handlers.onRide && this.handlers.onRide(horse);
    };
    const bb = ov.querySelector('#birthBtn');
    if (bb) bb.onclick = () => { Audio.click(); this.closeHorseCard(); this.handlers.onHorseBirth && this.handlers.onHorseBirth(horse); };
    ov.querySelector('#closeCard').onclick = () => { Audio.click(); this.closeHorseCard(); };
    ov.onclick = (e) => { if (e.target === ov) this.closeHorseCard(); };
    ov.querySelectorAll('.act').forEach(b => {
      b.onclick = () => {
        const act = b.dataset.act;
        if (b.classList.contains('locked')) { Audio.wrong(); Audio.speak('האכילי אותי עוד קצת כדי שאגדל'); return; }
        Audio.click();
        this.handlers.onAction && this.handlers.onAction(act, horse);
      };
    });
  },

  closeHorseCard() { const c = document.getElementById('horseCard'); if (c) c.remove(); },

  _bar(label, val) {
    const v = Math.round(val);
    const col = v > 60 ? '#5fbf5f' : v > 30 ? '#e8b53a' : '#e06b6b';
    return `<div class="barrow"><span class="barlbl">${label}</span>
      <div class="bartrack"><div class="barfill" style="width:${v}%;background:${col}"></div></div></div>`;
  },

  // ---------- חנות ----------
  openShop(game, counts) {
    this.closeShop();
    const ov = el('div', 'overlay shop-ov');
    ov.id = 'shopOv';
    ov.innerHTML = `
      <div class="card shop-card">
        <button class="close" id="shopClose">✖</button>
        <div class="shop-keeper">
          <img src="assets/shopkeeper.png" alt="">
          <div class="keeper-bubble" id="keeperBubble">${this._hello()} מה תרצי לקנות היום? 😊</div>
        </div>
        <div class="coin-pill">🪙 <span id="shopCoins">${game.coins}</span></div>
        <div class="shop-tabs">
          <button class="shop-tab on" data-tab="decor">🌳 קישוטים</button>
          <button class="shop-tab" data-tab="equipment">🚜 ציוד</button>
          <button class="shop-tab" data-tab="animals">🐔 חיות</button>
          <button class="shop-tab" data-tab="horses">🐴 סוסים</button>
          <button class="shop-tab" data-tab="upgrades">🏠 שדרוגים</button>
          <button class="shop-tab" data-tab="fields">🟫 שדה</button>
          <button class="shop-tab" data-tab="expand">🏞️ הרחבה</button>
          <button class="shop-tab sell-tab" data-tab="sell">💰 מכירה</button>
        </div>
        <div class="shop-grid shelf" id="shopGrid"></div>
      </div>`;
    this.root.appendChild(ov);
    ov.querySelector('#shopClose').onclick = () => { Audio.click(); this.closeShop(); };
    ov.onclick = (e) => { if (e.target === ov) this.closeShop(); };
    const grid = ov.querySelector('#shopGrid');
    const bubble = ov.querySelector('#keeperBubble');
    const lines = { decor: 'קישוטים יפים לחווה! 🌳', equipment: 'הציוד הכי טוב! 🚜', animals: 'חיות חמודות 🐔', horses: 'סוסים נהדרים! 🐴', upgrades: 'שדרוגים לאסם! 🏠', fields: 'עוד שדה לגדל בו 🟫', expand: 'רוצה חווה יותר גדולה? 🏞️', sell: 'מה תרצי למכור לי? אני קונה בחצי מחיר 💰' };
    const keeperSay = (t) => { if (bubble) bubble.textContent = t; Audio.speak(t); };
    const tabs = ov.querySelectorAll('.shop-tab');
    const render = (tab) => {
      grid.innerHTML = '';
      if (tab === 'decor' || tab === 'equipment') {
        SHOP[tab].forEach(it => grid.appendChild(this._shopCard(
          'assets/' + it.asset, it.name, it.cost, game.coins >= it.cost,
          () => { this.closeShop(); this.handlers.onShopBuy && this.handlers.onShopBuy(it, tab); })));
      } else if (tab === 'animals') {
        SHOP.animals.forEach(it => grid.appendChild(this._shopCard(
          'assets/' + it.asset, it.name + ' ' + it.produce.emoji, it.cost, game.coins >= it.cost,
          () => { this.closeShop(); this.handlers.onBuyAnimal && this.handlers.onBuyAnimal(it); })));
      } else if (tab === 'horses') {
        const cost = game.horseCost(counts.horses);
        grid.appendChild(this._shopCard('assets/horse_brown.png', 'סוס חדש', cost, game.coins >= cost,
          () => { this.closeShop(); this.handlers.onBuyHorse && this.handlers.onBuyHorse(); }));
        const rainbowCost = game.RAINBOW_COST;   // סוס מיוחד ונדיר — רעמת קשת בענן
        grid.appendChild(this._shopCard('assets/horse_rainbow.png', 'סוס קשת בענן 🌈', rainbowCost, game.coins >= rainbowCost,
          () => { this.closeShop(); this.handlers.onBuyHorse && this.handlers.onBuyHorse('rainbow'); }));
      } else if (tab === 'upgrades') {
        SHOP.upgrades.forEach(it => {
          const owned = (game.upgrades || {})[it.id];
          grid.appendChild(this._shopCard('assets/' + it.asset, it.name + (owned ? ' ✅' : ''), it.cost, !owned && game.coins >= it.cost,
            () => { this.closeShop(); this.handlers.onBuyUpgrade && this.handlers.onBuyUpgrade(it); }));
        });
      } else if (tab === 'fields') {
        if (counts.fields >= counts.maxFields) {
          grid.innerHTML = '<div class="shop-empty">🎉 כל השדות פתוחים! רוצה עוד? קני 🏞️ הרחבה</div>';
        } else {
          const cost = game.fieldCost(counts.fields);
          grid.appendChild(this._shopCard('assets/hay_bale.png', 'שדה חדש לשתילה', cost, game.coins >= cost,
            () => { this.closeShop(); this.handlers.onBuyField && this.handlers.onBuyField(); }, '🟫'));
        }
      } else if (tab === 'sell') {
        const list = (this.handlers.getSellables && this.handlers.getSellables()) || [];
        if (!list.length) grid.innerHTML = '<div class="shop-empty">עוד אין לך מה למכור 😊<br>קני קישוטים או חיות, ואז אפשר למכור אותם כאן</div>';
        list.forEach(it => grid.appendChild(this._sellCard(it)));
      } else if (tab === 'expand') {
        if (!game.canExpandFarm()) {
          grid.innerHTML = '<div class="shop-empty">🎉 החווה שלך בגודל הכי גדול!</div>';
        } else {
          const cost = game.expansionCost();
          const c = this._shopCard('assets/farm_gate.png', 'להגדיל את החווה 🏞️', cost, game.coins >= cost,
            () => { this.closeShop(); this.handlers.onBuyExpansion && this.handlers.onBuyExpansion(); }, '🏞️');
          const note = el('div', 'shop-note', 'גדר גדולה יותר · עוד 3 מקומות לשדות');
          c.appendChild(note);
          grid.appendChild(c);
        }
      }
    };
    tabs.forEach(t => t.onclick = () => {
      Audio.click();
      tabs.forEach(x => x.classList.remove('on')); t.classList.add('on');
      render(t.dataset.tab);
      if (lines[t.dataset.tab]) keeperSay(lines[t.dataset.tab]);
    });
    render('decor');
    Audio.speak(this._hello() + ' מה תרצי לקנות היום?');
  },

  _shopCard(img, name, cost, affordable, onBuy, fallbackIcon) {
    const c = el('div', 'shop-item');
    c.innerHTML = `
      <div class="shop-thumb">${fallbackIcon ? `<span class="thumb-emoji">${fallbackIcon}</span>` : ''}<img src="${img}" onerror="this.style.display='none'"></div>
      <div class="shop-name">${name}</div>
      <button class="buy-btn ${affordable ? '' : 'cant'}">🪙 ${cost}</button>`;
    c.querySelector('.buy-btn').onclick = () => {
      if (!affordable) { Audio.wrong(); Audio.speak('צריך עוד מטבעות'); return; }
      Audio.click(); onBuy();
    };
    return c;
  },

  // כרטיס מכירה: נגיעה ראשונה שואלת "בטוחה?", נגיעה שנייה מוכרת — שלא תמכור בטעות
  _sellCard(it) {
    const c = el('div', 'shop-item sell-item');
    c.innerHTML = `
      <div class="shop-thumb">${it.icon ? `<span class="thumb-emoji">${it.icon}</span>` : ''}<img src="${it.img}" onerror="this.style.display='none'"></div>
      <div class="shop-name">${it.name}${it.count > 1 ? ' <span class="sell-n">×' + it.count + '</span>' : ''}</div>
      <button class="buy-btn sell-btn">💰 +${it.price}</button>`;
    const b = c.querySelector('.sell-btn');
    b.onclick = () => {
      if (!b.classList.contains('sure')) {
        Audio.click(); b.classList.add('sure'); b.textContent = '✔ בטוחה? געי שוב';
        Audio.speak('למכור ' + it.say + '? געי שוב כדי למכור');
        setTimeout(() => { if (b.isConnected) { b.classList.remove('sure'); b.textContent = '💰 +' + it.price; } }, 4000);
        return;
      }
      Audio.click(); this.closeShop(); this.handlers.onSell && this.handlers.onSell(it);
    };
    return c;
  },

  openShopTab(tab) {
    const t = document.querySelector('#shopOv .shop-tab[data-tab="' + tab + '"]');
    if (t) t.click();
  },

  closeShop() { const s = document.getElementById('shopOv'); if (s) s.remove(); },

  // בורר גידול בלחיצה על חלקה ריקה
  chooseCrop(game, onPick) {
    this.closeShop();
    const ov = el('div', 'overlay light crop-ov');
    ov.id = 'cropOv';
    let cards = '';
    Object.values(CROPS).forEach(cr => {
      const ok = game.coins >= cr.seedCost;
      cards += `<button class="crop-opt ${ok ? '' : 'cant'}" data-key="${cr.key}">
          <img src="assets/${cr.asset}" onerror="this.style.display='none'">
          <span class="crop-name">${cr.name}</span>
          <span class="crop-cost">🪙 ${cr.seedCost}</span>
          ${cr.overnight ? '<span class="crop-night">🌙 פורח מחר בבוקר</span>' : ''}
        </button>`;
    });
    ov.innerHTML = `
      <div class="card crop-card">
        <button class="close" id="cropClose">✖</button>
        <h2>🌱 מה נשתול?</h2>
        <div class="crop-grid">${cards}</div>
      </div>`;
    this.root.appendChild(ov);
    ov.querySelector('#cropClose').onclick = () => { Audio.click(); ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.querySelectorAll('.crop-opt').forEach(b => {
      b.onclick = () => {
        const cr = CROPS[b.dataset.key];
        if (game.coins < cr.seedCost) { Audio.wrong(); Audio.speak('צריך עוד מטבעות'); return; }
        Audio.click(); ov.remove(); onPick(b.dataset.key);
      };
    });
    Audio.speak('מה נשתול?');
  },

  // בורר אביזרים לסוס (הלבשה)
  chooseAccessory(horse) {
    const accs = ['👑', '🎀', '🤠', '🎩', '🌸', '🕶️', '❄️', '🌺', '⭐'];
    const ov = el('div', 'overlay light'); ov.id = 'accOv';
    let cards = accs.map(a => `<button class="acc-opt ${horse.accessory === a ? 'on' : ''}" data-a="${a}">${a}</button>`).join('');
    cards += `<button class="acc-opt none" data-a="">🚫</button>`;
    ov.innerHTML = `<div class="card acc-card"><button class="close" id="accClose">✖</button>
      <h2>👒 מה ${horse.name} ילבש?</h2><div class="acc-grid">${cards}</div></div>`;
    this.root.appendChild(ov);
    ov.querySelector('#accClose').onclick = () => { Audio.click(); ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.querySelectorAll('.acc-opt').forEach(b => b.onclick = () => {
      Audio.click(); ov.remove(); this.closeHorseCard();
      this.handlers.onDress && this.handlers.onDress(horse, b.dataset.a || null);
    });
    Audio.speak('מה נלביש?');
  },

  // בורר צבע לסוס (בתשלום מטבעות). המחירים והשמות ב-PAINTS
  chooseColor(horse, g) {
    const coins = g ? g.coins : 0;
    const kind = horse.stage === 'adult' ? 'horse' : 'foal';
    const opts = PAINTS.filter(p => p.id !== horse.color).map(p => {
      const img = `assets/${kind}_${kind === 'foal' && p.id === 'rainbow' ? 'unicorn' : p.id}.png`;
      return `<button class="acc-opt paint-opt ${coins < p.cost ? 'poor' : ''}" data-c="${p.id}">
        <img src="${img}" alt=""><span>${p.name}</span><span class="cost">${p.cost} 🪙</span></button>`;
    }).join('');
    const ov = el('div', 'overlay light'); ov.id = 'paintOv';
    ov.innerHTML = `<div class="card acc-card"><button class="close" id="paintClose">✖</button>
      <h2>🎨 באיזה צבע נצבע את ${horse.name}?</h2><div class="acc-grid paint-grid">${opts}</div></div>`;
    this.root.appendChild(ov);
    ov.querySelector('#paintClose').onclick = () => { Audio.click(); ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.querySelectorAll('.paint-opt').forEach(b => b.onclick = () => {
      const p = PAINTS.find(x => x.id === b.dataset.c);
      Audio.click(); ov.remove(); this.closeHorseCard();
      this.handlers.onPaint && this.handlers.onPaint(horse, p);
    });
    Audio.speak('באיזה צבע נצבע?');
  },

  // ---------- תפריט כיף: משימות / גלגל / מירוץ ----------
  openFun() {
    const g = this.handlers.getGame && this.handlers.getGame();
    if (g && g.visiting) { this.toast('👀 אצל ' + g.visiting + ' רק מסתכלים ומטיילים', true); return; }
    const ov = el('div', 'overlay light'); ov.id = 'funOv';
    ov.innerHTML = `<div class="card fun-card"><button class="close" id="funClose">✖</button>
      <h2>🎯 כיף ופרסים</h2>
      <button class="fun-opt" id="optQuests">📋 משימות היום</button>
      <button class="fun-opt" id="optSpin">🎡 גלגל המזל</button>
      <button class="fun-opt" id="optStory">📜 הסיפור של החווה</button>
      <button class="fun-opt" id="optRace">🏇 מסלול הרכיבה</button>
      <button class="fun-more" id="optMore">עוד משחקים ⬇</button>
      <div class="fun-rest hidden" id="funRest">
      <button class="fun-opt" id="optDeliver">🚚 משלוח לשוק</button>
      <button class="fun-opt" id="optContest">🏆 תחרות יופי</button>
      <button class="fun-opt" id="optPhoto">📸 צילום החווה</button>
      <button class="fun-opt" id="optJournal">📖 יומן הרפתקאות</button></div></div>`;
    this.root.appendChild(ov);
    ov.querySelector('#funClose').onclick = () => { Audio.click(); ov.remove(); };
    ov.querySelector('#optMore').onclick = (e) => { Audio.click(); e.currentTarget.remove(); ov.querySelector('#funRest').classList.remove('hidden'); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    const close = () => ov.remove();
    ov.querySelector('#optQuests').onclick = () => { Audio.click(); close(); this.openQuests(g); };
    ov.querySelector('#optSpin').onclick = () => { Audio.click(); close(); this.openSpin(); };
    ov.querySelector('#optRace').onclick = () => { Audio.click(); close(); this.handlers.onRace && this.handlers.onRace(); };
    ov.querySelector('#optStory').onclick = () => { Audio.click(); close(); this.handlers.onStory && this.handlers.onStory(); };
    ov.querySelector('#optDeliver').onclick = () => { Audio.click(); close(); this.handlers.onDelivery && this.handlers.onDelivery(); };
    ov.querySelector('#optContest').onclick = () => { Audio.click(); close(); this.handlers.onContest && this.handlers.onContest(); };
    ov.querySelector('#optPhoto').onclick = () => { Audio.click(); close(); this.handlers.onPhoto && this.handlers.onPhoto(); };
    ov.querySelector('#optJournal').onclick = () => { Audio.click(); close(); this.handlers.onJournal && this.handlers.onJournal(); };
  },

  // יומן הרפתקאות — גילוי אזורים ופעילויות
  openJournal(areas, game) {
    const ov = el('div', 'overlay light'); ov.id = 'journalOv';
    const total = areas.length;
    const visited = areas.filter(a => game.areaVisited(a.id)).length;
    const rows = areas.map(a => {
      const v = game.areaVisited(a.id);
      const n = game.areaCount(a.id);
      const next = 3 - (n % 3);
      return `<div class="jrow ${v ? '' : 'unseen'}">
        <span class="jemoji">${v ? a.emoji : '❓'}</span>
        <span class="jname">${v ? a.name : 'אזור נסתר'}</span>
        <span class="jcount">${v ? '✔ ' + n + ' פעילויות' : '🔒 רמה ' + a.unlock}</span>
        ${v ? `<span class="jnext">עוד ${next} לכוכב ⭐</span>` : ''}</div>`;
    }).join('');
    ov.innerHTML = `<div class="card journal-card"><button class="close" id="jClose">✖</button>
      <h2>📖 יומן ההרפתקאות</h2>
      <div class="jprogress">גילית ${visited} מתוך ${total} אזורים · ⭐ ${game.stars}</div>
      ${rows}</div>`;
    this.root.appendChild(ov);
    ov.querySelector('#jClose').onclick = () => { Audio.click(); ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    Audio.speak('יומן ההרפתקאות');
  },

  // דוח הורי — תמונת התקדמות של אגם (מבוסס על נתוני-אמת שנאספים לקושי המותאם)
  // שם השחקנית (חשבון) או '' (אורחת). כל פנייה אישית עוברת דרך כאן
  _pn() { const g = this.handlers.getGame && this.handlers.getGame(); return (g && g.playerName && g.playerName()) || ''; },
  _hello() { const n = this._pn(); return n ? 'שלום ' + n + '!' : 'שלום!'; },
  openParentReport(g) {
    const META = {
      add:      { l: 'חיבור',            e: '➕' },
      sub:      { l: 'חיסור',            e: '➖' },
      count:    { l: 'ספירה',            e: '🔢' },
      compare:  { l: 'גדול / קטן',       e: '⚖️' },
      missing:  { l: 'מספר חסר',         e: '🧩' },
      neighbor: { l: 'לפני ואחרי',       e: '↔️' },
      word:     { l: 'בעיות מילוליות',   e: '📖' },
    };
    const ts = g.typeStats || {};
    let totC = 0, totN = 0;
    const rows = Object.keys(META)
      .filter(t => ts[t] && (ts[t].c + ts[t].w) > 0)
      .map(t => {
        const s = ts[t], n = s.c + s.w, pct = Math.round(s.c / n * 100);
        totC += s.c; totN += n;
        const cls = pct >= 85 ? 'good' : (pct >= 60 ? 'ok' : 'low');
        return `<div class="prow">
          <span class="pemoji">${META[t].e}</span>
          <span class="pname">${META[t].l}</span>
          <div class="qbar prog"><div class="qfill ${cls}" style="width:${pct}%"></div></div>
          <span class="ppct">${pct}%</span>
          <span class="pn">${s.c}/${n}</span></div>`;
      }).join('');

    const overall = totN ? Math.round(totC / totN * 100) : 0;
    const weak = g.weakType && g.weakType();
    const visited = Object.values((g.worldStats && g.worldStats.visited) || {}).filter(Boolean).length;
    const acts = Object.values((g.worldStats && g.worldStats.activities) || {}).reduce((a, b) => a + b, 0);

    let advice;
    if (!totN) advice = '';
    else if (weak && META[weak]) advice = `💡 כדאי לתרגל יחד: ${META[weak].e} ${META[weak].l}`;
    else advice = this._pn() ? '🌟 ' + this._pn() + ' שולטת יפה בכל סוגי התרגילים! כל הכבוד' : '🌟 שליטה יפה בכל סוגי התרגילים! כל הכבוד';

    const body = totN
      ? `<div class="rgrid">
           <div class="rchip"><b>${g.level}</b><span>רמה</span></div>
           <div class="rchip"><b>${overall}%</b><span>דיוק כללי</span></div>
           <div class="rchip"><b>${g.solved || 0}</b><span>תרגילים</span></div>
           <div class="rchip"><b>${g.bestStreak || 0}</b><span>רצף שיא</span></div>
           <div class="rchip"><b>${visited}</b><span>אזורים</span></div>
           <div class="rchip"><b>${acts}</b><span>פעילויות</span></div>
         </div>
         <div class="rtitle">דיוק לפי סוג תרגיל</div>
         ${rows}
         ${advice ? `<div class="radvice">${advice}</div>` : ''}`
      : `<div class="shop-empty">עדיין אין מספיק נתונים 😊<br>שחקו קצת וחזרו לראות את ההתקדמות${this._pn() ? ' של ' + this._pn() : ''}.</div>`;

    const ov = el('div', 'overlay light'); ov.id = 'reportOv';
    ov.innerHTML = `<div class="card journal-card report-card"><button class="close" id="rClose">✖</button>
      <h2>📊 דוח להורה</h2>
      <div class="jprogress">תמונת ההתקדמות${this._pn() ? ' של ' + this._pn() : ''}</div>
      ${body}</div>`;
    this.root.appendChild(ov);
    ov.querySelector('#rClose').onclick = () => { Audio.click(); ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  },

  openQuests(g) {
    const ov = el('div', 'overlay light'); ov.id = 'questOv';
    const rows = (g.quests || []).map(q => {
      const pct = Math.min(100, Math.round(q.progress / q.target * 100));
      return `<div class="quest ${q.done ? 'done' : ''}">
        <div class="quest-top"><span>${q.emoji} ${q.text}</span><span class="qnum">${q.done ? '✅' : q.progress + '/' + q.target}</span></div>
        <div class="qbar"><div class="qfill" style="width:${pct}%"></div></div>
        <div class="quest-reward">🎁 ${q.reward} 🪙</div></div>`;
    }).join('') || '<div class="shop-empty">אין משימות היום</div>';
    ov.innerHTML = `<div class="card quests-card"><button class="close" id="qClose">✖</button>
      <h2>📋 משימות היום</h2>${rows}</div>`;
    this.root.appendChild(ov);
    ov.querySelector('#qClose').onclick = () => { Audio.click(); ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    Audio.speak('המשימות של היום');
  },

  openSpin() {
    const ov = el('div', 'overlay'); ov.id = 'spinOv';
    ov.innerHTML = `<div class="card spin-card"><button class="close" id="spClose">✖</button>
      <h2>🎡 גלגל המזל</h2>
      <div class="wheel-wrap"><div class="wheel" id="wheel">🎁</div></div>
      <div class="spin-msg" id="spinMsg">סובבי פעם ביום וקבלי מטבעות!</div>
      <button class="btn-big" id="spinBtn">סובבי! 🎡</button></div>`;
    this.root.appendChild(ov);
    ov.querySelector('#spClose').onclick = () => { Audio.click(); ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    const btn = ov.querySelector('#spinBtn'), wheel = ov.querySelector('#wheel'), msg = ov.querySelector('#spinMsg');
    btn.onclick = () => {
      const r = this.handlers.onSpin && this.handlers.onSpin();
      btn.disabled = true; btn.classList.add('cant');
      if (!r || !r.ok) { msg.textContent = 'כבר סובבת היום! נסי שוב מחר 😊'; Audio.wrong(); return; }
      Audio.coin(); wheel.style.animation = 'spinwheel 1.3s ease-out';
      setTimeout(() => { wheel.textContent = '🪙'; msg.innerHTML = `זכית ב-<b>${r.prize}</b> מטבעות! 🎉`; Audio.fanfare(); Audio.speak('זכית ב' + r.prize + ' מטבעות'); }, 1300);
    };
  },

  // ---------- כרטיס קטן עם שתי בחירות (משמש את הבוקר, הדילוג והשינה) ----------
  // opts = { id, cls, emoji, title, text, yes, no, onYes, onNo, say }
  _choiceCard(opts) {
    const old = document.getElementById(opts.id); if (old) old.remove();
    const ov = el('div', 'overlay ' + (opts.cls || 'light')); ov.id = opts.id;
    ov.innerHTML = `<div class="card choice-card">
        <div class="cc-emoji">${opts.emoji}</div>
        <h2>${opts.title}</h2>
        ${opts.text ? `<p class="cc-text">${opts.text}</p>` : ''}
        <button class="btn-big btn-play" data-f="yes">${opts.yes}</button>
        ${opts.no ? `<button class="btn-ghost" data-f="no">${opts.no}</button>` : ''}
      </div>`;
    this.root.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('[data-f="yes"]').onclick = () => { Audio.click(); close(); opts.onYes && opts.onYes(); };
    const no = ov.querySelector('[data-f="no"]');
    if (no) no.onclick = () => { Audio.click(); close(); opts.onNo && opts.onNo(); };
    if (opts.say) Audio.speak(opts.say);
    return ov;
  },

  // בוקר טוב, חווה: פרס פתיחה יומי שמגיע אחרי תרגיל אחד. בלי רצף שנשבר
  morningCard(info, onGo, onLater) {
    const extra = info.ready ? `${info.ready === 1 ? 'פרח לילה אחד פרח' : info.ready + ' פרחי לילה פרחו'} בשדה! 🌙` : '';
    this._choiceCard({
      id: 'morningOv', emoji: '🌅', title: 'בוקר טוב, חווה!',
      text: `רותי השאירה לך מתנת בוקר. תרגיל אחד והיא שלך 🎁${extra ? '<br>' + extra : ''}`,
      yes: 'בואי נפתח! 🎁', no: 'אחר כך', onYes: onGo, onNo: onLater,
      say: 'בוקר טוב! רותי השאירה לך מתנת בוקר. תרגיל אחד והיא שלך' + (info.ready ? '. ופרחי הלילה פרחו!' : '')
    });
  },

  // שדה שעוד גדל: אפשר לחכות, או לפתור תרגיל אתגר והוא גדל מיד
  offerGrow(sec, cropName, onGrow) {
    this._choiceCard({
      id: 'growOv', emoji: '🌱', title: `ה${cropName} עוד גדל`,
      text: `עוד ${sec} שניות. רוצה תרגיל אתגר? פתרת, והוא גדל מיד ⚡`,
      yes: '⚡ תרגיל אתגר', no: 'אחכה', onYes: onGrow,
      say: 'ה' + cropName + ' עוד גדל. רוצה תרגיל אתגר? פתרת, והוא גדל מיד'
    });
  },

  // סוף משחק מתוכנן: החווה הולכת לישון. info = { solved, growing, night }
  bedtime(info, onSleep, onMore) {
    const parts = [];
    if (info.solved) parts.push(`פתרת היום <b>${info.solved}</b> תרגילים`);
    if (info.night) parts.push(`${info.night === 1 ? 'פרח לילה אחד יפרח' : info.night + ' פרחי לילה יפרחו'} מחר בבוקר 🌙`);
    else parts.push('מחר אפשר לשתול פרח לילה, והוא יחכה לך בבוקר 🌙');
    const ov = this._choiceCard({
      id: 'bedOv', cls: 'night', emoji: '🌙', title: 'החווה הולכת לישון',
      text: 'רותי משכיבה את הסוסים לישון. ' + parts.join('. '),
      yes: 'לילה טוב! 💤', no: onMore ? 'עוד 5 דקות' : null,
      onYes: () => { onSleep && onSleep(); this._sleepScreen(info); }, onNo: onMore,
      say: 'החווה הולכת לישון. רותי משכיבה את הסוסים. כל הכבוד על היום!' + (info.solved ? ' פתרת ' + info.solved + ' תרגילים' : '')
    });
    return ov;
  },
  _sleepScreen(info) {
    const ov = el('div', 'overlay night sleep-ov'); ov.id = 'sleepOv';
    ov.innerHTML = `<div class="sleep-card">
        <div class="cc-emoji">🐴💤</div>
        <h2>לילה טוב${this._pn() ? ', ' + this._pn() : ''}!</h2>
        <p class="cc-text">החווה ישנה. נתראה מחר בבוקר 🌅</p>
        <button class="btn-ghost sleep-parents" data-f="wake">👨‍👩‍👧 הורים: להמשיך לשחק</button>
      </div>`;
    this.root.appendChild(ov);
    Audio.speak('לילה טוב! נתראה מחר בבוקר', { queue: true });
    ov.querySelector('[data-f="wake"]').onclick = () => {
      Audio.click(); ov.remove();
      this.handlers.onWake && this.handlers.onWake();
    };
  },

  // פס מירוץ עליון
  raceBar(step, total) {
    let bar = document.getElementById('raceBar');
    if (!bar) {
      bar = el('div', 'race-bar'); bar.id = 'raceBar';
      bar.innerHTML = `<div class="race-track"><span class="race-flag">🏁</span><div class="race-horse" id="raceHorse">🐎</div></div>`;
      this.root.appendChild(bar);
    }
    bar.querySelector('#raceHorse').style.left = Math.min(88, (step / total) * 88) + '%';
  },
  raceEnd(prize) { this.raceClear(); this.toast('🏆 ניצחת במירוץ! +' + prize + ' 🪙', true); },
  raceClear() { const b = document.getElementById('raceBar'); if (b) b.remove(); },

  // מפת העולם הפתוח + שער לצפייה בחוות של חברות (נטען מהענן)
  // opts = { canVisit, loadFarms:()=>Promise, onVisit:(farm)=>void }
  openMap(areas, currentId, onTravel, opts = {}) {
    const g = this.handlers.getGame && this.handlers.getGame();
    const ov = el('div', 'overlay light'); ov.id = 'mapOv';
    const cards = areas.map(a => {
      const locked = g && g.level < a.unlock;
      const tag = a.id === currentId ? '📍 כאן' : (locked ? '🔒 רמה ' + a.unlock : '➜ סעי');
      return `<button class="map-area ${a.id === currentId ? 'here' : ''} ${locked ? 'locked' : ''}" data-id="${a.id}">
        <span class="map-emoji">${a.emoji}</span><span class="map-name">${a.name}</span><span class="map-tag">${tag}</span></button>`;
    }).join('');
    const friendsSection = opts.canVisit ? `
      <div class="map-friends-title">👭 חוות של חברות</div>
      ${g && g.visiting ? '<button class="btn-home map-home" id="mapHome">🏡 חזרה לחווה שלי</button>' : ''}
      <div class="map-farms" id="mapFarms"><div class="map-loading">טוען חוות... ⏳</div></div>` : '';
    ov.innerHTML = `<div class="card map-card"><button class="close" id="mapClose">✖</button>
      <h2>🗺️ ${this._pn() ? 'העולם של ' + this._pn() : 'העולם שלי'}</h2><div class="map-grid">${cards}</div>${friendsSection}</div>`;
    this.root.appendChild(ov);
    ov.querySelector('#mapClose').onclick = () => { Audio.click(); ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.querySelectorAll('.map-area').forEach(b => b.onclick = () => {
      const a = areas.find(x => x.id === b.dataset.id);
      if (g && g.level < a.unlock) { Audio.wrong(); Audio.speak('האזור עוד נעול'); return; }
      Audio.click(); ov.remove(); onTravel(b.dataset.id);
    });
    const homeBtn = ov.querySelector('#mapHome');
    if (homeBtn) homeBtn.onclick = () => { Audio.click(); location.href = location.pathname; };
    // חוות של חברות — נטענות אסינכרונית כדי לא לעכב את פתיחת המפה
    if (opts.canVisit && opts.loadFarms) {
      opts.loadFarms().then(farms => {
        const box = ov.querySelector('#mapFarms');
        if (!box) return;
        if (!farms || !farms.length) { box.innerHTML = '<div class="map-loading">עוד אין חוות של חברות 🌱<br>ספרי לחברות להיכנס וליצור חווה!</div>'; return; }
        box.innerHTML = farms.map((f, i) => `
          <button class="friend-row" data-i="${i}">
            <span class="friend-face">${['👧', '👩‍🌾', '🧒', '👱‍♀️'][i % 4]}</span>
            <span class="friend-name">${String(f.name).replace(/</g, '&lt;')}</span>
            <span class="friend-lvl">⭐ רמה ${f.level}</span>
            <span class="friend-go">🐴 לבקר</span>
          </button>`).join('');
        box.querySelectorAll('.friend-row').forEach(b => b.onclick = () => {
          Audio.click(); ov.remove(); opts.onVisit(farms[Number(b.dataset.i)]);
        });
      }).catch(() => { const box = ov.querySelector('#mapFarms'); if (box) box.innerHTML = '<div class="map-loading">לא הצלחנו לטעון חוות 😕</div>'; });
    }
    Audio.speak('לאן נוסעים? ואפשר גם לבקר בחוות של חברות');
  },

  // ---------- משימת העברה: החשבון הוא הפעולה ----------
  // task: {mode, target, prefilled, scaffold, who:{name,img}, item, itemName, box, verb}
  // onDone({correct, firstTry, cancelled}) — אותו חוזה כמו askMath
  askTransfer(task, actionType, onDone) {
    this._mathOpen = true;
    const WORDS = ['אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר', 'אחת עשרה', 'שתים עשרה'];
    const word = (n) => WORDS[n - 1] || String(n);
    const act = ACTIONS[actionType] || { icon: task.item, label: '' };
    const { target, prefilled, mode } = task;
    let attempts = 0, scaffold = task.scaffold, finished = false;
    const pileN = Math.min(12, Math.max(6, target - prefilled + 3));
    const ask = mode === 'missing'
      ? `ב${task.box} יש כבר ${prefilled}. ${task.who.name} רוצה ${target}. כמה עוד?`
      : `${task.verb} ${target} ${task.itemName}`;
    const say = mode === 'missing'
      ? `ב${task.box} יש כבר ${prefilled} ${task.itemName}. ${task.who.name} רוצה ${target}. תוסיפי כמה שחסר`
      : `${task.verb} ${target} ${task.itemName}. געי ב${task.itemName} אחד אחד`;
    const ov = el('div', 'overlay math-ov');
    ov.id = 'mathOv';
    ov.innerHTML = `
      <div class="card math-card transfer-card">
        <button class="close" id="mathClose">✖</button>
        <div class="math-top">
          <span class="math-act">${act.icon} ${act.label}</span>
          <button class="speaker" id="speakBtn" title="שמיעה">🔊</button>
        </div>
        <div class="tr-who">
          ${task.who.img ? `<img class="tr-img" src="${task.who.img}" alt="">` : ''}
          <div class="tr-bubble">${ask} <span class="tr-big">${task.item}</span></div>
        </div>
        <div class="tr-box" id="trBox"><span class="tr-label">${task.box}</span><div class="tr-in" id="trIn"></div></div>
        <div class="tr-pile" id="trPile"></div>
        <button class="btn-big btn-play tr-done ${scaffold ? 'hidden' : ''}" id="trDone">✔ זהו!</button>
        <div class="hint-text hidden" id="trMsg"></div>
      </div>`;
    this.root.appendChild(ov);
    const box = ov.querySelector('#trIn'), pile = ov.querySelector('#trPile'), msg = ov.querySelector('#trMsg');
    const inBox = () => box.querySelectorAll('.tr-item').length;
    const added = () => box.querySelectorAll('.tr-item.mine').length;

    const renderSlots = () => {
      box.querySelectorAll('.tr-slot').forEach(s => s.remove());
      if (!scaffold) return;
      for (let i = inBox(); i < target; i++) box.appendChild(el('span', 'tr-slot'));
    };
    const item = (mine) => { const b = el('button', 'tr-item' + (mine ? ' mine' : ' pre'), task.item); return b; };
    for (let i = 0; i < prefilled; i++) box.appendChild(item(false));
    for (let i = 0; i < pileN; i++) {
      const b = item(true);
      b.onclick = () => move(b);
      pile.appendChild(b);
    }
    renderSlots();

    const finish = (ok) => {
      finished = true; this._mathOpen = false;
      Audio.success();
      setTimeout(() => { ov.remove(); onDone && onDone({ correct: true, firstTry: attempts === 0 }); }, 900);
    };

    function move(b) {
      if (finished) return;
      if (b.parentNode === pile) {
        if (scaffold && inBox() >= target) { Audio.wrong(); Audio.speak('השוקת מלאה'); return; }
        const slot = box.querySelector('.tr-slot');
        slot ? box.insertBefore(b, slot) : box.appendChild(b);
        if (slot) slot.remove();
        Audio.pop();
        // עם פיגום סופרים בקול (לומדת לספור); בלי פיגום היא סופרת בעצמה
        if (scaffold) Audio.speak(word(inBox()));
        if (scaffold && inBox() === target) finish(true);
      } else {
        pile.appendChild(b);
        Audio.pop();
        renderSlots();
      }
      msg.classList.add('hidden');
      box.querySelectorAll('.tr-item').forEach(x => delete x.dataset.n);
    }

    ov.querySelector('#trDone').onclick = () => {
      if (finished) return;
      Audio.click();
      const n = inBox();
      if (n === target) { finish(true); return; }
      attempts++;
      Audio.wrong();
      // עצירה קצרה: "זהו!" ננעל לרגע, כדי שלחיצות מהירות בלי לספור לא יעבדו
      const db = ov.querySelector('#trDone'); db.disabled = true; db.classList.add('wait');
      setTimeout(() => { db.disabled = false; db.classList.remove('wait'); }, 2200);
      // מראים את הספירה על הפריטים עצמם — לומדים מהטעות, לא מקבלים ציון
      box.querySelectorAll('.tr-item').forEach((x, i) => { x.dataset.n = i + 1; });
      const diff = Math.abs(n - target);
      const fix = n > target ? (diff === 1 ? 'צריך להחזיר אחד' : `צריך להחזיר ${diff}`)
                             : (diff === 1 ? 'חסר עוד אחד' : `חסרים עוד ${diff}`);
      msg.innerHTML = `יש כאן <b>${n}</b>. ${task.who.name} רוצה <b>${target}</b>. ${fix}`;
      msg.classList.remove('hidden');
      Audio.speak(`יש כאן ${n}. ${task.who.name} רוצה ${target}. ${fix}`);
      if (attempts >= 2 && !scaffold) {
        // אחרי שתי טעויות: משבצות מסומנות, והמשימה הופכת להתאמה אחד-לאחד
        scaffold = true;
        while (inBox() > target) { const x = box.querySelector('.tr-item.mine:last-of-type') || [...box.querySelectorAll('.tr-item.mine')].pop(); if (!x) break; pile.appendChild(x); }
        renderSlots();
        ov.querySelector('#trDone').classList.add('hidden');
        if (inBox() === target) finish(true);
      }
    };
    ov.querySelector('#mathClose').onclick = () => { if (finished) return; Audio.click(); Audio.stopSpeak(); this._mathOpen = false; ov.remove(); onDone && onDone({ correct: false, cancelled: true }); };
    ov.querySelector('#speakBtn').onclick = () => Audio.speak(say);
    Audio.speak(say);
  },

  // הדגשה חיה של כפתור (הדרכה): מהבהב עד שנוגעים בו
  pulse(selector) {
    const b = document.querySelector(selector);
    if (b) b.classList.add('tut-pulse');
  },

  // ---------- חלון תרגיל חשבון ----------
  askMath(problem, actionType, onDone) {
    this._mathOpen = true;
    const ov = el('div', 'overlay math-ov');
    ov.id = 'mathOv';
    const act = ACTIONS[actionType] || { icon: '🔢', label: 'תרגיל', sub: '' };
    ov.innerHTML = `
      <div class="card math-card">
        <button class="close" id="mathClose">✖</button>
        <div class="math-top">
          <span class="math-act">${act.icon} ${act.label}</span>
          <button class="speaker" id="speakBtn" title="שמיעה">🔊</button>
        </div>
        <div class="question" id="qText">${problem.question}</div>
        <div class="visual" id="visual"></div>
        <div class="choices" id="choices"></div>
        <button class="hint-btn" id="hintBtn">💡 רמז</button>
        <div class="hint-text hidden" id="hintText">${problem.hint || ''}</div>
      </div>`;
    this.root.appendChild(ov);

    // תרגילי משוואה (3 + 2 = ?) מוצגים משמאל-לימין; משפטים בעברית נשארים RTL
    if (problem.ltr) ov.querySelector('#qText').style.direction = 'ltr';

    // עזר חזותי
    const vis = ov.querySelector('#visual');
    vis.style.direction = 'ltr';
    vis.innerHTML = this._renderVisual(problem.visual);
    this._wireCounting(vis);

    // אפשרויות — דרך מנוע הבחירה שמונע ניחושים (הקשבה → תשובה, טעות → עצירה ופיגום)
    const ctl = this.wireChoices(ov.querySelector('#choices'), problem, {
      hintEl: ov.querySelector('#hintText'), visEl: vis,
      onCorrect: (res) => {
        this._mathOpen = false;
        setTimeout(() => { ov.remove(); onDone && onDone(Object.assign({ correct: true }, res)); }, 750);
      }
    });
    this._mathCtl = ctl;

    // ✖ אחרי תשובה נכונה לא מבטל: הפעולה כבר בדרך, והחלון ייסגר לבד (בלי קריאה כפולה ל-onDone)
    ov.querySelector('#mathClose').onclick = () => { if (ctl.answered()) return; Audio.click(); Audio.stopSpeak(); ctl.stop(); this._mathOpen = false; ov.remove(); onDone && onDone({ correct: false, cancelled: true }); };
    ov.querySelector('#speakBtn').onclick = () => Audio.speak(problem.speech || problem.question);
    ov.querySelector('#hintBtn').onclick = () => this._showHint(ov, problem);

    // הקראה אוטומטית
    Audio.speak(problem.speech || problem.question);
  },

  // ---------- מנוע בחירה נגד ניחושים (משותף לחלון התרגיל ולמסלול הרכיבה) ----------
  // 1. הקשבה: הכפתורים נפתחים רק אחרי רגע (👂), כך שהקשה מהירה לפני שהשאלה נשמעה לא עובדת.
  // 2. טעות: התשובה השגויה נכבית, וכל הכפתורים ננעלים לרגע עם רמז ("בואי נחשוב רגע").
  // 3. "מנסה הכל": טעות מהירה מיד כשהכפתורים נפתחו, נגיעות חוזרות בזמן הנעילה, או טעות שנייה →
  //    "בואי נספור יחד": הפריטים נספרים אחד אחד בקול, ורק התשובה הנכונה נשארת פתוחה.
  // onCorrect({ firstTry, scaffolded, guessy }) — firstTry רק כשהתשובה הראשונה נכונה ולא נוחשה.
  wireChoices(ch, problem, opts = {}) {
    const LISTEN_MS = this._guessy > 0 ? 2600 : 1300;   // מי שניחשה בתרגיל הקודם — מקשיבה קצת יותר
    const FAST_MS = 900, PAUSE_MS = 2200;
    const WORDS = ['אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר',
      'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה', 'עשרים'];
    const hintEl = opts.hintEl, visEl = opts.visEl;
    let attempts = 0, locked = true, unlockAt = 0, spam = 0, scaffolded = false, guessy = false, done = false, pauseT = null;
    const timers = [];
    const later = (fn, ms) => { const t = setTimeout(() => { if (!done) fn(); }, ms); timers.push(t); return t; };
    const buttons = [];
    const setLock = (on) => {
      locked = on;
      ch.classList.toggle('wait', on);
      if (!on) unlockAt = performance.now();
    };
    const showHint = (html) => { if (hintEl) { hintEl.innerHTML = html; hintEl.classList.remove('hidden'); } };

    // ספירה משותפת: מספרים את הפריטים אחד אחד בקול. בלי ציור בתרגיל — מציירים פיגום מהתרגיל עצמו
    const countWithMe = (then) => {
      let v = problem.visual || problem.scaffold || null;
      if (visEl && !problem.visual && v) { visEl.innerHTML = this._renderVisual(v); }
      const items = visEl ? [...visEl.querySelectorAll('.em:not(.gone)')] : [];
      items.forEach(e => { delete e.dataset.n; e.classList.remove('counted'); });
      if (!items.length) { then(); return; }
      Audio.speak('בואי נספור יחד');
      items.forEach((e, i) => later(() => {
        e.dataset.n = i + 1; e.classList.add('counted', 'pop');
        Audio.speak(WORDS[i] || String(i + 1));
      }, 1400 + i * 650));
      later(then, 1400 + items.length * 650 + 400);
    };
    // הסוף של הפיגום: התשובה זוהרת, ורק היא פתוחה
    const reveal = () => {
      buttons.forEach(b => {
        const right = Number(b.textContent) === problem.answer;
        b.classList.toggle('glow', right);
        if (!right) b.classList.add('out');
      });
      showHint(`💡 התשובה היא <b>${problem.answer}</b>. געי בה`);
      Audio.speak('התשובה היא ' + problem.answer + '. געי בה');
      setLock(false);
    };
    const scaffold = (why) => {
      if (scaffolded) return;
      scaffolded = true; setLock(true);
      clearTimeout(pauseT);   // העצירה של הטעות הראשונה לא פותחת את התשובות באמצע הספירה
      if (why === 'guess') {
        guessy = true;
        this._guessy = Math.min(3, (this._guessy || 0) + 1);
        showHint('👂 לאט לאט. בואי נעשה את זה יחד');
      } else showHint('🤝 בואי נעשה את זה יחד');
      later(() => countWithMe(reveal), 900);
    };

    problem.choices.forEach(c => {
      const b = el('button', 'choice', String(c));
      buttons.push(b);
      b.onclick = () => {
        if (done || b.classList.contains('out')) return;
        if (locked) {   // נגיעות בזמן הקשבה/עצירה לא נחשבות, אבל הרבה כאלה = ניחוש
          spam++;
          if (spam >= 3 && attempts > 0) scaffold('guess');
          return;
        }
        Audio.speak(String(c));   // מקריא את המספר שנבחר — עוזר למי שעוד לא קוראת ספרות
        const quick = performance.now() - unlockAt < FAST_MS;
        if (c === problem.answer) {
          done = true; timers.forEach(clearTimeout);
          b.classList.add('correct', 'done');
          Audio.success();
          const firstTry = attempts === 0 && !scaffolded;
          if (firstTry && !quick && this._guessy > 0) this._guessy--;   // תשובה רגועה ונכונה מחזירה אמון
          opts.onCorrect && opts.onCorrect({ firstTry, scaffolded, guessy });
          return;
        }
        attempts++;
        b.classList.add('wrong', 'out');
        Audio.wrong();
        setTimeout(() => b.classList.remove('wrong'), 500);
        if (scaffolded) return;
        if (quick || attempts >= 2) { scaffold(quick ? 'guess' : 'help'); return; }
        // טעות ראשונה רגועה: עוצרים לרגע, רמז, ואז שוב מנסים
        setLock(true); spam = 0;
        showHint('🤔 בואי נחשוב רגע. ' + (problem.hint || ''));
        Audio.speak('כמעט! בואי נחשוב רגע. ' + (problem.hint || ''));
        pauseT = later(() => setLock(false), PAUSE_MS);
      };
      ch.appendChild(b);
    });
    setLock(true);
    later(() => setLock(false), LISTEN_MS);
    return { stop() { done = true; timers.forEach(clearTimeout); }, answered: () => done };
  },

  _showHint(ov, problem, speak = true) {
    const ht = ov.querySelector('#hintText');
    if (ht) { ht.classList.remove('hidden'); }
    if (speak) Audio.speak(problem.hint || '');
  },

  // "געי ותספרי": כל פריט שלא נמחק מקבל מספר ומוקרא בקול, כך שהרמז באמת עובד.
  // פריט שכבר נספר רק חוזר על המספר שלו (לא מדלגים ולא סופרים פעמיים).
  _wireCounting(vis) {
    const WORDS = ['אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר',
      'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה', 'עשרים'];
    let n = 0;
    vis.querySelectorAll('.em:not(.gone)').forEach(e => {
      e.classList.add('tap');
      e.onclick = () => {
        if (!e.dataset.n) { n++; e.dataset.n = n; e.classList.add('counted'); }
        const k = Number(e.dataset.n);
        Audio.speak(WORDS[k - 1] || String(k));
      };
    });
  },

  _renderVisual(v) {
    if (!v) return '';
    if (v.kind === 'count') {
      return `<div class="emoji-row">${Array(v.count).fill(`<span class="em">${v.emoji}</span>`).join('')}</div>`;
    }
    if (v.kind === 'group') {
      const a = Array(v.a).fill(`<span class="em">${v.emoji}</span>`).join('');
      if (v.op === '+') {
        const b = Array(v.b).fill(`<span class="em">${v.emoji}</span>`).join('');
        return `<div class="emoji-row"><span class="grp">${a}</span><span class="opsign">➕</span><span class="grp">${b}</span></div>`;
      } else {
        // חיסור: מציגים a, ומתוכם b מסומנים כנעלמים
        let html = '';
        for (let i = 0; i < v.a; i++) {
          const gone = i >= (v.a - v.b);
          html += `<span class="em ${gone ? 'gone' : ''}">${v.emoji}</span>`;
        }
        return `<div class="emoji-row">${html}</div>`;
      }
    }
    return '';
  },

  // ---------- הודעות קופצות ----------
  toast(text, big) {
    const t = el('div', 'toast' + (big ? ' big' : ''), text);
    this.root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, big ? 2200 : 1600);
  },

  levelUp(level) {
    const ov = el('div', 'overlay celebrate');
    ov.innerHTML = `<div class="levelup">
      <div class="lu-star">🌟</div>
      <h2>עלית רמה!</h2>
      <p>הגעת לרמה ${level}</p>
      <button class="btn-big" id="luOk">יש! ✨</button></div>`;
    this.root.appendChild(ov);
    Audio.fanfare(); Audio.speak('כל הכבוד! עלית רמה!');
    ov.querySelector('#luOk').onclick = () => { Audio.click(); ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  },

  // ---------- הגדרות ----------
  _buildSettings() {
    const ov = el('div', 'overlay hidden');
    ov.id = 'settingsOv';
    ov.innerHTML = `
      <div class="card settings-card">
        <button class="close" id="setClose">✖</button>
        <h2>⚙️ הגדרות</h2>
        <div class="set-row"><span>🔊 צלילים</span><button class="toggle" data-key="sound">פעיל</button></div>
        <div class="set-row"><span>🗣️ קול מקריא</span><button class="toggle" data-key="voice">פעיל</button></div>
        <div class="set-row"><span>🎵 מוזיקה</span><button class="toggle" data-key="music">פעיל</button></div>
        <div class="set-row"><span>🌙 יום ולילה</span><button class="toggle" data-key="daynight">פעיל</button></div>
        <button class="btn-parents" id="parentsBtn">👨‍👩‍👧 להורים ⬇</button>
        <div class="parent-zone hidden" id="parentZone">
        <div class="set-row"><span>גיל</span>
          <div class="age-pick">
            <button data-age="5">5</button>
            <button data-age="6">6</button>
            <button data-age="7">7</button>
          </div>
        </div>
        <div class="set-row"><span>🎯 רמת קושי</span>
          <div class="diff-pick">
            <button data-diff="easy">קל</button>
            <button data-diff="normal">רגיל</button>
            <button data-diff="hard">מאתגר</button>
          </div>
        </div>
        <div class="set-row"><span>⏰ זמן משחק</span>
          <div class="sess-pick">
            <button data-sess="15">15</button>
            <button data-sess="20">20</button>
            <button data-sess="30">30</button>
            <button data-sess="0">בלי</button>
          </div>
        </div>
        <div class="auth-block" id="authBlock"></div>
        <button class="btn-report" id="reportBtn">📊 דוח להורה</button>
        <button class="btn-reset" id="resetBtn">🔄 להתחיל מחדש</button>
        <a class="credits-link" href="assets/models/CREDITS.txt" target="_blank" rel="noopener">🧩 קרדיטים למודלים התלת-ממדיים (Quaternius ואחרים)</a>
        </div>
      </div>`;
    this.root.appendChild(ov);
    ov.querySelector('#setClose').onclick = () => { Audio.click(); ov.classList.add('hidden'); };
    ov.querySelector('#parentsBtn').onclick = () => { Audio.click(); ov.querySelector('#parentZone').classList.toggle('hidden'); };
    ov.querySelector('#reportBtn').onclick = () => {
      Audio.click();
      const g = this.handlers.getGame && this.handlers.getGame();
      if (g) this.openParentReport(g);
    };
    ov.onclick = (e) => { if (e.target === ov) ov.classList.add('hidden'); };
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ov.classList.contains('hidden')) ov.classList.add('hidden'); });
    ov.querySelector('#resetBtn').onclick = () => {
      if (confirm('להתחיל את המשחק מחדש? כל החווה תימחק.')) this.handlers.onReset && this.handlers.onReset();
    };
    this.settingsOv = ov;
  },

  openSettings() {
    const g = this.handlers.getGame && this.handlers.getGame();
    if (g) this._syncSettings(g);
    this._syncAuth();
    this.settingsOv.classList.remove('hidden');
  },

  _authErr(e) {
    const m = (e && e.message) || '';
    if (/not_allowed/.test(m)) return 'המייל הזה עוד לא ברשימה של החווה 💙 אפשר לבקש מאבא להוסיף אותו, ובינתיים לשחק בלי חשבון';
    if (/not_farm_account/.test(m)) return 'המייל הזה שייך למערכת אחרת. נסי מייל אחר';
    if (/bad_email/.test(m)) return 'המייל לא נראה תקין, נסי שוב';
    if (/no_crypto/.test(m)) return 'צריך לפתוח את המשחק מהכתובת הרגילה שלו (https) כדי להיכנס';
    return 'משהו השתבש, נסי שוב';
  },

  _syncAuth() {
    const box = this.settingsOv.querySelector('#authBlock');
    if (!box) return;
    const acct = Cloud.accountEmail();
    if (acct) {
      const g = this.handlers.getGame && this.handlers.getGame();
      const nm = (g && g.playerName()) || Cloud.profileName();
      const who = nm ? `<b>${nm}</b> · ` : '';
      const where = Cloud.email() ? '' : `<div class="auth-note">החווה נשמרת במכשיר הזה (הענן עוד לא מחובר)</div>`;
      box.innerHTML = `<div class="auth-status">👤 ${who}<b dir="ltr">${acct}</b></div>${where}
        <button class="auth-btn in" id="authSwitch" style="width:100%;margin-bottom:8px">🔄 להחליף שחקנית</button>
        <button class="auth-btn out" id="authOut">🚪 יציאה מהמייל</button>`;
      box.querySelector('#authSwitch').onclick = () => { Audio.click(); this.handlers.onSwitchPlayer && this.handlers.onSwitchPlayer(); };
      box.querySelector('#authOut').onclick = async (e) => {
        Audio.click(); e.currentTarget.disabled = true; e.currentTarget.textContent = 'יוצאות...';
        if (this.handlers.onAuth && this.handlers.onAuth.signOut) await this.handlers.onAuth.signOut();
        else { await Cloud.signOut(); location.replace(location.pathname); }
      };
      return;
    }
    box.innerHTML = `
      <div class="auth-title">👤 משחקת בלי חשבון</div>
      <div class="auth-note">החווה נשמרת במכשיר הזה. כניסה במייל של הורה (בלי סיסמה), ואז בוחרות מי משחקת. שחקנית חדשה יכולה לקחת את החווה הזו איתה.</div>
      <div data-f="form"></div>`;
    this._emailLoginForm(box.querySelector('[data-f="form"]'));
  },

  _syncSettings(g) {
    const ov = this.settingsOv;
    ov.querySelectorAll('.age-pick button').forEach(b => {
      b.classList.toggle('on', Number(b.dataset.age) === g.settings.age);
      b.onclick = () => { Audio.click(); g.settings.age = Number(b.dataset.age); this._syncSettings(g); this.handlers.onSettings && this.handlers.onSettings(); };
    });
    ov.querySelectorAll('.diff-pick button').forEach(b => {
      b.classList.toggle('on', b.dataset.diff === (g.settings.diff || 'normal'));
      b.onclick = () => { Audio.click(); g.settings.diff = b.dataset.diff; this._syncSettings(g); this.handlers.onSettings && this.handlers.onSettings(); };
    });
    ov.querySelectorAll('.sess-pick button').forEach(b => {
      b.classList.toggle('on', Number(b.dataset.sess) === (g.settings.sessionMin ?? 20));
      b.onclick = () => { Audio.click(); g.settings.sessionMin = Number(b.dataset.sess); this._syncSettings(g); this.handlers.onSettings && this.handlers.onSettings(); };
    });
    ov.querySelectorAll('.toggle').forEach(b => {
      const k = b.dataset.key;
      const on = g.settings[k];
      b.textContent = on ? 'פעיל' : 'כבוי';
      b.classList.toggle('off', !on);
      b.onclick = () => { Audio.click(); g.settings[k] = !g.settings[k]; this._syncSettings(g); this.handlers.onSettings && this.handlers.onSettings(); };
    });
  }
};

export { UI };
