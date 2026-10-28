// story.js — סיפור החווה: פרקים קצרים עם רותי, ובכל פרק 3 משימות שמתקדמות מפעולות רגילות במשחק.
// main.js שולח אירועים (Story.event('feed')) ו-Story מקדם את השלב, מכריז, ונותן פרס בסוף הפרק.
// כל שלב יודע לקחת את אגם למקום הנכון (go) — ילדה בת 6 לא צריכה לנחש איפה זה.
import { Audio } from './audio.js';

const CHAPTERS = [
  {
    title: 'בוקר בחווה', emoji: '🌅',
    intro: 'בוקר טוב{name}! אני רותי. כוכב ודבש התעוררו רעבים, והשדה מחכה לזרעים. בואי נתחיל את היום!',
    steps: [
      { ev: 'feed', n: 2, emoji: '🥕', text: 'להאכיל סוסים', go: 'horse' },
      { ev: 'brush', n: 1, emoji: '🧼', text: 'לנקות סוס', go: 'horse' },
      { ev: 'plant', n: 2, emoji: '🌱', text: 'לשתול בשדה', go: 'field' }
    ],
    reward: { coins: 30 },
    outro: 'איזו חוואית! הסוסים שבעים והשדה כבר ירוק.'
  },
  {
    title: 'הסייח רוצה לגדול', emoji: '🌟',
    intro: 'הסייח הקטן שלך חולם לרוץ במסלול הרכיבה. אם תאכילי אותו שלוש פעמים, הוא יוכל לגדול!',
    steps: [
      { ev: 'feed', n: 3, emoji: '🥕', text: 'להאכיל סוסים', go: 'horse' },
      { ev: 'grow', n: 1, emoji: '🌱', text: 'לגדל סייח לסוס גדול', go: 'foal' },
      { ev: 'enter_barn', n: 1, emoji: '🏠', text: 'להיכנס לאסם ולבקר את הסוסים', go: 'barn' }
    ],
    reward: { coins: 40 },
    outro: 'הוא גדל! עכשיו יש לך סוס גדול שאפשר לרכוב עליו.'
  },
  {
    title: 'רכיבה ראשונה', emoji: '🏇',
    intro: 'הכנתי לך הפתעה: מסלול רכיבה עם משוכות! לפני כל משוכה פותרים תרגיל, והסוס קופץ.',
    steps: [
      { ev: 'ride', n: 1, emoji: '🏁', text: 'לרכוב סיבוב במסלול', go: 'track' },
      { ev: 'jump', n: 6, emoji: '🐎', text: 'לקפוץ מעל משוכות', go: 'track' },
      { ev: 'play', n: 1, emoji: '🎾', text: 'לשחק עם סוס אחרי הרכיבה', go: 'horse' }
    ],
    reward: { coins: 40, stars: 1 },
    outro: 'רכבת כמו אלופה! הסוס שלך גאה בך.'
  },
  {
    title: 'חברים חדשים', emoji: '🐔',
    intro: 'החווה גדלה! הגיע הזמן להביא חיות חדשות. חיה שגרה אצלך נותנת תוצרת, ואחרי זמן מה גם גורים!',
    steps: [
      { ev: 'buy_animal', n: 1, emoji: '🛒', text: 'לקנות חיה בחנות', go: 'shop_animals' },
      { ev: 'collect', n: 2, emoji: '🥚', text: 'לאסוף תוצרת מחיות', go: 'animal' },
      { ev: 'harvest', n: 2, emoji: '🌾', text: 'לקצור יבול', go: 'field' }
    ],
    reward: { coins: 45 },
    outro: 'המכלאה מלאה חיים. תסתכלי טוב, אולי מישהו מחכה ללידה.'
  },
  {
    title: 'גור ראשון', emoji: '🍼',
    intro: 'כשרואים בקבוק 🍼 מעל חיה או סוס, זה אומר שנולד גור! בינתיים בואי נטייל ביער.',
    steps: [
      { ev: 'birth', n: 1, emoji: '🍼', text: 'לפגוש גור שנולד', go: 'birth' },
      { ev: 'visit_forest', n: 1, emoji: '🌲', text: 'לנסוע ליער', go: 'forest' },
      { ev: 'act_forest', n: 2, emoji: '🍄', text: 'לגלות דברים ביער', go: 'forest' }
    ],
    reward: { coins: 50 },
    outro: 'מזל טוב על הגור! הוא יגדל לאט לאט, בדיוק כמו ילדים.'
  },
  {
    title: 'אימון לתחרות', emoji: '🏆',
    intro: 'בעוד כמה ימים תהיה תחרות רכיבה גדולה. הסוס צריך להתאמן, והאגם הוא מקום מושלם למנוחה אחרי אימון.',
    steps: [
      { ev: 'ride', n: 2, emoji: '🏁', text: 'לרכוב סיבובים במסלול', go: 'track' },
      { ev: 'star_jump', n: 4, emoji: '⭐', text: 'לאסוף כוכבים בקפיצות', go: 'track' },
      { ev: 'visit_lake', n: 1, emoji: '🏖️', text: 'לנסוע לאגם', go: 'lake' }
    ],
    reward: { coins: 60, horse: 'rainbow' },
    outro: 'ראיתי את האימון שלך, ושלחתי לך מתנה: סוס קשת בענן! הוא כבר מחכה בחווה.'
  },
  {
    title: 'שוק בכפר', emoji: '🏘️', opens: 'village',
    intro: 'אנשי הכפר שמעו על החווה שלך! בואי לבקר אותם, להיכנס למאפייה, ולמכור משהו שכבר לא צריך.',
    steps: [
      { ev: 'visit_village', n: 1, emoji: '🏘️', text: 'לנסוע לכפר', go: 'village' },
      { ev: 'enter_bakery', n: 1, emoji: '🥐', text: 'להיכנס למאפייה ולאפות', go: 'bakery' },
      { ev: 'sell', n: 1, emoji: '💰', text: 'למכור משהו בחנות', go: 'sell' }
    ],
    reward: { coins: 60 },
    outro: 'כל הכפר מדבר על החווה היפה שלך!'
  },
  {
    title: 'המסע אל ההר', emoji: '🏔️', opens: 'mountain',
    intro: 'הפרק האחרון! בפסגת ההר יש נוף לכל העולם. רוכבים, מטפסים, ומגלים.',
    steps: [
      { ev: 'visit_mountain', n: 1, emoji: '🏔️', text: 'לנסוע להר', go: 'mountain' },
      { ev: 'act_mountain', n: 2, emoji: '🧗', text: 'לגלות דברים בהר', go: 'mountain' },
      { ev: 'perfect', n: 1, emoji: '🥇', text: 'סיבוב מושלם במסלול', go: 'track' }
    ],
    reward: { coins: 80, stars: 2 },
    outro: 'סיימת את כל הסיפור! את אלופת החווה. מעכשיו כל יום יש משימות חדשות.'
  }
];

