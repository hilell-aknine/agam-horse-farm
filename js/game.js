// game.js — מצב המשחק, כלכלת מטבעות, התקדמות ושמירה (localStorage)
// ריבוי שחקניות במכשיר אחד: לכל חשבון "מגירה" משלו ב-localStorage, ולאורחת מגירה נפרדת.
//   agam_farm_v2:guest       — החווה של מי שמשחקת בלי חשבון
//   agam_farm_v2:e:<email>   — החווה של כל חשבון (מזוהה לפי מייל ההורה; הענן הוא הגיבוי)
//   agam_farm_v2:u:<user_id> — שארית מהמעבר מהמפתח הישן; נאספת למגירת המייל בכניסה הראשונה
// המפתח הישן 'agam_farm_v2' (מגירה אחת לכולם) מועבר פעם אחת למגירה הנכונה לפי agam_farm_owner.
const LEGACY_KEY = 'agam_farm_v2';
const LEGACY_OWNER_KEY = 'agam_farm_owner';
const GUEST_NS = 'guest';
const nsKey = (ns) => LEGACY_KEY + ':' + ns;
const userNs = (userId) => 'u:' + userId;
const normEmail = (e) => String(e || '').trim().toLowerCase();
const emailNs = (email) => 'e:' + normEmail(email);

