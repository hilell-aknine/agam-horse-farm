// ui.js — שכבת DOM: מסכים, HUD, כרטיס סוס, חנות, חלון תרגיל חשבון (עברית RTL)
import { Audio } from './audio.js';
import { SHOP, CROPS } from './game.js';
import { Cloud } from './cloud.js';

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

const ACTIONS = {
  feed:    { icon: '🍎', label: 'להאכיל' },
  brush:   { icon: '🧼', label: 'לנקות' },
  play:    { icon: '🎾', label: 'לשחק' },
  grow:    { icon: '🌱', label: 'לגדול' },
  plant:   { icon: '🌱', label: 'לשתול' },
  harvest: { icon: '🌾', label: 'לקצור' },
  buy:     { icon: '🛒', label: 'לקנות' },
  field:   { icon: '🟫', label: 'שדה חדש' },
  race:    { icon: '🏁', label: 'מירוץ' }
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
    const s = el('div', 'screen title-screen');
    s.id = 'titleScreen';
    s.innerHTML = `
      <div class="title-card">
        <div class="title-emoji">🐴</div>
        <h1 class="game-title">החווה של אגם</h1>
        <p class="game-sub">מגדלים סוסים ולומדים חשבון!</p>
        <button class="btn-big btn-play" id="playBtn">בואו נשחק! ▶</button>
        <button class="btn-ghost" id="titleSettings">⚙️ הגדרות</button>
        <p class="credit">נבנה באהבה ע״י אבא 💙</p>
      </div>`;
    this.root.appendChild(s);
    s.querySelector('#playBtn').onclick = () => { Audio.resume(); Audio.click(); this.handlers.onStart && this.handlers.onStart(); };
    s.querySelector('#titleSettings').onclick = () => { Audio.click(); this.openSettings(); };
  },

  showTitle() { document.getElementById('titleScreen').classList.remove('hidden'); this.hud.classList.add('hidden'); },
  showGame() { document.getElementById('titleScreen').classList.add('hidden'); this.hud.classList.remove('hidden'); },

  // ---------- HUD ----------
  _buildHUD() {
    const h = el('div', 'hud hidden');
    h.innerHTML = `
      <div class="topbar">
        <div class="stat coins"><span class="ic">🪙</span><span id="coinVal">0</span></div>
        <div class="stat level">
          <span class="ic">⭐</span><span id="lvlVal">1</span>
          <div class="xpbar"><div class="xpfill" id="xpFill"></div></div>
        </div>
        <div class="stat streak hidden" id="streakBox"><span class="ic">🔥</span><span id="streakVal">0</span></div>
        <div class="left-tools">
          <button class="gear" id="fsBtn" title="מסך מלא">⛶</button>
          <button class="gear" id="gameSettings">⚙️</button>
        </div>
      </div>
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
    h.querySelector('#shopBtn').onclick = () => { Audio.click(); this.handlers.onOpenShop && this.handlers.onOpenShop(); };
    h.querySelector('#gameSettings').onclick = () => { Audio.click(); this.openSettings(); };
    h.querySelector('#fsBtn').onclick = () => { Audio.click(); this._toggleFs(); };
    h.querySelector('#funBtn').onclick = () => { Audio.click(); this.openFun(); };
  },

  updateHUD(g) {
    this.els.coin.textContent = g.coins;
    this.els.lvl.textContent = g.level;
    this.els.xp.style.width = Math.round((g.xp / g.xpForNext()) * 100) + '%';
    if (g.streak > 1) { this.els.streakBox.classList.remove('hidden'); this.els.streak.textContent = g.streak; }
    else this.els.streakBox.classList.add('hidden');
  },

  setTip(t) { if (this.els.tip) this.els.tip.textContent = t; },

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
          <button class="act" data-act="feed"><span class="act-ic">🍎</span><span class="act-lbl">להאכיל</span></button>
          <button class="act" data-act="brush"><span class="act-ic">🧼</span><span class="act-lbl">לנקות</span></button>
          <button class="act" data-act="play"><span class="act-ic">🎾</span><span class="act-lbl">לשחק</span></button>
          ${growBtn}
        </div>
      </div>`;
    this.root.appendChild(ov);
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
          <div class="keeper-bubble" id="keeperBubble">שלום אגם! מה תרצי לקנות היום? 😊</div>
        </div>
        <div class="coin-pill">🪙 <span id="shopCoins">${game.coins}</span></div>
        <div class="shop-tabs">
          <button class="shop-tab on" data-tab="decor">🌳 קישוטים</button>
          <button class="shop-tab" data-tab="equipment">🚜 ציוד</button>
          <button class="shop-tab" data-tab="animals">🐔 חיות</button>
          <button class="shop-tab" data-tab="horses">🐴 סוסים</button>
          <button class="shop-tab" data-tab="upgrades">🏠 שדרוגים</button>
          <button class="shop-tab" data-tab="fields">🟫 שדה</button>
        </div>
        <div class="shop-grid shelf" id="shopGrid"></div>
      </div>`;
    this.root.appendChild(ov);
    ov.querySelector('#shopClose').onclick = () => { Audio.click(); this.closeShop(); };
    ov.onclick = (e) => { if (e.target === ov) this.closeShop(); };
    const grid = ov.querySelector('#shopGrid');
    const bubble = ov.querySelector('#keeperBubble');
    const lines = { decor: 'קישוטים יפים לחווה! 🌳', equipment: 'הציוד הכי טוב! 🚜', animals: 'חיות חמודות 🐔', horses: 'סוסים נהדרים! 🐴', upgrades: 'שדרוגים לאסם! 🏠', fields: 'עוד שדה לגדל בו 🟫' };
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
      } else if (tab === 'upgrades') {
        SHOP.upgrades.forEach(it => {
          const owned = (game.upgrades || {})[it.id];
          grid.appendChild(this._shopCard('assets/' + it.asset, it.name + (owned ? ' ✅' : ''), it.cost, !owned && game.coins >= it.cost,
            () => { this.closeShop(); this.handlers.onBuyUpgrade && this.handlers.onBuyUpgrade(it); }));
        });
      } else if (tab === 'fields') {
        if (counts.fields >= counts.maxFields) {
          grid.innerHTML = '<div class="shop-empty">🎉 יש לך את כל השדות!</div>';
        } else {
          const cost = game.fieldCost(counts.fields);
          grid.appendChild(this._shopCard('assets/hay_bale.png', 'שדה חדש לשתילה', cost, game.coins >= cost,
            () => { this.closeShop(); this.handlers.onBuyField && this.handlers.onBuyField(); }, '🟫'));
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
    Audio.speak('שלום אגם! מה תרצי לקנות היום?');
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

  // ---------- תפריט כיף: משימות / גלגל / מירוץ ----------
  openFun() {
    const g = this.handlers.getGame && this.handlers.getGame();
    const ov = el('div', 'overlay light'); ov.id = 'funOv';
    ov.innerHTML = `<div class="card fun-card"><button class="close" id="funClose">✖</button>
      <h2>🎯 כיף ופרסים</h2>
      <button class="fun-opt" id="optQuests">📋 משימות היום</button>
      <button class="fun-opt" id="optSpin">🎡 גלגל המזל</button>
      <button class="fun-opt" id="optRace">🏁 מירוץ סוסים</button></div>`;
    this.root.appendChild(ov);
    ov.querySelector('#funClose').onclick = () => { Audio.click(); ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.querySelector('#optQuests').onclick = () => { Audio.click(); ov.remove(); this.openQuests(g); };
    ov.querySelector('#optSpin').onclick = () => { Audio.click(); ov.remove(); this.openSpin(); };
    ov.querySelector('#optRace').onclick = () => { Audio.click(); ov.remove(); this.handlers.onRace && this.handlers.onRace(); };
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

  // ---------- חלון תרגיל חשבון ----------
  askMath(problem, actionType, onDone) {
    this._mathOpen = true;
    let attempts = 0;
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

    // אפשרויות
    const ch = ov.querySelector('#choices');
    problem.choices.forEach(c => {
      const b = el('button', 'choice', String(c));
      b.onclick = () => {
        if (b.classList.contains('done')) return;
        if (c === problem.answer) {
          b.classList.add('correct', 'done');
          Audio.success();
          this._mathOpen = false;
          setTimeout(() => { ov.remove(); onDone && onDone({ correct: true, firstTry: attempts === 0 }); }, 750);
        } else {
          attempts++;
          b.classList.add('wrong');
          Audio.wrong();
          setTimeout(() => b.classList.remove('wrong'), 500);
          if (attempts === 1) {
            this._showHint(ov, problem);
            Audio.speak('כמעט! נסי שוב');
          }
          if (attempts >= 2) {
            // חושפים ומקריאים את התשובה הנכונה — שתלמד, לא תנחש
            ov.querySelectorAll('.choice').forEach(x => {
              if (Number(x.textContent) === problem.answer) x.classList.add('glow');
            });
            const ht = ov.querySelector('#hintText');
            if (ht) { ht.classList.remove('hidden'); ht.innerHTML = `💡 התשובה היא <b>${problem.answer}</b> — געי בה`; }
            Audio.speak('התשובה הנכונה היא ' + problem.answer + '. געי בה');
          }
        }
      };
      ch.appendChild(b);
    });

    ov.querySelector('#mathClose').onclick = () => { Audio.click(); this._mathOpen = false; ov.remove(); onDone && onDone({ correct: false, cancelled: true }); };
    ov.querySelector('#speakBtn').onclick = () => Audio.speak(problem.speech || problem.question);
    ov.querySelector('#hintBtn').onclick = () => this._showHint(ov, problem);

    // הקראה אוטומטית
    Audio.speak(problem.speech || problem.question);
  },

  _showHint(ov, problem) {
    const ht = ov.querySelector('#hintText');
    if (ht) { ht.classList.remove('hidden'); }
    Audio.speak(problem.hint || '');
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
        <div class="set-row"><span>גיל</span>
          <div class="age-pick">
            <button data-age="5">5</button>
            <button data-age="6">6</button>
            <button data-age="7">7</button>
          </div>
        </div>
        <div class="set-row"><span>🔊 צלילים</span><button class="toggle" data-key="sound">פעיל</button></div>
        <div class="set-row"><span>🗣️ קול מקריא</span><button class="toggle" data-key="voice">פעיל</button></div>
        <div class="set-row"><span>🎵 מוזיקה</span><button class="toggle" data-key="music">פעיל</button></div>
        <div class="set-row"><span>🌙 יום ולילה</span><button class="toggle" data-key="daynight">פעיל</button></div>
        <div class="auth-block" id="authBlock"></div>
        <button class="btn-reset" id="resetBtn">🔄 להתחיל מחדש</button>
      </div>`;
    this.root.appendChild(ov);
    ov.querySelector('#setClose').onclick = () => { Audio.click(); ov.classList.add('hidden'); };
    ov.onclick = (e) => { if (e.target === ov) ov.classList.add('hidden'); };
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
    if (/registered|already/i.test(m)) return 'האימייל כבר רשום — נסי כניסה';
    if (/invalid|credential/i.test(m)) return 'אימייל או סיסמה שגויים';
    if (/least|password/i.test(m)) return 'סיסמה חייבת 6 תווים לפחות';
    return 'משהו השתבש, נסי שוב';
  },

  _syncAuth() {
    const box = this.settingsOv.querySelector('#authBlock');
    if (!box) return;
    if (!Cloud.ready) {
      box.innerHTML = `<div class="auth-note">☁️ שמירת ענן מתחברת... (המשחק נשמר במכשיר בכל מקרה)</div>`;
      return;
    }
    if (Cloud.email()) {
      box.innerHTML = `<div class="auth-status">👤 מחובר/ת: <b dir="ltr">${Cloud.email()}</b></div>
        <button class="auth-btn out" id="authOut">התנתקות</button>`;
      box.querySelector('#authOut').onclick = async () => { Audio.click(); await Cloud.signOut(); location.reload(); };
      return;
    }
    box.innerHTML = `
      <div class="auth-title">👤 חשבון — לשחק מכל מכשיר</div>
      <div class="auth-note">החווה נשמרת אצלך. צרי חשבון כדי לשחק גם מטאבלט/טלפון ולא לאבד אותה.</div>
      <input class="auth-in" id="authEmail" type="email" placeholder="אימייל" dir="ltr" autocomplete="email">
      <input class="auth-in" id="authPass" type="password" placeholder="סיסמה (6+ תווים)" dir="ltr">
      <div class="auth-row">
        <button class="auth-btn up" id="authUp">הרשמה</button>
        <button class="auth-btn in" id="authIn">כניסה</button>
      </div>
      <div class="auth-msg" id="authMsg"></div>`;
    const em = () => box.querySelector('#authEmail').value.trim();
    const pw = () => box.querySelector('#authPass').value;
    const msg = (t, ok) => { const m = box.querySelector('#authMsg'); m.textContent = t; m.className = 'auth-msg ' + (ok ? 'ok' : 'err'); };
    box.querySelector('#authUp').onclick = async () => {
      Audio.click();
      if (!em() || pw().length < 6) { msg('מלאי אימייל וסיסמה (6+ תווים)'); return; }
      msg('רושמת...', true);
      try { await Cloud.signUp(em(), pw()); msg('נרשמת! טוען...', true); setTimeout(() => location.reload(), 700); }
      catch (e) { msg(this._authErr(e)); }
    };
    box.querySelector('#authIn').onclick = async () => {
      Audio.click();
      if (!em() || !pw()) { msg('מלאי אימייל וסיסמה'); return; }
      msg('נכנסת...', true);
      try { await Cloud.signIn(em(), pw()); msg('ברוכה הבאה! טוען...', true); setTimeout(() => location.reload(), 700); }
      catch (e) { msg(this._authErr(e)); }
    };
  },

  _syncSettings(g) {
    const ov = this.settingsOv;
    ov.querySelectorAll('.age-pick button').forEach(b => {
      b.classList.toggle('on', Number(b.dataset.age) === g.settings.age);
      b.onclick = () => { Audio.click(); g.settings.age = Number(b.dataset.age); this._syncSettings(g); this.handlers.onSettings && this.handlers.onSettings(); };
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
