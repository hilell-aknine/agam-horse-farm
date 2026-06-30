// game.js — מצב המשחק, כלכלת מטבעות, התקדמות ושמירה (localStorage)
const SAVE_KEY = 'agam_farm_v2';

// גידולים לשתילה בשדה (ללא לחץ זמן — היבול ממתין כשבשל)
const CROPS = {
  carrot:     { key: 'carrot',     name: 'גזר',     icon: '🥕', asset: 'carrot.png',      seedCost: 4,  sellPrice: 10, growMs: 25000, size: 1.7 },
  wheat:      { key: 'wheat',      name: 'חיטה',    icon: '🌾', asset: 'wheat.png',        seedCost: 6,  sellPrice: 14, growMs: 35000, size: 2.0 },
  flower:     { key: 'flower',     name: 'פרח',     icon: '🌸', asset: 'flower_bush.png',  seedCost: 5,  sellPrice: 12, growMs: 30000, size: 1.9 },
  strawberry: { key: 'strawberry', name: 'תות',     icon: '🍓', asset: 'strawberry.png',   seedCost: 7,  sellPrice: 16, growMs: 32000, size: 1.7 },
  corn:       { key: 'corn',       name: 'תירס',    icon: '🌽', asset: 'corn.png',         seedCost: 8,  sellPrice: 18, growMs: 40000, size: 2.0 },
  pumpkin:    { key: 'pumpkin',    name: 'דלעת',    icon: '🎃', asset: 'pumpkin.png',      seedCost: 10, sellPrice: 24, growMs: 55000, size: 2.1 },
};

// קטלוג החנות
const SHOP = {
  decor: [
    { id: 'tree',        name: 'עץ',          asset: 'tree.png',        cost: 15, h: 7 },
    { id: 'flower_bush', name: 'שיח פרחים',   asset: 'flower_bush.png', cost: 12, h: 2.2 },
    { id: 'pond',        name: 'בריכה',       asset: 'pond.png',        cost: 45, h: 2.4 },
    { id: 'fountain',    name: 'מזרקה',       asset: 'fountain.png',    cost: 50, h: 3.4 },
    { id: 'scarecrow',   name: 'דחליל',       asset: 'scarecrow.png',   cost: 25, h: 3.4 },
    { id: 'windmill',    name: 'טחנת רוח',    asset: 'windmill.png',    cost: 60, h: 6 },
    { id: 'signpost',    name: 'שלט',         asset: 'signpost.png',    cost: 10, h: 3 },
    { id: 'rainbow',     name: 'קשת בענן',    asset: 'rainbow.png',     cost: 70, h: 7 },
    { id: 'balloons',    name: 'בלונים',      asset: 'balloons.png',    cost: 22, h: 4 },
    { id: 'bench',       name: 'ספסל',        asset: 'bench.png',       cost: 28, h: 2 },
    { id: 'butterfly',   name: 'פרפר',        asset: 'butterfly.png',   cost: 14, h: 1.6 },
    { id: 'mushroom',    name: 'בית פטרייה',  asset: 'mushroom.png',    cost: 40, h: 3 },
    { id: 'lamp_post',   name: 'פנס',         asset: 'lamp_post.png',   cost: 30, h: 4 },
  ],
  equipment: [
    { id: 'trough',    name: 'שוקת אוכל',  asset: 'trough.png',       cost: 35, h: 2.0 },
    { id: 'well',      name: 'באר מים',    asset: 'well.png',         cost: 40, h: 3.2 },
    { id: 'saddle',    name: 'אוכף',       asset: 'saddle.png',       cost: 30, h: 1.8 },
    { id: 'horseshoe', name: 'פרסת מזל',   asset: 'horseshoe.png',    cost: 20, h: 1.6 },
    { id: 'hay_bale',  name: 'חבילת חציר', asset: 'hay_bale.png',     cost: 18, h: 2.2 },
    { id: 'feed_sack', name: 'שק מספוא',   asset: 'feed_sack.png',    cost: 16, h: 2.0 },
  ],
  // חיות משק — מייצרות תוצרת לאורך זמן (אוספים עם תרגיל ומוכרים)
  animals: [
    { id: 'chicken', name: 'תרנגולת', asset: 'chicken.png', cost: 30, scale: 1.5, produce: { emoji: '🥚', intervalMs: 30000, sell: 9 } },
    { id: 'pig',     name: 'חזיר',    asset: 'pig.png',     cost: 50, scale: 1.9, produce: { emoji: '🍠', intervalMs: 45000, sell: 15 } },
    { id: 'sheep',   name: 'כבשה',    asset: 'sheep.png',   cost: 60, scale: 1.9, produce: { emoji: '🧶', intervalMs: 50000, sell: 18 } },
    { id: 'cow',     name: 'פרה',     asset: 'cow.png',     cost: 90, scale: 2.3, produce: { emoji: '🥛', intervalMs: 60000, sell: 26 } },
  ],
  // שדרוגים שמשנים את האסם/החווה באופן נראה (פעם אחת כל אחד)
  upgrades: [
    { id: 'barn_big',    name: 'אסם גדול',  asset: 'barn_big.png',    cost: 120 },
    { id: 'silo',        name: 'סילו',      asset: 'silo.png',        cost: 80 },
    { id: 'weathervane', name: 'שבשבת',     asset: 'weathervane.png', cost: 35 },
  ],
};