// גידולים לשתילה בשדה (ללא לחץ זמן — היבול ממתין כשבשל)
const CROPS = {
  carrot:     { key: 'carrot',     name: 'גזר',     icon: '🥕', asset: 'carrot.png',      seedCost: 4,  sellPrice: 10, growMs: 25000, size: 1.7 },
  wheat:      { key: 'wheat',      name: 'חיטה',    icon: '🌾', asset: 'wheat.png',        seedCost: 6,  sellPrice: 14, growMs: 35000, size: 2.0 },
  flower:     { key: 'flower',     name: 'פרח',     icon: '🌸', asset: 'flower_bush.png',  seedCost: 5,  sellPrice: 12, growMs: 30000, size: 1.9 },
  strawberry: { key: 'strawberry', name: 'תות',     icon: '🍓', asset: 'strawberry.png',   seedCost: 7,  sellPrice: 16, growMs: 32000, size: 1.7 },
  corn:       { key: 'corn',       name: 'תירס',    icon: '🌽', asset: 'corn.png',         seedCost: 8,  sellPrice: 18, growMs: 40000, size: 2.0 },
  pumpkin:    { key: 'pumpkin',    name: 'דלעת',    icon: '🎃', asset: 'pumpkin.png',      seedCost: 10, sellPrice: 24, growMs: 55000, size: 2.1 },
  apple:      { key: 'apple',      name: 'תפוח',    icon: '🍎', asset: 'apple.png',        seedCost: 7,  sellPrice: 17, growMs: 34000, size: 1.9 },
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
    { id: 'goat',    name: 'עז',      asset: 'goat.png',    cost: 70, scale: 1.9, produce: { emoji: '🧀', intervalMs: 55000, sell: 20 } },
    { id: 'turkey',  name: 'תרנגול הודו', asset: 'turkey.png', cost: 40, scale: 1.7, produce: { emoji: '🥚', intervalMs: 35000, sell: 11 } },
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
  settings: { age: 6, diff: 'normal', sound: true, voice: true, music: true, daynight: true },
  tutorialDone: false, // הדרכת 60 השניות הראשונות
  mastery: 0,        // שליטה בחשבון (0..8) — מה שמזיז את הקושי
  recent: [],        // 5 התוצאות האחרונות: 1=ניסיון ראשון, 0=בעזרה
  typeStats: {},     // {type: {c, w}} — דיוק לפי סוג תרגיל
  quests: [],        // משימות היום
  questDate: '',
  spinDate: '',      // תאריך הסיבוב האחרון בגלגל
  upgrades: {},      // שדרוגי אסם/חווה שנקנו {id:true}
  expansion: 0,      // רמת הרחבת-שטח החווה (0..3) — הגדר גדל והשדות מתרבים
  decorPos: {},      // מיקומים מותאמים של קישוטי-החווה שהוזזו במצב עיצוב {decorId:{x,z}}
  ribbons: 0,        // סרטים מתחרויות יופי
  rares: {},         // חיות נדירות שנפתחו {id:true}
  tree: null,        // עץ הקסם {planted, plantedAt, lastFruit}
  worldStats: { visited: {}, activities: {} },   // גילוי עולם: אילו אזורים בוקרו וכמה פעילויות בכל אחד
  story: { ch: 0, prog: [], seen: false },        // סיפור החווה: פרק נוכחי, התקדמות בכל שלב, האם הפרק הוצג
  rides: { laps: 0, perfect: 0, jumps: 0 },       // מסלול הרכיבה: סיבובים, סיבובים מושלמים, קפיצות
  _firstRun: true,
  name: '',          // שם השחקנית (לחשבון). לאורחת אין שם — פונים אליה בלי שם
  _ns: null,         // המגירה הפעילה (guest / u:<id>). null = עוד לא הוחלט → לא שומרים כלום

  // קושי גדל עם הגיל שנבחר ועם ההתקדמות במשחק
  ageBase() { return { 5: 1, 6: 3, 7: 5 }[this.settings.age] || 3; },
  // כוונון-קושי ידני מההגדרות: קל מוריד, מאתגר מעלה (מעל האוטומטי)
  diffOffset() { return { easy: -2, normal: 0, hard: 2 }[this.settings.diff] ?? 0; },
  // הקושי עולה לפי שליטה אמיתית ולא לפי רמת החווה: רמה עולה גם כשפותרים בעזרה.
  // 5 הצלחות רצופות בניסיון ראשון → שליטה +1. 3 מתוך 5 האחרונים בעזרה → שליטה -1.
  difficulty() {
    const d = this.ageBase() + this.mastery + this.diffOffset();
    return Math.max(1, Math.min(12, d));
  },
  _updateMastery(firstTry) {
    this.recent = (this.recent || []).concat(firstTry ? 1 : 0).slice(-5);
    const helped = this.recent.filter(x => !x).length;
    if (this.recent.length === 5 && helped === 0) { this.mastery = Math.min(8, this.mastery + 1); this.recent = []; }
    else if (helped >= 3) { this.mastery = Math.max(0, this.mastery - 1); this.recent = []; }
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
    this._updateMastery(correct);
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

  // --- גילוי עולם ---
  visitArea(id) {
    if (!this.worldStats.visited[id]) { this.worldStats.visited[id] = true; this.save(); }
  },
  recordActivity(id) {
    const a = this.worldStats.activities;
    a[id] = (a[id] || 0) + 1;
    let bonus = false;
    if (a[id] % 3 === 0) { this.stars += 1; bonus = true; }
    this.save();
    return bonus;
  },
  areaVisited(id) { return !!this.worldStats.visited[id]; },
  areaCount(id) { return this.worldStats.activities[id] || 0; },

  addCoins(n) { this.coins += n; this.save(); },
  canAfford(n) { return this.coins >= n; },
  spend(n) { if (this.coins < n) return false; this.coins -= n; this.save(); return true; },

  horseCost(owned) { return 25 + 15 * Math.max(0, owned - 1); },
  fieldCost(count) { return 20 + 12 * Math.max(0, count); },

  // --- הרחבת שטח החווה (בכסף) ---
  maxExpansion: 3,
  expansionCost() { return [70, 140, 240][this.expansion] || null; },   // null = הורחב למקסימום
  canExpandFarm() { return this.expansion < this.maxExpansion; },
  expandFarm() {                     // מגדיל רמת-הרחבה; המתקשר בונה מחדש גדר + שדות
    if (this.expansion >= this.maxExpansion) return false;
    this.expansion++; this.save();
    return true;
  },
  fenceRadius() { return 15 + this.expansion * 4; },       // רדיוס הגדר לפי רמת ההרחבה
  fieldCap() { return 9 + this.expansion * 3; },           // תקרת חלקות שדה לפי ההרחבה

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
        name: this.name || '',
        typeStats: this.typeStats, tutorialDone: this.tutorialDone, mastery: this.mastery, recent: this.recent, quests: this.quests, questDate: this.questDate, spinDate: this.spinDate,
        upgrades: this.upgrades, expansion: this.expansion, decorPos: this.decorPos, ribbons: this.ribbons, rares: this.rares, tree: this.tree, worldStats: this.worldStats, story: this.story, rides: this.rides, savedAt: Date.now(),
        horses: s.horses || [], fields: s.fields || [], placed: s.placed || [], animals: s.animals || []
      };
      this._lastData = data;     // לשימוש שמירת-הענן
      if (!this._ns) return;     // לפני שהוחלט של מי החווה — לא כותבים לאף מגירה
      localStorage.setItem(nsKey(this._ns), JSON.stringify(data));
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
    this.settings = Object.assign({ age: 6, diff: 'normal', sound: true, voice: true, music: true, daynight: true }, d.settings || {});
    this.typeStats = d.typeStats || {};
    this.name = (this._ns === GUEST_NS) ? '' : (d.name || this.name || '');
    // שמירה ישנה בלי שליטה: מתחילים מהקושי שהיה לה (רמה/2), והמנגנון יתקן מכאן
    this.mastery = Number.isFinite(d.mastery) ? d.mastery : Math.min(8, Math.floor((d.level || 1) / 2));
    this.recent = d.recent || [];
    // שחקנית ותיקה לא צריכה הדרכה
    this.tutorialDone = d.tutorialDone ?? ((d.level || 1) > 1 || (d.solved || 0) > 0);
    this.quests = d.quests || [];
    this.questDate = d.questDate || '';
    this.spinDate = d.spinDate || '';
    this.upgrades = d.upgrades || {};
    this.expansion = d.expansion || 0;
    this.decorPos = d.decorPos || {};
    this.ribbons = d.ribbons || 0;
    this.rares = d.rares || {};
    this.tree = d.tree || null;
    this.worldStats = d.worldStats || { visited: {}, activities: {} };
    this.story = Object.assign({ ch: 0, prog: [], seen: false }, d.story || {});
    this.rides = Object.assign({ laps: 0, perfect: 0, jumps: 0 }, d.rides || {});
    this._snap = { horses: d.horses || [], fields: d.fields || [], placed: d.placed || [], animals: d.animals || [] };
  },

  // ---------- מגירות שמירה (ריבוי שחקניות) ----------
  // מעבר חד-פעמי מהמפתח הישן: שמירה עם בעלים ידוע → למגירת החשבון, בלי בעלים → למגירת האורחת.
  migrateLegacy() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const owner = localStorage.getItem(LEGACY_OWNER_KEY);
        const target = nsKey(owner ? userNs(owner) : GUEST_NS);
        if (!localStorage.getItem(target)) localStorage.setItem(target, raw);
        localStorage.removeItem(LEGACY_KEY);
      }
      localStorage.removeItem(LEGACY_OWNER_KEY);
    } catch (e) {}
  },
  useGuest() { this._ns = GUEST_NS; this.name = ''; },
  // חשבון לפי מייל. userId (אם יש session בענן) — אוסף שארית ממגירת ה-id הישנה
  useEmail(email, userId) {
    this._ns = emailNs(email);
    try {
      if (userId && !localStorage.getItem(nsKey(this._ns))) {
        const old = localStorage.getItem(nsKey(userNs(userId)));
        if (old) { localStorage.setItem(nsKey(this._ns), old); localStorage.removeItem(nsKey(userNs(userId))); }
      }
    } catch (e) {}
  },
  hasEmailFarm(email) { try { return !!localStorage.getItem(nsKey(emailNs(email))); } catch (e) { return false; } },
  hasGuestFarm() { try { return !!localStorage.getItem(nsKey(GUEST_NS)); } catch (e) { return false; } },
  isGuest() { return this._ns === GUEST_NS; },
  // השם שבו פונים לשחקנית. '' לאורחת → מנסחים בלי שם
  playerName() { return this.isGuest() || this.visiting ? '' : (this.name || ''); },
  namespace() { return this._ns; },
  // קריאה של מגירה בלי להחיל אותה על המשחק
  peek(ns) {
    try { const raw = localStorage.getItem(nsKey(ns)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  },
  // העברת חוות האורחת לחשבון חדש (רק בהרשמה חדשה). מחזיר את הנתונים שהועברו או null.
  adoptGuestInto(email) {
    try {
      const raw = localStorage.getItem(nsKey(GUEST_NS));
      if (!raw || !email) return null;
      const dst = nsKey(emailNs(email));
      if (localStorage.getItem(dst)) return null;   // לחשבון כבר יש חווה במכשיר — לא דורסים
      localStorage.setItem(dst, raw);
      localStorage.removeItem(nsKey(GUEST_NS));      // החווה עברה לחשבון, האורחת הבאה מתחילה חדשה
      return JSON.parse(raw);
    } catch (e) { return null; }
  },

  load() {
    try {
      if (!this._ns) return null;
      const raw = localStorage.getItem(nsKey(this._ns));
      if (!raw) return null;
      const d = JSON.parse(raw);
      this.applyData(d);
      this._firstRun = false;
      return d;
    } catch (e) { return null; }
  },

  reset() {
    try { if (this._ns) localStorage.removeItem(nsKey(this._ns)); } catch (e) {}
    this.coins = 40; this.xp = 0; this.level = 1; this.stars = 0;
    this.streak = 0; this.bestStreak = 0; this.solved = 0;
    this.settings = { age: 6, diff: 'normal', sound: true, voice: true, music: true, daynight: true };
    if (this._ns === GUEST_NS) this.name = '';
    this.typeStats = {}; this.tutorialDone = false; this.mastery = 0; this.recent = []; this.quests = []; this.questDate = ''; this.spinDate = ''; this.upgrades = {}; this.expansion = 0; this.decorPos = {};
    this.ribbons = 0; this.rares = {}; this.tree = null; this.worldStats = { visited: {}, activities: {} };
    this.story = { ch: 0, prog: [], seen: false }; this.rides = { laps: 0, perfect: 0, jumps: 0 };
    this._firstRun = true; this._snap = { horses: [], fields: [], placed: [], animals: [] }; this._lastData = null;
  }
};

export { Game, CROPS, SHOP };