// מה אומרים כששלב הושלם — בלשון עבר, כדי שיישמע כמו מחמאה ולא כמו הוראה ("יופי! להאכיל סוסים")
const DONE = {
  feed: 'האכלת את הסוסים', brush: 'ניקית את הסוס', plant: 'שתלת בשדה', grow: 'הסייח גדל לסוס גדול',
  enter_barn: 'ביקרת באסם', ride: 'רכבת במסלול', jump: 'קפצת מעל המשוכות', play: 'שיחקת עם הסוס',
  buy_animal: 'קנית חיה חדשה', collect: 'אספת תוצרת', harvest: 'קצרת יבול', birth: 'פגשת גור שנולד',
  visit_forest: 'הגעת ליער', act_forest: 'גילית דברים ביער', star_jump: 'אספת כוכבים',
  visit_lake: 'הגעת לאגם', visit_village: 'הגעת לכפר', enter_bakery: 'נכנסת למאפייה',
  sell: 'מכרת משהו בחנות', visit_mountain: 'הגעת להר', act_mountain: 'גילית דברים בהר', perfect: 'רכבת סיבוב מושלם'
};

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

const Story = {
  Game: null, deps: null, chip: null,

  // deps: { Game, root, go(target), reward(r) }
  init(deps) {
    this.deps = deps; this.Game = deps.Game;
    this._buildChip();
    this.refresh();
  },

  st() { const g = this.Game; if (!g.story) g.story = { ch: 0, prog: [], seen: false }; return g.story; },
  chapter() { return CHAPTERS[this.st().ch] || null; },
  finished() { return this.st().ch >= CHAPTERS.length; },
  // אזור שהסיפור פתח (גם אם הרמה עוד נמוכה) — כדי שפרק לא ייתקע על מנעול
  opened(areaId) {
    const ch = this.st().ch;
    return CHAPTERS.some((c, i) => i <= ch && c.opens === areaId);
  },

  _buildChip() {
    const c = el('button', 'story-chip hidden');
    c.id = 'storyChip';
    c.onclick = () => { Audio.click(); this.open(); };
    this.deps.root.appendChild(c);
    this.chip = c;
  },
  show(on) { if (this.chip) this.chip.classList.toggle('hidden', !on); },

  refresh() {
    if (!this.chip) return;
    if (this.finished()) { this.chip.innerHTML = '<span class="sc-ic">🏆</span><span class="sc-t">אלופת החווה</span>'; return; }
    const c = this.chapter(), p = this.st().prog;
    const done = c.steps.filter((s, i) => (p[i] || 0) >= s.n).length;
    const dots = c.steps.map((s, i) => `<i class="${(p[i] || 0) >= s.n ? 'on' : ''}"></i>`).join('');
    this.chip.innerHTML = `<span class="sc-ic">${c.emoji}</span><span class="sc-t">פרק ${this.st().ch + 1}</span><span class="sc-dots">${dots}</span>`;
    this.chip.classList.toggle('glow', !this.st().seen || done === c.steps.length);
  },

  // אירוע מהמשחק → מקדם שלב בפרק הנוכחי (רק שלב שעוד לא הושלם)
  event(ev, n = 1) {
    if (this.Game.visiting || this.finished()) return;
    const c = this.chapter(), s = this.st();
    let moved = false;
    c.steps.forEach((step, i) => {
      if (step.ev !== ev) return;
      const before = s.prog[i] || 0;
      if (before >= step.n) return;
      s.prog[i] = Math.min(step.n, before + n);
      moved = true;
      if (s.prog[i] >= step.n) this._stepDone(step);
    });
    if (!moved) return;
    this.Game.save();
    this.refresh();
    if (c.steps.every((step, i) => (s.prog[i] || 0) >= step.n)) setTimeout(() => this._chapterDone(), 1600);
  },

  _stepDone(step) {
    this.deps.toast('📜 ' + step.emoji + ' ' + step.text + ' ✔', true);
    Audio.speak('יופי! ' + (DONE[step.ev] || step.text) + '. סימנתי וי בסיפור', { queue: true });
  },

  // ---------- כרטיס הפרק ----------
  open() {
    this.close();
    if (this.finished()) {
      this._card(`<h2>🏆 אלופת החווה</h2>
        <div class="story-bubble">סיימת את כל הסיפור! כל יום יש משימות חדשות ב-🎯, והמסלול תמיד מחכה לך.</div>
        <button class="btn-big btn-play story-go-all">יאללה! 💪</button>`);
      Audio.speak('סיימת את כל הסיפור! את אלופת החווה');
      return;
    }
    const s = this.st(), c = this.chapter(), p = s.prog;
    const rows = c.steps.map((step, i) => {
      const v = p[i] || 0, ok = v >= step.n;
      return `<div class="story-step ${ok ? 'done' : ''}">
        <span class="ss-ic">${ok ? '✅' : step.emoji}</span>
        <span class="ss-t">${step.text}</span>
        <span class="ss-n">${ok ? '' : v + '/' + step.n}</span>
        ${ok ? '' : `<button class="ss-go" data-i="${i}" aria-label="קחי אותי">👉</button>`}
      </div>`;
    }).join('');
    const rw = this._rewardText(c.reward);
    // {name} = שם השחקנית בחשבון; לאורחת פשוט בלי שם ("בוקר טוב!")
    const pn = (this.Game.playerName && this.Game.playerName()) || '';
    const intro = c.intro.replace(/\{name\}/g, pn ? ' ' + pn : '');
    const ov = this._card(`
      <div class="story-head"><img src="assets/shopkeeper.png" alt=""><div>
        <div class="story-num">פרק ${s.ch + 1} מתוך ${CHAPTERS.length}</div>
        <h2>${c.emoji} ${c.title}</h2></div></div>
      <div class="story-bubble">${intro}<button class="story-say" aria-label="שמיעה">🔊</button></div>
      ${rows}
      <div class="story-reward">🎁 בסוף הפרק: ${rw}</div>
      <button class="btn-big btn-play story-go-all">יאללה! ▶</button>`);
    ov.querySelector('.story-say').onclick = () => Audio.speak(intro);
    ov.querySelectorAll('.ss-go').forEach(b => b.onclick = () => {
      Audio.click(); this.close();
      this.deps.go(c.steps[Number(b.dataset.i)].go);
    });
    if (!s.seen) { s.seen = true; this.Game.save(); this.refresh(); }
    Audio.speak(intro);
  },

  _rewardText(r) {
    const parts = [];
    if (r.coins) parts.push(r.coins + ' 🪙');
    if (r.stars) parts.push(r.stars + ' ⭐');
    if (r.horse) parts.push('הפתעה 🎁🐴');
    return parts.join(' + ');
  },

  _card(inner) {
    const ov = el('div', 'overlay light'); ov.id = 'storyOv';
    ov.innerHTML = `<div class="card story-card"><button class="close" aria-label="סגירה">✖</button>${inner}</div>`;
    this.deps.root.appendChild(ov);
    const close = () => { Audio.click(); Audio.stopSpeak(); this.close(); };
    ov.querySelector('.close').onclick = close;
    const go = ov.querySelector('.story-go-all'); if (go) go.onclick = close;
    ov.onclick = (e) => { if (e.target === ov) close(); };
    return ov;
  },
  close() { const o = document.getElementById('storyOv'); if (o) o.remove(); },

  // ---------- סוף פרק: חגיגה, פרס, ופתיחת הפרק הבא ----------
  _chapterDone() {
    const s = this.st(), c = this.chapter();
    if (this.deps.busy && this.deps.busy()) { setTimeout(() => this._chapterDone(), 2500); return; }   // לא קוטעים רכיבה
    if (!c || !c.steps.every((step, i) => (s.prog[i] || 0) >= step.n)) return;
    this.deps.reward(c.reward);
    s.ch++; s.prog = []; s.seen = false;
    this.Game.save();
    this.refresh();
    this.deps.onChapter && this.deps.onChapter();
    this.close();
    const next = this.chapter();
    const ov = this._card(`
      <div class="story-party">🎉</div>
      <h2>סיימת את פרק ${s.ch}!</h2>
      <div class="story-bubble">${c.outro}</div>
      <div class="story-reward big">קיבלת: ${this._rewardText(c.reward)}</div>
      <button class="btn-big btn-play story-next">${next ? 'לפרק הבא ▶' : 'יאללה! 🏆'}</button>`);
    Audio.fanfare();
    setTimeout(() => Audio.speak('סיימת את הפרק! ' + c.outro), 500);
    ov.querySelector('.story-next').onclick = () => { Audio.click(); this.open(); };
  }
};

export { Story, CHAPTERS };