// מאגר משימות יומיות
const QUEST_POOL = [
  { id: 'plant',   emoji: '🌱', target: 3, reward: 15, label: n => `לשתול ${n} גידולים` },
  { id: 'harvest', emoji: '🌾', target: 2, reward: 15, label: n => `לקצור ${n} פעמים` },
  { id: 'feed',    emoji: '🍎', target: 3, reward: 12, label: n => `להאכיל ${n} סוסים` },
  { id: 'brush',   emoji: '🧼', target: 2, reward: 12, label: n => `לנקות ${n} סוסים` },
  { id: 'collect', emoji: '🥚', target: 2, reward: 18, label: n => `לאסוף תוצרת ${n} פעמים` },
  { id: 'solve',   emoji: '🔢', target: 10, reward: 20, label: n => `לפתור ${n} תרגילים` }
];

const Game = {
  coins: 40,
  xp: 0,
  level: 1,
  stars: 0,
  streak: 0,
  bestStreak: 0,
  solved: 0,
  settings: { age: 6, sound: true, voice: true, music: true, daynight: true },
  typeStats: {},     // {type: {c, w}} — דיוק לפי סוג תרגיל
  quests: [],        // משימות היום
  questDate: '',
  spinDate: '',      // תאריך הסיבוב האחרון בגלגל
  upgrades: {},      // שדרוגי אסם/חווה שנקנו {id:true}
  _firstRun: true,

  // קושי גדל עם הגיל שנבחר ועם ההתקדמות במשחק
  ageBase() { return { 5: 1, 6: 3, 7: 5 }[this.settings.age] || 3; },
  difficulty() {
    const d = this.ageBase() + Math.floor(this.level / 2);
    return Math.max(1, Math.min(12, d));
  },

  xpForNext() { return 100; },

  onCorrect() {
    this.solved++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.xp += 10;
    this.coins += 5;
    let leveledUp = false;
    while (this.xp >= this.xpForNext()) {
      this.xp -= this.xpForNext();
      this.level++;
      this.stars++;
      leveledUp = true;
    }
    this.save();
    return { leveledUp };
  },

  // ללא עונש — לגיל 6 לא מאפסים את הרצף על טעות (משחק סלחני, בלי תחושת כישלון)
  onWrong() { },

  // --- קושי מותאם: דיוק לפי סוג תרגיל ---
  recordResult(type, correct) {
    if (!type) return;
    const s = this.typeStats[type] || (this.typeStats[type] = { c: 0, w: 0 });
    if (correct) s.c++; else s.w++;
  },
  weakType() {
    let worst = null, wr = 1;
    for (const t in this.typeStats) {
      const s = this.typeStats[t], n = s.c + s.w;
      if (n < 3) continue;
      const r = s.c / n;
      if (r < wr) { wr = r; worst = t; }
    }
    return wr < 0.75 ? worst : null;
  },

  // --- משימות יומיות ---
  ensureQuests(today) {
    if (this.questDate === today && this.quests.length) return;
    const pool = QUEST_POOL.slice(), picked = [];
    while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this.quests = picked.map(q => ({ id: q.id, emoji: q.emoji, target: q.target, reward: q.reward, text: q.label(q.target), progress: 0, done: false }));
    this.questDate = today; this.save();
  },
  bumpQuest(action) {
    const done = [];
    for (const q of this.quests) {
      if (q.done || q.id !== action) continue;
      q.progress++;
      if (q.progress >= q.target) { q.done = true; this.coins += q.reward; done.push(q); }
    }
    if (done.length) this.save();
    return done;
  },
  questsAllDone() { return this.quests.length > 0 && this.quests.every(q => q.done); },

  // --- גלגל מזל יומי ---
  canSpin(today) { return this.spinDate !== today; },
  doSpin(today) {
    this.spinDate = today;
    const prizes = [10, 15, 20, 25, 30, 15, 20, 25];
    const win = prizes[Math.floor(Math.random() * prizes.length)];
    this.coins += win; this.save();
    return win;
  },

  addCoins(n) { this.coins += n; this.save(); },
  canAfford(n) { return this.coins >= n; },
  spend(n) { if (this.coins < n) return false; this.coins -= n; this.save(); return true; },

  horseCost(owned) { return 25 + 15 * Math.max(0, owned - 1); },
  fieldCost(count) { return 20 + 12 * Math.max(0, count); },

  // מכירת יבול בקציר — מחזיר כמה מטבעות נוספו
  sellCrop(key) {
    const c = CROPS[key];
    const gain = c ? c.sellPrice : 8;
    this.coins += gain; this.save();
    return gain;
  },

  // snap = { horses, fields, placed } — נשמר בהדרגה
  save(snap) {
    try {
      if (snap) this._snap = Object.assign(this._snap || {}, snap);
      const s = this._snap || {};
      const data = {
        coins: this.coins, xp: this.xp, level: this.level, stars: this.stars,
        streak: this.streak, bestStreak: this.bestStreak, solved: this.solved,
        settings: this.settings,
        typeStats: this.typeStats, quests: this.quests, questDate: this.questDate, spinDate: this.spinDate,
        upgrades: this.upgrades, savedAt: Date.now(),
        horses: s.horses || [], fields: s.fields || [], placed: s.placed || [], animals: s.animals || []
      };
      this._lastData = data;     // לשימוש שמירת-הענן
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* storage full / blocked */ }
  },

  lastData() { return this._lastData; },

  // החלת אובייקט-נתונים מלא (מ-localStorage או מהענן)
  applyData(d) {
    this.coins = d.coins ?? 40;
    this.xp = d.xp ?? 0;
    this.level = d.level ?? 1;
    this.stars = d.stars ?? 0;
    this.streak = d.streak ?? 0;
    this.bestStreak = d.bestStreak ?? 0;
    this.solved = d.solved ?? 0;
    this.settings = Object.assign({ age: 6, sound: true, voice: true, music: true, daynight: true }, d.settings || {});
    this.typeStats = d.typeStats || {};
    this.quests = d.quests || [];
    this.questDate = d.questDate || '';
    this.spinDate = d.spinDate || '';
    this.upgrades = d.upgrades || {};
    this._snap = { horses: d.horses || [], fields: d.fields || [], placed: d.placed || [], animals: d.animals || [] };
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      this.applyData(d);
      this._firstRun = false;
      return d;
    } catch (e) { return null; }
  },

  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    this.coins = 40; this.xp = 0; this.level = 1; this.stars = 0;
    this.streak = 0; this.bestStreak = 0; this.solved = 0;
    this.settings = { age: 6, sound: true, voice: true, music: true, daynight: true };
    this.typeStats = {}; this.quests = []; this.questDate = ''; this.spinDate = ''; this.upgrades = {};
    this._firstRun = true; this._snap = { horses: [], fields: [], placed: [], animals: [] };
  }
};

export { Game, CROPS, SHOP };
