// main.js — מקשר הכל: עולם, סוסים, שדות, חנות, ממשק, מצב ולולאת המשחק
import { World, THREE } from './engine/world.js';
import { Horses } from './farm/horses.js';
import { Models3D } from './engine/models3d.js';
import { Transfer3D } from './minigames/transfer3d.js';
import { Fields } from './farm/fields.js';
import { Animals } from './farm/animals.js';
import { Cloud } from './net/cloud.js';
import { UI } from './ui/ui.js';
import { Game, CROPS, SHOP, msUntilMorning } from './systems/game.js';
import { Audio } from './systems/audio.js';
import { generateProblem, makeTransferTask } from './systems/math.js';
import { createContest } from './minigames/contest.js';
import { createDelivery } from './minigames/delivery.js';
import { createPhoto } from './minigames/photo.js';
import { buildForest } from './areas/forest_area.js';
import { buildLake } from './areas/lake_area.js';
import { buildVillage } from './areas/village_area.js';
import { buildMountain } from './areas/mountain_area.js';
import { buildFair } from './areas/fair_area.js';
import { Story } from './systems/story.js';
import { Track3D } from './areas/track3d.js';
import { Interiors } from './areas/interiors.js';

const nowMs = () => Date.now();
const today = () => new Date().toLocaleDateString('en-CA');   // תאריך מקומי (UTC החליף יום בשתיים בלילה בקיץ)

// --- עולם חברתי: מצב ביקור אצל חברה (?visit=<user_id>&name=<שם>) ---
const VISIT = (() => {
  try {
    const p = new URLSearchParams(location.search);
    const id = p.get('visit');
    return id ? { id, name: p.get('name') || 'חברה' } : null;
  } catch (e) { return null; }
})();
// ריבוי שחקניות במכשיר אחד: לכל חשבון מגירת-שמירה משלו ולאורחת מגירה נפרדת (ראו game.js).
// מה שנשאר כאן: מתי מותר לשמור. בזמן החלפת חשבון (יציאה/כניסה) עוצרים את כל השמירות,
// כדי שה-autosave וה-beforeunload לא יכתבו את החווה הנוכחית למגירה או לענן של מישהי אחרת.
let saveLocked = true;   // נפתח רק אחרי שה-boot בנה את החווה הנכונה

const PENDING_NAME_KEY = 'agam_pending_name';   // שם שהוקלד בכניסה, מוחל על החווה אחרי הטעינה מחדש
let pendingLogin = null;                          // { email, mode } בין הכניסה לבחירת "לקחת את חוות האורחת?"

// כניסה במייל של הורה בלבד (בלי סיסמה, רק מייל מורשה). אחריה בוחרים מי משחקת.
// מחזיר { email, players, canAdopt } — canAdopt: יש במכשיר חוות אורחת שאפשר לתת לשחקנית חדשה.
async function loginWithEmail(email) {
  if (!saveLocked && !Game.visiting) saveAll();   // החווה הנוכחית נשמרת למגירה שלה
  saveLocked = true;                                // מכאן ועד הטעינה מחדש — לא שומרים כלום
  let r;
  try { r = await Cloud.loginEmail(email); }
  catch (e) { saveLocked = false; throw e; }
  email = String(email).trim().toLowerCase();
  let players = Game.players(email);
  if (!players.length && r.mode === 'cloud') {      // מכשיר חדש לחשבון קיים: החווה בענן = השחקנית הראשונה
    const d = await withTimeout(Cloud.pull(), 4000, null);
    if (d) { players = [{ id: 'main', name: d.name || '' }]; Game._savePlayers(email, players); }
  }
  pendingLogin = { email, mode: r.mode };
  return { email, players, canAdopt: Game.guestHasProgress() };
}
// "להחליף שחקנית" כשכבר מחוברים במייל: אותה בחירה, בלי להתנתק
function currentPlayers() {
  const email = Cloud.accountEmail();
  if (!email) return null;
  if (!saveLocked && !Game.visiting) saveAll();
  pendingLogin = { email, mode: Cloud.loggedIn() ? 'cloud' : 'local' };
  return { email, players: Game.players(email), canAdopt: false, current: Game.playerId() };
}
// סיום: choice = { pid } לשחקנית קיימת, או { newName, adopt } לשחקנית חדשה
async function finishLogin(choice) {
  const p = pendingLogin; pendingLogin = null;
  if (!p) return;
  saveLocked = true;
  let pid = choice && choice.pid;
  if (!pid) {
    const name = String((choice && choice.newName) || '').trim();
    pid = Game.addPlayer(p.email, name);
    if (choice && choice.adopt) {
      const adopted = Game.adoptGuestInto(p.email, pid);
      if (adopted && pid === 'main' && p.mode === 'cloud' && Cloud.userId) { Cloud.bindSaves(Cloud.userId); Cloud.push(adopted); await withTimeout(Cloud.flush(), 4000, null); }
    }
    try { if (name) localStorage.setItem(PENDING_NAME_KEY, name); else localStorage.removeItem(PENDING_NAME_KEY); } catch (e) {}
  } else {
    try { localStorage.removeItem(PENDING_NAME_KEY); } catch (e) {}
  }
  Game.setActivePlayer(p.email, pid);
  try { localStorage.removeItem(GUEST_KEY); } catch (e) {}
}

// יציאה מחשבון: שמירה אחרונה לחשבון היוצא, עצירת שמירות, ניקוי ה-session, וחזרה לשער.
async function logoutToGate() {
  if (!Game.visiting && !saveLocked) saveAll();
  saveLocked = true;
  await withTimeout(Cloud.flush(), 3000, null);
  await Cloud.signOut();
  try { localStorage.removeItem(GUEST_KEY); } catch (e) {}   // אחרי יציאה מראים את השער, לא נכנסים אוטומטית לאורחת
  location.replace(location.pathname);
}

// ---------- אתחול ----------
Audio.init();
const canvas = document.getElementById('scene');
World.init(canvas);

UI.init({
  onStart: startGame,
  onAction: handleAction,
  onOpenShop: openShop,
  onBuyHorse: buyHorse,
  onShopBuy: shopBuy,
  onBuyField: buyField,
  onBuyExpansion: buyExpansion,
  onBuyAnimal: buyAnimal,
  onBuyUpgrade: buyUpgrade,
  onDress: handleDress,
  onPaint: handlePaint,
  onSettings: applySettings,
  onReset: resetGame,
  onSpin: () => {
    if (Game.visiting) { visitBlock(); return { ok: false }; }
    if (!Game.canSpin(today())) return { ok: false };
    const prize = Game.doSpin(today());
    UI.updateHUD(Game); saveAll();
    return { ok: true, prize };
  },
  onRace: () => openTrack(),
  onRide: (horse) => openTrack(horse),
  onHorseBirth: (horse) => horseBirth(horse),
  onStory: () => Story.open(),
  getSellables: () => sellables(),
  onSell: (it) => sellItem(it),
  onDelivery: () => Mini.delivery.start(),
  onContest: () => Mini.contest.open(),
  onPhoto: () => Mini.photo.take(),
  onArrange: () => toggleArrange(),
  // 🏠 = תמיד הביתה לחווה: יוצאים ממבנה/מסלול, נוסעים לחווה, ומחזירים את המצלמה למבט הפתיחה
  onHome: () => {
    if (Interiors.active) Interiors.exit();
    if (Track3D.active) Track3D.stop();
    if (currentArea !== 'farm') travelToArea('farm');
    const farm = AREAS.find(x => x.id === 'farm');
    if (farm) World.travelTo(farm.x, farm.z, 22, true);
  },
  onMap: () => UI.openMap(AREAS, currentArea, travelToArea, {
    canVisit: Cloud.loggedIn(),
    loadFarms: () => Cloud.listFarms(),
    onVisit: (f) => { location.href = location.pathname + '?visit=' + encodeURIComponent(f.user_id) + '&name=' + encodeURIComponent(f.name); }
  }),
  onJournal: () => UI.openJournal(AREAS, Game),
  onFriends: async () => {
    const farms = await Cloud.listFarms();
    UI.openFriends(farms, (f) => {
      location.href = location.pathname + '?visit=' + encodeURIComponent(f.user_id) + '&name=' + encodeURIComponent(f.name);
    });
  },
  onAuth: {
    login: loginWithEmail,
    players: currentPlayers,
    finish: finishLogin,
    signOut: logoutToGate
  },
  onGuest: enterGuest,
  onSwitchPlayer: switchPlayer,
  onWake: () => Bedtime.wake(),
  getGame: () => Game
});

// --- מצב אורח: משחק מקומי בלי חשבון (שמירה ב-localStorage בלבד, בלי ענן) ---
const GUEST_KEY = 'agam_guest';
function enterGuest() {
  try { localStorage.setItem(GUEST_KEY, '1'); } catch (e) {}
  // החווה שמאחורי השער כבר נבנתה ממגירת האורחת (ב-boot), אז אפשר להיכנס ישר
  if (Cloud.accountEmail() || Game.namespace() !== 'guest') { location.replace(location.pathname); return; }
  const gate = document.getElementById('authScreen');
  if (gate) gate.classList.add('hidden');
  startGame();   // ישר למשחק — בלי עוד מסך פתיחה באמצע
}
// "להחליף שחקנית": מחוברת → יציאה לשער; אורחת → חזרה לשער (החווה שלה נשמרת במגירה שלה)
function switchPlayer() {
  if (Cloud.accountEmail()) {   // מחוברת במייל של הורה → בוחרות שחקנית אחרת מאותו מייל (יציאה מהחשבון בתוך הבחירה)
    const info = currentPlayers();
    document.getElementById('titleScreen').classList.add('hidden');
    if (UI.settingsOv) UI.settingsOv.classList.add('hidden');
    UI.showPlayerPicker(info);
    return;
  }
  if (!saveLocked) saveAll();
  try { localStorage.removeItem(GUEST_KEY); } catch (e) {}
  document.getElementById('titleScreen').classList.add('hidden');
  if (UI.settingsOv) UI.settingsOv.classList.add('hidden');
  UI.showAuthGate();
}

// אזור המכלאה — בו חיות המשק משוטטות
const PADDOCK = { x: 0, z: -7, r: 5 };

// --- עולם פתוח: אזורים שאפשר לנסוע אליהם ---
const AREAS = [
  { id: 'farm',     name: 'החווה', emoji: '🏡', x: 0,   z: 0,   unlock: 1 },
  { id: 'forest',   name: 'היער',  emoji: '🌲', x: 0,   z: -70, unlock: 1 },
  { id: 'lake',     name: 'האגם',  emoji: '🏖️', x: 70,  z: 6,   unlock: 1 },
  { id: 'village',  name: 'הכפר',  emoji: '🏘️', x: -72, z: 0,   unlock: 3 },
  { id: 'mountain', name: 'ההר',   emoji: '🏔️', x: 0,   z: 72,  unlock: 4 },
  { id: 'fair',     name: 'היריד', emoji: '🎪', x: 64,  z: -64, unlock: 5 },
  { id: 'track',    name: 'מסלול הרכיבה', emoji: '🏇', x: Track3D.center.x, z: Track3D.center.z, unlock: 1 }
];
// אזור שהסיפור כבר פתח נפתח גם אם הרמה עוד נמוכה — שפרק לא ייתקע על מנעול
function syncStoryUnlocks() { AREAS.forEach(a => { if (Story.opened(a.id)) a.unlock = 1; }); }
let currentArea = 'farm';
function travelToArea(id) {
  const a = AREAS.find(x => x.id === id);
  if (!a) return;
  if (Game.level < a.unlock) { UI.toast('🔒 ' + a.name + ' נפתח ברמה ' + a.unlock, true); Audio.wrong(); return; }
  currentArea = id;
  World.travelTo(a.x, a.z, id === 'track' ? 30 : 22);
  Game.visitArea(id);
  Story.event('visit_' + id);
  UI.setLocation(a.emoji, a.name);
  UI.setTip(a.emoji + ' ' + a.name);
  Audio.areaAmbient(id);
  Audio.speak('נוסעים ל' + a.name);
}
// תגמול עוטף פר-אזור — סופר פעילויות ונותן כוכב בונוס כל 3
function areaReward(id) {
  return (pos, res) => {
    grantReward(pos, res);
    Story.event('act_' + id);
    if (Game.recordActivity(id)) {
      World.spawnParticles(pos, 'star', 14);
      UI.toast('⭐ משימת אזור הושלמה! כוכב בונוס', true);
      Audio.fanfare();
    }
    UI.updateHUD(Game);
  };
}
// רושם sprite כפעילות שאפשר ללחוץ עליה (באזורים)
function registerActivity(sprite, fn) { sprite.userData.activity = fn; World.registerPickable(sprite); }
// אנימציות-אזור (נקראות בכל פריים) — לתנועה חיה בעולם
const areaUpdaters = [];
function registerUpdater(fn) { areaUpdaters.push(fn); }

// פריטים שנקנו והוצבו בחווה
let placedItems = [];          // נתוני שמירה {id,x,z}
const placedMeshes = [];       // אובייקטי תלת-ממד להסרה ב-reset
const movableSprites = [];     // ספרייטים שאפשר לגרור במצב עיצוב (רק פריטים שנקנו)
let barnSprite = null;         // רפרנס לאסם (להחלפה בשדרוג)

// בניית החווה מתוך נתוני שמירה (מקומי או ענן)
function buildFarm(saved) {
  placeDecor();
  applyExpansion(Game.expansion || 0);   // חווה מורחבת: גדר גדולה + תקרת-שדות + קרקע גינה מורחבת
  if (saved && saved.horses && saved.horses.length) {
    saved.horses.forEach(h => Horses.add(h));
  } else {
    Horses.add({ color: 'brown', stage: 'foal', name: 'כוכב' });
    Horses.add({ color: 'golden', stage: 'foal', name: 'דבש' });
  }
  if (saved && saved.fields && saved.fields.length) Fields.load(saved.fields, CROPS, nowMs());
  else Fields.ensure(3);
  if (saved && saved.placed) saved.placed.forEach(p => placeBought(p.id, p.x, p.z, false));
  if (saved && saved.animals) saved.animals.forEach(a => {
    const def = SHOP.animals.find(s => s.id === a.type);
    if (def) Animals.add({ id: a.id, type: a.type, asset: def.asset, scale: def.scale, produce: def.produce, region: PADDOCK, name: a.name, lastProduced: a.lastProduced,
      baby: a.baby, bornAt: a.bornAt, lastBirth: a.lastBirth, momId: a.momId });
  });
  spawnCritters();   // חיות נוף (לא נשמרות — תמיד מופיעות)
  // החלת שדרוגי אסם/חווה שנקנו
  const ups = Game.upgrades || {};
  Object.keys(ups).forEach(id => { if (ups[id]) applyUpgrade(id); });
  spawnRares();       // חיות נדירות שכבר נפתחו
  initMagicTree();    // עץ הקסם
  // אזורי העולם הפתוח (יער, אגם)
  const areaDeps = { THREE, World, decor, activity: registerActivity, onUpdate: registerUpdater, Animals, askProblem, spawnAt, grantReward, payout, saveAll, Game, UI, Audio, enter: enterBuilding };
  buildForest(Object.assign({}, areaDeps, { center: { x: 0, z: -70 }, grantReward: areaReward('forest') }));
  buildLake(Object.assign({}, areaDeps, { center: { x: 70, z: 6 }, grantReward: areaReward('lake') }));
  buildVillage(Object.assign({}, areaDeps, { center: { x: -72, z: 0 }, grantReward: areaReward('village') }));
  buildMountain(Object.assign({}, areaDeps, { center: { x: 0, z: 72 }, grantReward: areaReward('mountain') }));
  buildFair(Object.assign({}, areaDeps, { center: { x: 64, z: -64 }, grantReward: areaReward('fair') }));
  forestDensify();
  buildPaths();
  buildTrack();
  if (barnSprite) registerActivity(barnSprite, () => enterBuilding('barn'));   // נגיעה באסם = נכנסים פנימה
}

// ציפוף היער (היה דליל בחזית)
function forestDensify() {
  const c = { x: 0, z: -70 }, trees = ['assets/pine_tree.png', 'assets/oak_tree.png', 'assets/tree.png'];
  for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 10; decor(trees[i % 3], c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 6.5 + Math.random() * 2, true); }
  for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 11; decor('assets/bush.png', c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 2.2, true); }
  for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 13; decor('assets/flowers_wild.png', c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 1.4, true); }
}

// שבילי עפר שמחברים את החווה לכל אזור
function buildPaths() {
  const targets = [[0, -70], [70, 6], [-72, 0], [0, 72], [64, -64], [Track3D.center.x, Track3D.center.z]];
  targets.forEach(([tx, tz]) => {
    const steps = 11;
    for (let i = 2; i < steps; i++) { World.floorPatch(tx * i / steps, tz * i / steps, 5.5, 5.5, 0xc8a878); }
  });
}

// החלת שדרוג נראה על העולם
function applyUpgrade(id) {
  if (id === 'barn_big') {
    if (barnSprite) { World.unregisterPickable(barnSprite); World.scene.remove(barnSprite); barnSprite.material.dispose(); }
    barnSprite = decor('assets/barn_big.png', 0, -14, 11);
    registerActivity(barnSprite, () => enterBuilding('barn'));
  } else if (id === 'silo') {
    decor('assets/silo.png', -9.5, -13.5, 7);
  } else if (id === 'weathervane') {
    const v = World.makeBillboard('assets/weathervane.png', 3, true);
    v.center.set(0.5, 0.0); v.position.set(0, 7.2, -13.8);
    World.scene.add(v);
  }
}

// --- הרחבת שטח החווה: מגדילה גדר, תקרת-שדות וקרקע-גינה לפי רמת ההרחבה ---
let gardenExpandPatch = null;
function applyExpansion(level) {
  // תקרת שדות — לעולם לא מתחת למה שכבר קיים (שומר התקדמות)
  Fields.maxPlots = Math.max(Fields.plots ? Fields.plots.length : 0, Math.min(Fields.slotCap, 9 + level * 3));
  // גדר גדולה יותר (השטח גדל לעין)
  World.rebuildFence(15 + level * 4);
  // קרקע גינה מורחבת שתכסה את השורות החדשות (z עד 12.2)
  if (gardenExpandPatch) { World.scene.remove(gardenExpandPatch); if (gardenExpandPatch.material) gardenExpandPatch.material.dispose(); gardenExpandPatch = null; }
  if (level > 0) {
    const lastZ = [6.4, 9.3, 12.2][level] ?? 12.2;   // z של השורה האחרונה הפתוחה
    const z0 = -1.4, z1 = lastZ + 1.6;
    gardenExpandPatch = World.floorPatch(-7.5, (z0 + z1) / 2, 10, (z1 - z0), 0x8a5a2e);
  }
}

const withTimeout = (p, ms, fallback) => Promise.race([p, new Promise(r => setTimeout(() => r(fallback), ms))]);
const readyUI = () => { try { window.hideLoader && window.hideLoader(); } catch (e) {} };

async function boot() {
  Game.migrateLegacy();                            // מפתח-שמירה ישן אחד לכולם → מגירה לכל שחקנית
  await withTimeout(Cloud.init(), 4500, false);   // לא נתקע אם אין רשת
  // יש session שמור במכשיר אבל הספרייה עוד לא סיימה לעלות → מחכים עוד קצת, כדי לא להציג
  // לשחקנית מחוברת את השער או את חוות האורחת
  if (!Cloud.email() && Cloud.storedSessionEmail()) await withTimeout(Cloud.init(), 12000, false);
  let saved = null;

  // ---------- מצב ביקור: צופים בחווה של חברה (קריאה בלבד) ----------
  if (VISIT) {
    if (Cloud.loggedIn()) {
      const friendData = await withTimeout(Cloud.pullUser(VISIT.id), 6000, null);
      if (friendData) {
        Game.applyData(friendData);
        Game.visiting = VISIT.name;
        buildFarm(friendData);
        applySettings();
        UI.startVisit(VISIT.name, Game);
        readyUI();
        return;
      }
    }
    // לא מחוברת / החווה לא נמצאה — חוזרים הביתה נקי
    location.replace(location.pathname);
    return;
  }

  // ---------- של מי החווה? ----------
  // חשבון (מייל של הורה) → המגירה של המייל הזה + הענן שלו אם יש session. אחרת → מגירת האורחת.
  let acctEmail = Cloud.accountEmail();
  const sessionMatches = () => Cloud.ready && Cloud.loggedIn() && (Cloud.email() || '').toLowerCase() === acctEmail;
  let cloudSession = sessionMatches();
  // חשבון מקומי וענן זמין → מנסים בשקט לחבר לענן (למשל אחרי שפונקציית הכניסה נפרסה)
  if (acctEmail && !cloudSession && Cloud.ready) {
    try { await withTimeout(Cloud.loginEmail(acctEmail), 4000, null); } catch (e) {}
    cloudSession = sessionMatches();
  }
  let needPick = false;
  if (acctEmail) {
    // מי משחקת? השחקנית שנבחרה אחרונה במכשיר; אם יש רק אחת — היא. אחרת → מסך בחירה.
    const players = Game.players(acctEmail);
    let pid = Game.activePlayer(acctEmail);
    if (!players.some(p => p.id === pid)) pid = players.length === 1 ? players[0].id : null;
    needPick = !pid;
  }
  if (acctEmail && needPick) {
    // חווה ריקה שלא נשמרת לשום מגירה, רק כרקע למסך הבחירה
    Game._ns = null; Game.reset(); Cloud.bindSaves(null);
  } else if (acctEmail) {
    const pid = Game.players(acctEmail).some(p => p.id === Game.activePlayer(acctEmail)) ? Game.activePlayer(acctEmail) : Game.players(acctEmail)[0].id;
    const cloudMain = cloudSession && pid === 'main';   // הענן שומר חווה אחת לחשבון — של השחקנית הראשונה
    Game.useEmail(acctEmail, cloudMain ? Cloud.userId : null, pid);
    const localData = Game.load();
    let cloudData = null;
    if (cloudMain) {
      cloudData = await withTimeout(Cloud.pull(), 4000, null);
      Cloud.bindSaves(Cloud.userId);                   // מכאן מותר לדחוף לענן — רק לחשבון הזה
    } else Cloud.bindSaves(null);
    if (cloudData && (!localData || (cloudData.savedAt || 0) >= (localData.savedAt || 0))) {
      Game.applyData(cloudData); saved = cloudData;    // הענן עדכני יותר (שיחקה במכשיר אחר)
    } else if (localData) {
      saved = localData;
    } else {
      Game.reset();                                    // שחקנית בלי חווה בכלל → חווה חדשה
    }
    if (cloudMain) await withTimeout(Cloud.fetchProfile(), 3000, null);
    let pendingName = null;
    try { pendingName = localStorage.getItem(PENDING_NAME_KEY); localStorage.removeItem(PENDING_NAME_KEY); } catch (e) {}
    const listed = (Game.players(acctEmail).find(p => p.id === pid) || {}).name;
    if (pendingName) Game.name = pendingName;
    else if (listed) Game.name = listed;
    else if (!Game.name && cloudMain && Cloud.profileName()) Game.name = Cloud.profileName();
    if (cloudMain && Game.name && Cloud.profileName() !== Game.name) await withTimeout(Cloud.saveProfile(Game.name, Game.level), 3000, null);
    Game.setActivePlayer(acctEmail, pid);
    if (Game.name && listed !== Game.name) Game.renamePlayer(acctEmail, pid, Game.name);
    Game.save(); if (cloudMain) Cloud.push(Game.lastData());
  } else {
    Game.useGuest();
    Cloud.bindSaves(null);                             // אורחת = מקומי בלבד, בלי ענן
    saved = Game.load();
    if (!saved) Game.reset();
  }
  buildFarm(saved);
  applySettings();
  saveLocked = needPick;   // החווה הנכונה בנויה — מעכשיו שומרים (למגירה שלה בלבד). במסך בחירה — עוד לא
  if (needPick) {          // מחוברת במייל אבל עוד לא בחרה מי משחקת
    pendingLogin = { email: acctEmail, mode: cloudSession ? 'cloud' : 'local' };
    UI.showPlayerPicker({ email: acctEmail, players: Game.players(acctEmail), canAdopt: Game.guestHasProgress() });
    readyUI();
    return;
  }

  // ---------- שער כניסה: אונליין בלי חשבון → בחירה: לשחק כאורחת או להיכנס לחשבון ----------
  // אלא אם בחרו כבר לשחק כאורחת — אז ממשיכים למשחק מקומי בלי לחסום שוב.
  if (!acctEmail) {
    let guest = false;
    try { guest = localStorage.getItem(GUEST_KEY) === '1'; } catch (e) {}
    if (!guest) {
      UI.showAuthGate();
      readyUI();
      return;
    }
  }
  // מחוברת אבל בלי שם (חשבון ותיק) — שואלים פעם אחת ושומרים פרופיל
  if (acctEmail && !Game.name) {
    UI.askPlayerName(async (name) => {
      Game.name = name; Game.save(); saveAll();
      Game.renamePlayer(acctEmail, Game.playerId(), name);
      if (cloudSession && Game.playerId() === 'main') await Cloud.saveProfile(name, Game.level);
      UI.showTitle();
    });
    readyUI();
    return;
  }
  UI.showTitle();
  readyUI();
}
boot();

function saveAll() {
  if (Game.visiting) return;   // אצל חברה לא שומרים כלום
  if (saveLocked || !Game.namespace()) return;   // לפני שהחווה נבנתה / באמצע החלפת חשבון
  Game.save({ horses: Horses.toJSON(), fields: Fields.toJSON(), placed: placedItems, animals: Animals.toJSON() });
  Cloud.push(Game.lastData());
}

// חיות נוף שמשוטטות לחיוּת (ללא אינטראקציה)
function spawnCritters() {
  Animals.add({ type: 'dog', asset: 'dog.png', scale: 1.5, region: { x: -2, z: -9, r: 3 } });
  Animals.add({ type: 'cat', asset: 'cat.png', scale: 1.2, region: { x: 4, z: -9.5, r: 2.5 } });
  Animals.add({ type: 'duck', asset: 'duck.png', scale: 1.0, region: { x: -16, z: 7, r: 2.5 } });
  Animals.add({ type: 'duck', asset: 'duck.png', scale: 1.0, region: { x: -16, z: 7, r: 2.5 } });
  Animals.add({ type: 'rabbit', asset: 'rabbit.png', scale: 1.0, region: { x: -9, z: 4, r: 3 } });
  Animals.add({ type: 'rabbit', asset: 'rabbit.png', scale: 1.0, region: { x: -8, z: 6, r: 2.5 } });
  Animals.add({ type: 'pony', asset: 'pony.png', scale: 1.7, region: { x: -5, z: 5, r: 3 } });
}

// ---------- תפאורה קבועה ----------
// כשמצב עיצוב פעיל (_decorMovable) קישוטי-החווה הקבועים ניתנים לגרירה + נשמרים
// לפי decorId יציב (סדר יצירה). מיקום מותאם מ-Game.decorPos גובר על ברירת המחדל.
let _decorId = 0;
let _decorMovable = false;
function decor(url, x, z, height, withShadow = true) {
  let id = null;
  if (_decorMovable) {
    id = 'd' + (_decorId++);
    const ov = (Game.decorPos || {})[id];
    if (ov) { x = ov.x; z = ov.z; }
  }
  const sp = World.makeBillboard(url, height, true);
  sp.position.set(x, 0, z);
  World.scene.add(sp);
  // תפאורה אורגנית מנדנדת ברוח (עצים/שיחים/פרחים/גידולים/דחליל)
  if (/(tree|bush|flower|wheat|corn|pine|oak|grass|mushroom|scarecrow)/i.test(url)) World.addSway(sp);
  let sh = null;
  if (withShadow) {
    sh = World.makeGroundShadow(height * 0.3);
    sh.position.set(x, 0.04, z);
    World.scene.add(sh);
  }
  if (id) { sp.userData.decorId = id; sp.userData.placedShadow = sh; movableSprites.push(sp); }
  return sp;
}

// פיזור עצמים בטבעת רדיוס (מחוץ לאזור המשחק)
function scatter(urls, count, minR, maxR, h, hVar, withShadow) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const url = Array.isArray(urls) ? urls[Math.floor(Math.random() * urls.length)] : urls;
    const hh = h + (hVar ? (Math.random() * 2 - 1) * hVar : 0);
    decor(url, Math.cos(a) * r, Math.sin(a) * r, hh, !!withShadow);
  }
}

// --- גבולות אזורים (גיאומטריה) ---
function lowPosts(points, color, h, wdt) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  for (const [x, z] of points) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(wdt, h, wdt), mat);
    p.position.set(x, h / 2, z); p.castShadow = true;
    World.scene.add(p);
  }
}
function railLine(x1, z1, x2, z2, y, color, thick = 0.1) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, thick, thick),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  rail.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  rail.rotation.y = Math.atan2(-(z2 - z1), (x2 - x1));
  World.scene.add(rail);
}
function gardenBorder(x1, x2, z1, z2) {
  const col = 0xf2ead6, step = 1.5, pts = [];
  for (let x = x1; x <= x2 + 0.01; x += step) { pts.push([x, z1]); pts.push([x, z2]); }
  for (let z = z1 + step; z < z2 - 0.01; z += step) { pts.push([x1, z]); pts.push([x2, z]); }
  lowPosts(pts, col, 0.85, 0.14);
  railLine(x1, z1, x2, z1, 0.65, col); railLine(x1, z2, x2, z2, 0.65, col);
  railLine(x1, z1, x1, z2, 0.65, col); railLine(x2, z1, x2, z2, 0.65, col);
}
function arenaRail(cx, cz, rx, rz) {
  const N = 18, col = 0xfafafa, pts = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); }
  lowPosts(pts, col, 1.0, 0.12);
  for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 1) % N]; railLine(a[0], a[1], b[0], b[1], 0.75, col, 0.08); }
}

// --- שלושת אזורי החווה ---
function placeZones() {
  // 🥕 גינת הירק (חזית-שמאל)
  World.floorPatch(-7.5, 3.5, 10, 11.5, 0x8a5a2e);
  gardenBorder(-11.8, -3.2, -1.4, 8.4);
  decor('assets/scarecrow.png', -11.6, 4.2, 3.4);
  decor('assets/watering_can.png', -3.7, 0.6, 1.7, false);
  const s1 = World.makeSign('🥕 גינת הירק'); s1.position.set(-7.5, 0, -2.0); World.scene.add(s1);

  // 🐴 מגרש רכיבה (חזית-ימין)
  World.floorPatch(7.5, 1.5, 12, 11, 0xd8bf8e);
  arenaRail(7.5, 1.5, 5.9, 5.2);
  decor('assets/horse_jump.png', 6, 0.5, 2.6, false);
  decor('assets/horse_jump.png', 9.5, 3.5, 2.6, false);
  decor('assets/cone.png', 4.6, 4.2, 1.0, false);
  decor('assets/cone.png', 10.6, -1, 1.0, false);
  const s2 = World.makeSign('🐴 מגרש רכיבה'); s2.position.set(7.5, 0, -3.8); World.scene.add(s2);

  // 🏠 המכלאה / חצר האורווה (ליד האסם)
  decor('assets/trough.png', 3, -10, 2.2);
  decor('assets/well.png', -7.5, -10.5, 3.0);
  const s3 = World.makeSign('🏠 המכלאה'); s3.position.set(-1.5, 0, -8.2); World.scene.add(s3);
}

function placeDecor() {
  // קישוטי-החווה הנקובים — ניתנים לגרירה במצב עיצוב (barn, pond, windmill...)
  _decorMovable = true;
  // נוף חתימה סביב הפסטורה
  barnSprite = decor('assets/barn.png', 0, -13.8, 9);
  decor('assets/pond.png', -17, 7, 3, false);
  decor('assets/windmill.png', 18, -7, 6.5);
  decor('assets/fountain.png', 15, 11, 3.6);
  decor('assets/hay_bale.png', -6, -11.5, 2.4);
  decor('assets/feed_sack.png', 6, -11.8, 2.2);
  decor('assets/water_bucket.png', -3.5, -10.8, 1.8, false);
  decor('assets/farm_gate.png', 0, 14.8, 5.5);
  decor('assets/doghouse.png', -5, -10.8, 1.9, false);
  placeZones();
  _decorMovable = false;   // מכאן והלאה — רקע פזור (לא נגרר, לא נשמר)
  // יער מסביב
  scatter(['assets/tree.png', 'assets/pine_tree.png', 'assets/oak_tree.png'], 26, 17, 29, 7.5, 1.5, true);
  // שיחים, סלעים
  scatter('assets/bush.png', 14, 15.5, 30, 2.4, 0.6, false);
  scatter('assets/rock.png', 10, 16, 28, 1.7, 0.5, false);
  // פרחי בר ודשא — בחוץ וגם בפנים ליד הגדר
  scatter('assets/flowers_wild.png', 34, 13.5, 30, 1.5, 0.4, false);
  scatter('assets/flowers_wild.png', 10, 10.5, 13.3, 1.4, 0.3, false);
  scatter('assets/grass_tuft.png', 36, 13, 31, 1.1, 0.3, false);
  // עננים
  for (let i = 0; i < 9; i++) {
    const cl = World.makeBillboard('assets/cloud.png', 6 + Math.random() * 4, true);
    cl.center.set(0.5, 0.5);
    cl.position.set(-55 + Math.random() * 110, 22 + Math.random() * 12, -45 + Math.random() * 35);
    World.addCloud(cl);
  }
}

// ---------- הצבת פריטים שנקנו ----------
// מיקומי הצבה — כולם בטבעת בין רדיוס 12.5 ל-14.3: בתוך הגדר (R=15), מחוץ לאזור הילוך הסוסים (R=12)
const PLACE_SLOTS = [
  [-12.5, 0], [12.5, 0], [-12, 4], [12, 4], [-12, -4], [12, -4],
  [-11, 7], [11, 7], [-9, -9], [9, -9], [-12.5, -7], [12.5, -7],
  [-7, 10.5], [7, 10.5], [-11, 9], [11, 9]
];
function shopItemById(id) { return SHOP.decor.concat(SHOP.equipment).find(i => i.id === id); }
function nextSlot() {
  if (placedItems.length < PLACE_SLOTS.length) return PLACE_SLOTS[placedItems.length];
  const a = Math.random() * Math.PI * 2, r = 12.5 + Math.random() * 1.5;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
function placeBought(id, x, z, save) {
  const it = shopItemById(id);
  const h = it ? it.h : 2.5;
  const asset = it ? it.asset : (id + '.png');
  const sp = World.makeBillboard('assets/' + asset, h, true);
  sp.position.set(x, 0, z);
  const sh = World.makeGroundShadow(h * 0.3);
  sh.position.set(x, 0.04, z);
  World.scene.add(sp); World.scene.add(sh);
  placedMeshes.push(sp, sh);
  // רשומת-שמירה מקושרת לספרייט → גרירה במצב עיצוב מעדכנת אותה ישירות
  const rec = { id, x, z };
  placedItems.push(rec);
  sp.userData.placedRec = rec;
  sp.userData.placedShadow = sh;
  movableSprites.push(sp);
  if (save) saveAll();
  return sp;
}

// ---------- מסכים / הגדרות ----------
function startGame() {
  Game.ensureQuests(today());
  Game.visitArea('farm');
  UI.showGame();
  UI.updateHUD(Game);
  UI.setLocation('🏡', 'החווה');
  if (Game.settings.music) { Audio.musicOn = true; Audio.startMusic(); }
  UI.setTip('👆 געי בסוס או בשדה · 🛒 לחנות');
  syncStoryUnlocks();
  Story.refresh(); Story.show(true);
  storyAutoSkip();
  Tutorial.start();
  Bedtime.start();
  // בוקר חדש קודם (מתנת בוקר), ואחריו הסיפור. שחקנית ותיקה שעוד לא ראתה את הפרק — רותי מספרת עליו
  if (!Morning.maybe() && Game.tutorialDone && !Game.story.seen) setTimeout(() => { if (!document.querySelector('.overlay:not(.hidden)')) Story.open(); }, 1500);
}

// משהו פתוח עכשיו (חלון, תרגיל, רכיבה, מבנה) — לא קופצים באמצע
function busyNow() {
  return !!document.querySelector('.overlay:not(.hidden)') || UI._mathOpen || Transfer3D.active || Track3D.active || Interiors.active || arrangeMode;
}
const FARM_POS = { x: 0, y: 1, z: 0 };
const nightPlots = (state) => Fields.plots.filter(p => p.state === state && CROPS[p.cropKey] && CROPS[p.cropKey].overnight).length;

// ---------- בוקר טוב, חווה: מתנת פתיחה יומית אחרי תרגיל אחד ----------
// אין רצף שנשבר: יום שפספסו פשוט לא קיים. ביטול (✖ או "אחר כך") = המתנה מחכה לפעם הבאה שנכנסים.
const Morning = {
  maybe() {
    if (Game.visiting || !Game.tutorialDone || Game.morningDate === today()) return false;
    let tries = 0;
    const open = () => {
      if (busyNow()) { if (++tries < 15) setTimeout(open, 4000); return; }
      UI.morningCard({ ready: nightPlots('ready') }, () => this.solve(), () => this.after());
    };
    setTimeout(open, 1200);
    return true;
  },
  solve() {
    askProblem('morning', (res) => {
      Game.morningDate = today();
      const gain = Game.pay(Game.MORNING_COINS, res);
      World.spawnParticles(FARM_POS, 'coin', 12);
      Audio.coin(); Audio.fanfare();
      UI.toast('🎁 מתנת בוקר! +' + gain + ' 🪙', true);
      grantReward(FARM_POS, res, NO_COINS);
      saveAll();
      this.after();
    });
  },
  after() { if (!Game.story.seen) setTimeout(() => { if (!busyNow()) Story.open(); }, 2500); }
};

// ---------- סוף משחק מתוכנן: אחרי זמן המשחק (הגדרת הורים, ברירת מחדל 20 דק') החווה הולכת לישון ----------
// לא קופץ באמצע תרגיל. "עוד 5 דקות" פעם אחת. אחרי "לילה טוב" רק הורה ממשיך מהמסך.
const Bedtime = {
  startedAt: 0, solvedAt: 0, extended: false, shown: false, _t: null,
  start() {
    this.startedAt = nowMs(); this.solvedAt = Game.solved; this.extended = false; this.shown = false;
    clearInterval(this._t); this._t = setInterval(() => this.check(), 15000);
  },
  limitMs() { const m = Game.settings.sessionMin ?? 20; return m > 0 ? m * 60000 : 0; },
  check() {
    const lim = this.limitMs();
    if (this.shown || Game.visiting || !lim || nowMs() - this.startedAt < lim || busyNow()) return;
    this.shown = true;
    const info = { solved: Game.solved - this.solvedAt, night: nightPlots('growing') };
    UI.bedtime(info, () => this.sleep(), this.extended ? null : () => this.more());
  },
  more() { this.extended = true; this.shown = false; this.startedAt = nowMs() - this.limitMs() + 5 * 60000; },
  sleep() { saveAll(); Audio.stopMusic(); },
  wake() {   // הורה בחר להמשיך: סבב משחק חדש מלא
    this.start();
    if (Game.settings.music) { Audio.musicOn = true; Audio.startMusic(); }
  }
};

// ---------- 60 השניות הראשונות: הדרכה קולית בלי קריאה ----------
// סוס → האכלה (משימת גזרים) → שדה → שתילה. כל שלב מחכה לילדה, אין שעון.
const Tutorial = {
  step: null, _timer: null,
  start() {
    if (Game.tutorialDone || Game.visiting || !Horses.list.length) return;
    this.step = 'horse';
    const h = Horses.list[0];
    World.travelTo(h.group.position.x, h.group.position.z, 16);
    UI.setTip('👇 געי ב' + h.name);
    // מדברים מיד, בתוך הנגיעה על "בואי נשחק" — באייפון דיבור שמגיע באיחור בלי נגיעה נחסם
    Audio.speak('בואי נכיר את ' + h.name + '. געי ב' + h.name);
    this._point(() => h.group.position);
  },
  // חץ קופץ מעל היעד כל שתי שניות וחצי, עד שהשלב מתקדם
  _point(getPos) {
    clearInterval(this._timer);
    const show = () => { const p = getPos(); if (p) World.showAction({ x: p.x, y: p.y || 0, z: p.z }, '👇'); };
    show(); this._timer = setInterval(show, 2500);
  },
  horseOpened(horse) {
    if (this.step !== 'horse') return;
    this.step = 'feed';
    clearInterval(this._timer);
    UI.pulse('#horseCard [data-act="feed"]');
    Audio.speak(horse.name + ' רעב. געי בגזר ונאכיל אותו');
  },
  fed() {
    if (this.step !== 'feed') return;
    const plot = Fields.freePlot();
    if (!plot) { this.finish(); return; }
    this.step = 'plant';
    World.travelTo(plot.pos.x, plot.pos.z, 16);   // השדה יוצא מהמסגרת כשהמצלמה על הסוס
    UI.setTip('👇 געי בשדה');
    setTimeout(() => Audio.speak('איזה כיף, הוא שבע! עכשיו נשתול. געי בשדה'), 1400);
    this._point(() => plot.state === 'empty' ? plot.pos : null);
  },
  planted() { if (this.step === 'plant') this.finish(); },
  finish() {
    clearInterval(this._timer); this.step = null;
    Game.tutorialDone = true; saveAll();
    UI.setTip('👆 געי בסוס או בשדה · 🛒 לחנות');
    setTimeout(() => Audio.speak('מעולה! עכשיו זו החווה שלך. אפשר לטפל בסוסים, לשתול, ולקנות בחנות'), 1600);
    setTimeout(() => { if (!document.querySelector('.overlay:not(.hidden)')) Story.open(); }, 7000);   // ואז מתחיל הסיפור
  }
};

// מעדכן התקדמות משימה ומתריע על השלמה
function questBump(action) {
  Story.event(action);
  const done = Game.bumpQuest(action);
  done.forEach(q => { UI.toast('✅ משימה הושלמה! +' + q.reward + ' 🪙', true); Audio.fanfare(); Audio.speak('גם משימת היום הושלמה!', { queue: true }); });
  if (done.length) UI.updateHUD(Game);
}

function applySettings() {
  Audio.sfxOn = Game.settings.sound;
  Audio.voiceOn = Game.settings.voice;
  World.setDayNight(Game.settings.daynight !== false);
  const inGame = document.getElementById('titleScreen').classList.contains('hidden');
  if (Game.settings.music && inGame) { Audio.musicOn = true; Audio.startMusic(); }
  else Audio.stopMusic();
  saveAll();
}

// ---------- תגמול משותף ----------
// opts.coins === false: התרגיל היה שער לקנייה/מכירה/שתילה — XP בלבד.
// אחרי טעות/פיגום: בלי מטבעות, ושבח רך במקום ("יופי שתיקנת").
function grantReward(pos, res, opts) {
  const firstTry = !res || res.firstTry !== false;
  World.spawnParticles(pos, 'heart', 8);
  const r = Game.onCorrect(firstTry, opts || {});
  if (r.coins) { World.spawnParticles(pos, 'coin', 6); Audio.coin(); }
  if (firstTry) Audio.praise();
  else Audio.speak('יופי שתיקנת! כשעונים נכון בפעם הראשונה מקבלים הכי הרבה מטבעות', { queue: true });
  UI.updateHUD(Game);
  if (r.leveledUp) { World.spawnParticles(pos, 'star', 16); UI.levelUp(Game.level); checkRareUnlocks(); }
  return r.coins;
}
const NO_COINS = { coins: false };
// תשלום לאזורים: בסיס הפעילות → סכום מאוזן, מלא רק בניסיון ראשון
const payout = (base, res) => Game.pay(Game.activityGain(base), res);

// פותח תרגיל עם קושי מותאם (35% מהזמן מחזק את הסוג החלש), ומתעד את התוצאה
// task: {who, item, itemName, box, verb} — כשניתן, החשבון הוא הפעולה עצמה (משימת העברה).
// 25% מהזמן, או כשמחזקים סוג חלש, נשאר תרגיל רגיל — כדי לא לאבד תרגול חיבור/חיסור.
function askProblem(actionType, onCorrect, harder, task) {
  if (Game.visiting) { visitBlock(); return; }
  const focus = Math.random() < 0.35 ? Game.weakType() : null;
  if (task && !focus && (!Game.tutorialDone || Math.random() < 0.75)) {
    const t = Object.assign(makeTransferTask(Game.difficulty() + (harder ? 1 : 0)), task);
    const done = (res) => {
      if (res.correct) { Game.recordResult(t.type, res.firstTry); questBump('solve'); onCorrect(res); }
    };
    // האכלה ושתילה: החשבון קורה בתוך החווה (גזרים לשוקת, שתילים לערוגה). אחרת — החלון הרגיל
    if (Transfer3D.canRun(t)) Transfer3D.start(t, { horse: t.horse, plot: t.plot }, done);
    else UI.askTransfer(t, actionType, done);
    return;
  }
  const problem = generateProblem(Game.difficulty() + (harder ? 1 : 0), focus);
  UI.askMath(problem, actionType, (res) => {
    if (res.correct) { Game.recordResult(problem.type, res.firstTry); questBump('solve'); onCorrect(res); }
    else if (!res.cancelled) Game.onWrong();
  });
}

// ---------- טיפול בסוס ----------
// סייח גדל אחרי 3 ארוחות + לחיצה על "לגדול" — אומרים לה בקול כמה נשאר, כדי שהדרך לגדילה תהיה ברורה
const FOAL_FEEDS = 3;
const TIMES = ['', 'עוד פעם אחת', 'עוד פעמיים', 'עוד שלוש פעמים'];
function foalHint(h) {
  const left = Math.max(0, FOAL_FEEDS - h.feedCount);
  return left ? 'האכילי את ' + h.name + ' ' + TIMES[left] + ', ואז אפשר לגדל אותו'
              : h.name + ' מוכן לגדול! געי בו ולחצי לגדול';
}
function foalProgressSay(h) {
  const left = Math.max(0, FOAL_FEEDS - h.feedCount);
  UI.toast(left ? '🍼 ' + h.name + ': עוד ' + left + ' 🥕 ואז לגדול' : '🌱 ' + h.name + ' מוכן לגדול!', true);
  Audio.speak(foalHint(h), { queue: true });
}
function handleAction(type, horse) {
  UI.closeHorseCard();
  const task = type === 'feed'
    ? { who: { name: horse.name, img: horse._tex() }, horse, item: '🥕', itemName: 'גזרים', box: 'שוקת', verb: 'תני ל' + horse.name }
    : null;
  askProblem(type, (res) => {
    if (type === 'feed') { horse.hunger = 100; horse.feedCount++; }
    else if (type === 'brush') { horse.clean = 100; }
    else if (type === 'play') { horse.happy = 100; }
    else if (type === 'grow') {
      if (horse.grow()) { UI.toast('🎉 ' + horse.name + ' גדל/ה!', true); Audio.fanfare(); }
    }
    horse.celebrate();
    if (type === 'feed') horse.eat();
    const fx = { feed: 'apple', brush: 'bubble', play: 'ball', grow: 'sparkle' }[type] || 'heart';
    // פידבק ויזואלי מומחש — אמוji ענק של הפעולה קופץ ליד הסוס
    const bigIcon = { feed: '🥕', brush: '🧼', play: '🎾', grow: '🌟' }[type] || '❤️';
    World.showAction(horse.group.position.clone(), bigIcon);
    World.spawnParticles(horse.group.position.clone(), fx, 12);
    questBump(type);
    const got = grantReward(horse.group.position.clone(), res);
    UI.toast(got ? '+' + got + ' 🪙' : '✔ יופי!', false);
    saveAll();
    if (type === 'feed') Tutorial.fed();
    if (type === 'feed' && horse.stage === 'foal') foalProgressSay(horse);
    // לא פותחים שוב את כרטיס הסוס: הוא הסתיר את התגובה של הסוס, שהיא הפרס האמיתי. נגיעה בסוס פותחת אותו מחדש
  }, type === 'grow', task);
}

// ---------- חנות ----------
// במצב ביקור — רק מסתכלים ומטיילים
function visitBlock() {
  UI.toast('👀 זו החווה של ' + Game.visiting + ' — מסתכלים ומטיילים בלבד', true);
  Audio.speak('זו החווה של ' + Game.visiting + '. אפשר להסתכל ולטייל');
}

function openShop() {
  if (Game.visiting) { visitBlock(); return; }
  UI.openShop(Game, { horses: Horses.list.length, fields: Fields.count(), maxFields: Fields.maxPlots });
}

function shopBuy(item, cat) {
  if (!Game.canAfford(item.cost)) { notEnough(item.cost); return; }
  askProblem('buy', (res) => {
    if (!Game.spend(item.cost)) return;
    const [x, z] = nextSlot();
    placeBought(item.id, x, z, true);
    spawnAt(x, z, 'confetti', 16);
    Audio.fanfare(); Audio.speak('קנית ' + item.name);
    UI.toast('✨ קנית ' + item.name + '!', true);
    Story.event('buy_decor');
    grantReward({ x, y: 1, z }, res, NO_COINS);
    saveAll();
  });
}

function buyField() {
  if (!Fields.canExpand()) { UI.toast('🎉 יש לך את כל השדות!', true); return; }
  const cost = Game.fieldCost(Fields.count());
  if (!Game.canAfford(cost)) { notEnough(cost); return; }
  askProblem('field', (res) => {
    if (!Game.spend(cost)) return;
    Fields.ensure(Fields.count() + 1);
    const p = Fields.plots[Fields.plots.length - 1];
    spawnAt(p.pos.x, p.pos.z, 'star', 16);
    Audio.fanfare(); Audio.speak('שדה חדש! עכשיו אפשר לשתול עוד');
    UI.toast('🟫 שדה חדש נפתח!', true);
    grantReward({ x: p.pos.x, y: 1, z: p.pos.z }, res, NO_COINS);
    saveAll();
  });
}

// הרחבת שטח החווה בכסף — גדר גדלה + עוד חלקות שדה
function buyExpansion() {
  if (!Game.canExpandFarm()) { UI.toast('🎉 החווה שלך בגודל המקסימלי!', true); return; }
  const cost = Game.expansionCost();
  if (!Game.canAfford(cost)) { notEnough(cost); return; }
  askProblem('buy', (res) => {
    if (!Game.expandFarm()) return;
    applyExpansion(Game.expansion);
    spawnAt(0, 10, 'star', 20);
    Audio.fanfare(); Audio.speak('החווה שלך גדלה! עכשיו יש יותר מקום');
    UI.toast('🏞️ החווה גדלה! עוד מקום לשדות', true);
    grantReward({ x: 0, y: 2, z: 10 }, res, NO_COINS);
    saveAll();
  });
}

function buyHorse(breed) {
  const special = breed === 'rainbow';
  const owned = Horses.list.length;
  const cost = special ? Game.RAINBOW_COST : Game.horseCost(owned);
  if (!Game.canAfford(cost)) { notEnough(cost); return; }
  askProblem('buy', (res) => {
    if (!Game.spend(cost)) return;
    // סוס קשת נולד כבר גדול (אין ציור סייח-קשת) — לכן stage:'adult'
    const h = special
      ? Horses.add({ color: 'rainbow', stage: 'adult', name: 'קשת' })
      : Horses.add({ color: Horses.randomColor(), stage: 'foal', name: Horses.randomName() });
    h.celebrate();
    spawnAt(h.group.position.x, h.group.position.z, 'confetti', 18);
    Audio.fanfare(); Audio.speak('סוס חדש הצטרף לחווה! קוראים לו ' + h.name);
    UI.toast('🐴 ' + h.name + ' הצטרף/ה לחווה!', true);
    grantReward(h.group.position.clone(), res, NO_COINS);
    saveAll();
  });
}

function buyAnimal(item) {
  if (!Game.canAfford(item.cost)) { notEnough(item.cost); return; }
  askProblem('buy', (res) => {
    if (!Game.spend(item.cost)) return;
    const an = Animals.add({ type: item.id, asset: item.asset, scale: item.scale, produce: item.produce, region: PADDOCK });
    an.celebrate();
    spawnAt(an.group.position.x, an.group.position.z, 'confetti', 16);
    Audio.fanfare(); Audio.speak(item.name + ' חדשה הצטרפה לחווה!');
    UI.toast('🐔 ' + item.name + ' הצטרפה!', true);
    Story.event('buy_animal');
    grantReward({ x: an.group.position.x, y: 1, z: an.group.position.z }, res, NO_COINS);
    saveAll();
  });
}

function handleAnimal(a) {
  if (!a.produce) return;            // חיית נוף — אין אינטראקציה
  if (a.birthReady) { animalBirth(a); return; }
  if (a.baby) {
    const left = Math.max(1, Math.ceil((1 - a.growth()) * 3));
    UI.toast('🍼 גור קטן! עוד ' + left + ' דקות והוא יגדל', false);
    Audio.speak('זה גור קטן. הוא עוד גדל'); return;
  }
  if (a.ready) { collectProduce(a); }
  else {
    const s = a.remainingSec(nowMs());
    UI.toast('⏳ עוד ' + s + ' שניות לתוצרת', false);
    Audio.speak('עוד אין תוצרת, עוד קצת');
  }
}

function collectProduce(a) {
  askProblem('harvest', (res) => {
    const gain = Game.pay(a.collect(nowMs()), res);
    questBump('collect');
    a.celebrate();
    World.showAction(a.group.position.clone(), (a.produce && a.produce.emoji) || '🥚');
    spawnAt(a.group.position.x, a.group.position.z, 'coin', 12);
    Audio.coin(); Audio.fanfare();
    UI.toast('🥚 אספת! +' + gain + ' 🪙', true);
    grantReward({ x: a.group.position.x, y: 1, z: a.group.position.z }, res);
    saveAll();
  });
}

function buyUpgrade(item) {
  if (Game.upgrades[item.id]) { UI.toast('כבר יש לך את זה! ✅', false); return; }
  if (!Game.canAfford(item.cost)) { notEnough(item.cost); return; }
  askProblem('buy', (res) => {
    if (Game.upgrades[item.id]) return;
    if (!Game.spend(item.cost)) return;
    Game.upgrades[item.id] = true;
    applyUpgrade(item.id);
    spawnAt(0, -12, 'star', 16);
    Audio.fanfare(); Audio.speak('שדרגת את החווה! ' + item.name);
    UI.toast('🏠 ' + item.name + ' נבנה!', true);
    grantReward({ x: 0, y: 3, z: -12 }, res, NO_COINS);
    saveAll();
  });
}

// הלבשת סוס (אביזר)
// צביעת סוס בתשלום: תרגיל קנייה, ואז הסוס מחליף צבע במקום
function handlePaint(horse, paint) {
  if (Game.visiting) { visitBlock(); return; }
  if (!Game.canAfford(paint.cost)) { notEnough(paint.cost); return; }
  askProblem('buy', (res) => {
    if (!Game.spend(paint.cost)) return;
    horse.setColor(paint.id);
    horse.celebrate();
    World.showAction(horse.group.position.clone(), '🎨');
    World.spawnParticles(horse.group.position.clone(), 'sparkle', 14);
    Audio.fanfare(); Audio.speak('וואו! ' + horse.name + ' עכשיו בצבע ' + paint.name);
    UI.toast('🎨 ' + horse.name + ' בצבע ' + paint.name + '!', true);
    grantReward(horse.group.position.clone(), res, NO_COINS);
    UI.updateHUD(Game); saveAll();
    if (Horses.getById(horse.id)) setTimeout(() => UI.showHorseCard(horse, Game), 200);
  });
}

function handleDress(horse, emoji) {
  askProblem('buy', (res) => {
    horse.setAccessory(emoji);
    horse.celebrate();
    World.showAction(horse.group.position.clone(), emoji || '👒');
    World.spawnParticles(horse.group.position.clone(), 'sparkle', 10);
    Audio.pop();
    UI.toast(emoji ? '👒 איזה יופי!' : 'הורדנו את האביזר', false);
    grantReward(horse.group.position.clone(), res, NO_COINS);   // הלבשה חינמית — לא מכונת מטבעות
    saveAll();
    if (Horses.getById(horse.id)) setTimeout(() => UI.showHorseCard(horse, Game), 200);
  });
}

// --- חיות נדירות (נפתחות בעליית רמה) ---
const RARES = [
  { id: 'fox', asset: 'fox.png', level: 3, name: 'שועל', scale: 1.5, region: { x: -16, z: -2, r: 3 } },
  { id: 'deer', asset: 'deer.png', level: 6, name: 'צבי', scale: 1.9, region: { x: 16, z: 2, r: 3 } },
  { id: 'peacock', asset: 'peacock.png', level: 9, name: 'טווס', scale: 1.7, region: { x: -14, z: 8, r: 2.5 } },
  { id: 'penguin', asset: 'penguin.png', level: 12, name: 'פינגווין', scale: 1.4, region: { x: -16, z: 7, r: 2 } }
];
function spawnRares() {
  RARES.forEach(r => { if (Game.rares[r.id]) Animals.add({ type: r.id, asset: r.asset, scale: r.scale, region: r.region }); });
}
function checkRareUnlocks() {
  RARES.forEach(r => {
    if (r.level <= Game.level && !Game.rares[r.id]) {
      Game.rares[r.id] = true;
      const a = Animals.add({ type: r.id, asset: r.asset, scale: r.scale, region: r.region });
      spawnAt(a.group.position.x, a.group.position.z, 'confetti', 18);
      Audio.fanfare(); Audio.speak('חיה נדירה הצטרפה לחווה! ' + r.name);
      UI.toast('✨ חיה נדירה: ' + r.name + ' הצטרף/ה!', true);
      saveAll();
    }
  });
}

// --- עץ הקסם (נותן פרי כל כמה דקות) ---
const TREE_FRUIT_MS = 90000;
let treeFruitSprite = null;
function initMagicTree() {
  const x = -13.5, z = -3.5;
  const t = World.makeBillboard('assets/oak_tree.png', 9, true);
  t.position.set(x, 0, z); World.scene.add(t);
  const sh = World.makeGroundShadow(2.6); sh.position.set(x, 0.04, z); World.scene.add(sh);
  treeFruitSprite = World.emojiSprite('🍎', 1.8);
  treeFruitSprite.center.set(0.5, 0.0);
  treeFruitSprite.position.set(x, 5.6, z);
  treeFruitSprite.visible = false;
  treeFruitSprite.userData.magictree = true;
  World.scene.add(treeFruitSprite);
  World.registerPickable(treeFruitSprite);
  if (!Game.tree) Game.tree = { lastFruit: nowMs() };
}
function updateMagicTree() {
  if (!treeFruitSprite || !Game.tree) return;
  const ready = nowMs() - (Game.tree.lastFruit || 0) >= TREE_FRUIT_MS;
  treeFruitSprite.visible = ready;
  if (ready) treeFruitSprite.position.y = 5.6 + Math.abs(Math.sin(performance.now() / 450)) * 0.3;
}
function harvestTree() {
  if (!Game.tree || nowMs() - (Game.tree.lastFruit || 0) < TREE_FRUIT_MS) {
    UI.toast('🌳 עוד אין פרי, עוד קצת...', false); Audio.speak('עוד אין פרי, עוד קצת'); return;
  }
  askProblem('harvest', (res) => {
    Game.tree.lastFruit = nowMs();
    const gain = Game.pay(10, res);
    spawnAt(-13.5, -3.5, 'apple', 14);
    Audio.coin(); Audio.fanfare();
    UI.toast('🍎 קטפת פרי קסם! +' + gain + ' 🪙', true);
    grantReward({ x: -13.5, y: 4, z: -3.5 }, res);
    saveAll();
  });
}

function notEnough(cost) {
  UI.toast('צריך עוד ' + (cost - Game.coins) + ' 🪙', true);
  Audio.wrong(); Audio.speak('צריך עוד מטבעות. פתרי עוד תרגילים!');
}

// ---------- מסלול הרכיבה ----------
function buildTrack() {
  Track3D.build({
    Game, UI,
    onSolved: (problem, firstTry, pos) => {
      Game.recordResult(problem.type, firstTry); questBump('solve');
      grantReward(pos, { firstTry });
      Game.rides.jumps++;
      Story.event('jump'); if (firstTry) Story.event('star_jump');
    },
    onLap: ({ stars, perfect }) => {
      const prize = 3 + stars * 2 + (perfect ? 5 : 0);
      Game.addCoins(prize);
      Game.rides.laps++;
      if (perfect) { Game.ribbons++; Game.rides.perfect++; Story.event('perfect'); }
      Story.event('ride');
      UI.updateHUD(Game); saveAll();
      return prize;
    },
    onExit: () => { UI.updateHUD(Game); UI.setTip('🏇 געי בסוס בחווה כדי לרכוב שוב'); }
  });
}
// רכיבה: על הסוס שנבחר, או על הסוס הגדול הראשון
function openTrack(horse) {
  if (Game.visiting) { visitBlock(); return; }
  if (Interiors.active) Interiors.exit();
  const h = horse && horse.stage === 'adult' ? horse : Horses.list.find(x => x.stage === 'adult');
  if (!h) {
    UI.toast('🐴 צריך סוס גדול כדי לרכוב. האכילי סייח ואז גדלי אותו', true);
    Audio.speak('צריך סוס גדול כדי לרכוב. האכילי סייח שלוש פעמים, ואז לחצי לגדול');
    return;
  }
  currentArea = 'track';
  Game.visitArea('track'); Story.event('visit_track');
  UI.setLocation('🏇', 'מסלול הרכיבה');
  Track3D.start(h);
}

// ---------- גורים: חיות וסוסים שהמליטו ----------
function animalBirth(a) {
  askProblem('birth', (res) => {
    const baby = Animals.birth(a, nowMs());
    spawnAt(baby.group.position.x, baby.group.position.z, 'confetti', 16);
    World.showAction(baby.group.position.clone(), '🍼', true);
    Audio.fanfare(); Audio.animalSound(a.type);
    const name = (SHOP.animals.find(s => s.id === a.type) || {}).name || 'חיה';
    Audio.speak('נולד גור ' + name + ' קטן! קוראים לו ' + baby.name);
    UI.toast('🍼 נולד גור ' + name + '! קוראים לו ' + baby.name, true);
    grantReward({ x: baby.group.position.x, y: 1, z: baby.group.position.z }, res);
    Story.event('birth');
    saveAll();
  });
}
function horseBirth(mom) {
  if (!mom.birthReady) return;
  askProblem('birth', (res) => {
    const foal = Horses.birth(mom);
    foal.celebrate();
    spawnAt(foal.group.position.x, foal.group.position.z, 'confetti', 18);
    World.showAction(foal.group.position.clone(), '🍼', true);
    Audio.fanfare(); Audio.animalSound('horse');
    Audio.speak('ל' + mom.name + ' נולד סייח! קוראים לו ' + foal.name + '. האכילי אותו כדי שיגדל');
    UI.toast('🐴 ל' + mom.name + ' נולד סייח: ' + foal.name + '!', true);
    grantReward(foal.group.position.clone(), res);
    Story.event('birth');
    saveAll();
  });
}
Animals.onGrown = (a) => {
  const name = (SHOP.animals.find(s => s.id === a.type) || {}).name || 'הגור';
  UI.toast('🎉 ' + a.name + ' ה' + name + ' גדל/ה! עכשיו יש תוצרת', true);
  Audio.speak(a.name + ' גדל! עכשיו הוא ייתן תוצרת');
  a.celebrate(); saveAll();
};

// ---------- מכירה בחנות ----------
// מקובץ לפי סוג: קישוטים/ציוד שהוצבו, וחיות משק (גורים בנפרד, במחיר נמוך יותר)
function sellables() {
  const out = [], byId = {};
  placedItems.forEach(r => { byId[r.id] = (byId[r.id] || 0) + 1; });
  Object.keys(byId).forEach(id => {
    const it = shopItemById(id);
    if (!it) return;
    out.push({ kind: 'placed', key: id, name: it.name, say: it.name, img: 'assets/' + it.asset, count: byId[id], price: Math.max(1, Math.floor(it.cost / 2)) });
  });
  const byType = {};
  Animals.productive().forEach(a => { const k = a.type + ':' + (a.baby ? 'baby' : '') + ':' + (a.momId ? 'born' : ''); byType[k] = (byType[k] || 0) + 1; });
  Object.keys(byType).forEach(k => {
    const [type, baby, born] = k.split(':');
    const def = SHOP.animals.find(s => s.id === type);
    if (!def) return;
    // חיה שנולדה בחווה לא נקנתה בכסף — נמכרת בזול, אחרת לידות הופכות למכונת כסף
    const div = baby ? 10 : born ? 8 : 2;
    out.push({ kind: 'animal', key: type, baby: !!baby, born: !!born, name: (baby ? 'גור ' : '') + def.name, say: (baby ? 'גור ' : '') + def.name,
      img: 'assets/' + def.asset, count: byType[k], price: Math.max(1, Math.floor(def.cost / div)) });
  });
  return out;
}
function removePlaced(rec) {
  const sp = movableSprites.find(m => m.userData.placedRec === rec);
  if (sp) {
    const sh = sp.userData.placedShadow;
    [sp, sh].forEach(o => {
      if (!o) return;
      World.scene.remove(o);
      const i = placedMeshes.indexOf(o); if (i >= 0) placedMeshes.splice(i, 1);
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
      if (o.geometry) o.geometry.dispose();
    });
    movableSprites.splice(movableSprites.indexOf(sp), 1);
  }
  placedItems.splice(placedItems.indexOf(rec), 1);
  return sp ? sp.position.clone() : new THREE.Vector3(0, 0, 0);
}
function sellItem(it) {
  if (Game.visiting) { visitBlock(); return; }
  askProblem('sell', (res) => {
    let pos = null;
    if (it.kind === 'placed') {
      const rec = [...placedItems].reverse().find(r => r.id === it.key);
      if (!rec) return;
      pos = removePlaced(rec);
    } else {
      const list = Animals.productive().filter(a => a.type === it.key && !!a.baby === !!it.baby && !!a.momId === !!it.born);
      const a = list[list.length - 1];
      if (!a) return;
      pos = a.group.position.clone();
      Animals.remove(a);
    }
    Game.addCoins(it.price);
    spawnAt(pos.x, pos.z, 'coin', 14);
    Audio.coin(); Audio.speak('מכרת ' + it.say + ' וקיבלת ' + it.price + ' מטבעות');
    UI.toast('💰 מכרת ' + it.name + '! +' + it.price + ' 🪙', true);
    grantReward({ x: pos.x, y: 1, z: pos.z }, res, NO_COINS);
    Story.event('sell');
    saveAll();
  });
}

// ---------- כניסה למבנים ----------
const FAR = { x: 0, y: -60, z: 0 };   // חלקיקי התגמול "בחוץ" לא נראים מבפנים — לחדר יש חלקיקים משלו
function enterBuilding(id) {
  if (Track3D.active || !Interiors.has(id)) return;
  UI.closeHorseCard();
  Interiors.enter(id);
}
let lastInteriorRes = null;   // התוצאה של התרגיל האחרון בתוך מבנה — קובעת אם התשלום מלא
Interiors.init({
  Horses,
  ask: (type, fn) => askProblem(type, (res) => { lastInteriorRes = res; grantReward(FAR, res); fn(res); }),
  coins: (n) => { const g = Game.pay(Math.ceil(n / 2), lastInteriorRes); lastInteriorRes = null; if (g) UI.toast('+' + g + ' 🪙', false); UI.updateHUD(Game); saveAll(); },
  stallCare: (h, fx) => askProblem('brush', (res) => {
    h.clean = 100; h.happy = 100;
    questBump('brush');
    grantReward(FAR, res);
    UI.toast('🧼 ' + h.name + ' נקי ומאושר!', true);
    Audio.animalSound('horse');
    fx(res); saveAll();
  }),
  event: (e) => Story.event(e),
  toast: (t, big) => UI.toast(t, big),
  onEnter: (id) => { Story.event('enter_' + id); UI.setLocation('🚪', { barn: 'האסם', bakery: 'המאפייה', cottage: 'בית בכפר' }[id] || ''); },
  onExit: () => { const a = AREAS.find(x => x.id === currentArea); if (a) UI.setLocation(a.emoji, a.name); }
});

// ---------- הסיפור: "קחי אותי" לכל שלב ----------
function pointAt(pos, emoji = '👇') {
  let n = 0;
  const show = () => { World.showAction({ x: pos.x, y: pos.y || 0, z: pos.z }, emoji); if (++n < 4) setTimeout(show, 2300); };
  setTimeout(show, 700);
}
function goFarm() { if (currentArea !== 'farm') travelToArea('farm'); }
function storyGo(target) {
  if (Interiors.active) Interiors.exit();
  if (Track3D.active) Track3D.stop();
  syncStoryUnlocks();
  const near = (o, say) => { World.travelTo(o.x, o.z, 16); pointAt(o); if (say) Audio.speak(say); };
  if (target === 'foal') {
    goFarm();
    // הסייח הכי קרוב לגדילה. אין סייח בכלל (גדלו/נמכרו) → השלב לא נתקע
    const foals = Horses.list.filter(x => x.stage === 'foal').sort((a, b) => b.feedCount - a.feedCount);
    if (!foals.length) { Story.event('grow'); return; }
    near(foals[0].group.position, foalHint(foals[0]));
  } else if (target === 'horse') {
    goFarm();
    const h = Horses.list[0];
    if (h) near(h.group.position, 'געי ב' + h.name);
  } else if (target === 'field') {
    goFarm();
    const p = Fields.plots.find(x => x.state === 'ready') || Fields.freePlot() || Fields.plots[0];
    if (p) near(p.pos, p.state === 'ready' ? 'השדה מוכן לקציר! געי בו' : 'געי בשדה');
  } else if (target === 'animal' || target === 'birth') {
    goFarm();
    const list = Animals.productive();
    const a = target === 'birth'
      ? (list.find(x => x.birthReady) || Horses.list.find(x => x.birthReady))
      : (list.find(x => x.ready) || list.find(x => !x.baby));
    if (a) near(a.group.position, target === 'birth' ? 'יש בקבוק! געי בו' : 'געי בחיה');
    else if (target === 'birth') { UI.toast('🍼 עוד אין גור. כשיופיע בקבוק מעל חיה או סוס, געי בו', true); Audio.speak('עוד אין גור. כשתראי בקבוק מעל חיה או סוס, געי בו'); }
    else { openShop(); UI.openShopTab('animals'); }
  } else if (target === 'track') openTrack();
  else if (target === 'shop_animals') { openShop(); UI.openShopTab('animals'); }
  else if (target === 'shop') openShop();
  else if (target === 'sell') { openShop(); UI.openShopTab('sell'); }
  else if (target === 'barn') { goFarm(); if (barnSprite) near(barnSprite.position, 'געי באסם כדי להיכנס פנימה'); }
  else if (target === 'bakery') {
    travelToArea('village');
    setTimeout(() => { pointAt({ x: -79, z: -6, y: 3 }); Audio.speak('געי במאפייה כדי להיכנס'); }, 1500);
  } else if (AREAS.find(a => a.id === target)) travelToArea(target);
}
function storyReward(r) {
  if (r.coins) Game.addCoins(r.coins);
  if (r.stars) Game.stars += r.stars;
  if (r.horse === 'rainbow') {
    const h = Horses.add({ color: 'rainbow', stage: 'adult', name: 'קשת' });
    h.celebrate(); spawnAt(h.group.position.x, h.group.position.z, 'confetti', 20);
  }
  Game.save(); UI.updateHUD(Game); saveAll();
}
// שחקנית שכל הסוסים שלה כבר גדולים לא נתקעת על "לגדל סייח"
function storyAutoSkip() {
  const c = Story.chapter();
  if (c && c.steps.some(s => s.ev === 'grow') && !Horses.list.some(h => h.stage === 'foal')) Story.event('grow');
}
Story.init({
  Game, root: document.getElementById('ui'),
  go: storyGo, reward: storyReward, toast: (t, big) => UI.toast(t, big),
  busy: () => !!Track3D.active,
  onChapter: () => { syncStoryUnlocks(); storyAutoSkip(); }
});

// עזר ליצירת חלקיקים בנקודת קרקע
function spawnAt(x, z, kind, count) {
  World.spawnParticles({ x, y: 1, z }, kind, count);
}

// ---------- טיפול בחלקת שדה ----------
function handlePlot(plot) {
  if (plot.state === 'empty') {
    UI.chooseCrop(Game, (key) => startPlant(plot, key));
  } else if (plot.state === 'growing') {
    const def = CROPS[plot.cropKey] || {}, sec = plot.remainingSec(nowMs());
    if (def.overnight) {   // גידול לילה לא מדלגים: הוא הסיבה לחזור מחר
      UI.toast('🌙 פרח הלילה יפרח מחר בבוקר', true);
      Audio.speak('פרח הלילה ישן עכשיו. הוא יפרח מחר בבוקר');
    } else if (sec <= 5 || Game.visiting) {
      UI.toast('🌱 עוד ' + sec + ' שניות לגדילה', false);
      Audio.speak('עוד קצת והגידול יהיה מוכן');
    } else UI.offerGrow(sec, def.name || 'גידול', () => growNow(plot));
  } else if (plot.state === 'ready') {
    startHarvest(plot);
  }
}

function startPlant(plot, cropKey) {
  const def = CROPS[cropKey];
  if (!Game.canAfford(def.seedCost)) { notEnough(def.seedCost); return; }
  const task = { who: { name: 'השדה', img: 'assets/' + def.asset }, plot, item: '🌱', itemName: 'שתילים', box: 'ערוגה', verb: 'שתלי' };
  if (Tutorial.step === 'plant') clearInterval(Tutorial._timer);   // החץ מעל השדה מפריע כשהערוגה פתוחה
  askProblem('plant', (res) => {
    if (!Game.spend(def.seedCost)) return;
    const now = nowMs();
    plot.plant(Object.assign({ key: cropKey }, def, def.overnight ? { growMs: msUntilMorning(now) } : null), now);
    questBump('plant');
    World.showAction({ x: plot.pos.x, y: 0, z: plot.pos.z }, def.overnight ? '🌙' : '🌱');
    spawnAt(plot.pos.x, plot.pos.z, 'sparkle', 10);
    Audio.pop(); Audio.speak('שתלת ' + def.name + (def.overnight ? '. הוא יפרח מחר בבוקר' : '. עכשיו צריך לחכות שיגדל'));
    UI.toast((def.overnight ? '🌙 ' : '🌱 ') + 'שתלת ' + def.name + '!', false);
    grantReward({ x: plot.pos.x, y: 1, z: plot.pos.z }, res, NO_COINS);
    saveAll();
    Tutorial.planted();
  }, false, task);
}

// הדילוג על ההמתנה נקנה בחשבון: תרגיל אתגר (קושי +1) → השדה גדל מיד. XP בלבד, המטבעות מגיעים בקציר
function growNow(plot) {
  askProblem('growNow', (res) => {
    if (plot.state !== 'growing') return;
    plot.plantedAt = nowMs() - plot.growMs;
    World.showAction({ x: plot.pos.x, y: 0, z: plot.pos.z }, '⚡');
    spawnAt(plot.pos.x, plot.pos.z, 'sparkle', 16);
    Audio.fanfare(); Audio.speak('וואו! הוא גדל מיד. עכשיו אפשר לקצור', { queue: true });
    grantReward({ x: plot.pos.x, y: 1, z: plot.pos.z }, res, NO_COINS);
    saveAll();
  }, true);
}

function startHarvest(plot) {
  askProblem('harvest', (res) => {
    const key = plot.harvest();
    const gain = Game.pay((CROPS[key] || { sellPrice: 6 }).sellPrice, res);
    questBump('harvest');
    World.showAction({ x: plot.pos.x, y: 0, z: plot.pos.z }, '🌾');
    spawnAt(plot.pos.x, plot.pos.z, 'coin', 14);
    Audio.coin(); Audio.fanfare();
    UI.toast('🌾 קצרת! +' + gain + ' 🪙', true);
    grantReward({ x: plot.pos.x, y: 1, z: plot.pos.z }, res);
    saveAll();
  });
}

// ---------- reset ----------
function resetGame() {
  if (Game.visiting) return;
  Game.reset();
  Horses.clear();
  Fields.clear();
  Animals.clear();
  placedMeshes.forEach(m => { World.scene.remove(m); if (m.material) m.material.dispose(); });
  placedMeshes.length = 0;
  movableSprites.length = 0;
  placedItems = [];
  Horses.add({ color: 'brown', stage: 'foal', name: 'כוכב' });
  Horses.add({ color: 'golden', stage: 'foal', name: 'דבש' });
  Fields.ensure(3);
  spawnCritters();
  UI.updateHUD(Game);
  if (UI.settingsOv) UI.settingsOv.classList.add('hidden');
  UI.toast('התחלנו מחדש! 🌱', true);
  saveAll();
}

// ---------- מצב עיצוב: גרירת פריטים שנקנו ----------
let arrangeMode = false;
let dragging = null;
function toggleArrange() {
  if (Game.visiting) { visitBlock(); return; }
  if (!arrangeMode && !movableSprites.length) {
    UI.toast('קני קישוטים בחנות ואז אפשר לסדר אותם 🛒', true);
    Audio.speak('קני קישוטים בחנות, ואז אפשר לגרור אותם לאן שתרצי');
    return;
  }
  arrangeMode = !arrangeMode;
  dragging = null;
  World.controls.enabled = !arrangeMode;   // מקפיא את המצלמה כדי שהגרירה תזיז פריט ולא נוף
  UI.setArrangeMode(arrangeMode);
  if (arrangeMode) Audio.speak('מצב עיצוב! גררי כל קישוט לאן שבא לך');
  else { saveAll(); Audio.speak('שמרנו את העיצוב'); }
}

// גרירת פריט בתוך שטח הגדר
function dragPlacedTo(clientX, clientY) {
  if (!dragging) return;
  const p = World.pickGround(clientX, clientY);
  if (!p) return;
  const R = (World.fenceR || 15) - 1.2;         // נשארים בתוך הגדר (שמתרחבת עם ההרחבה)
  let x = p.x, z = p.z; const d = Math.hypot(x, z);
  if (d > R) { x = x / d * R; z = z / d * R; }
  dragging.position.x = x; dragging.position.z = z;
  const ud = dragging.userData;
  if (ud.placedShadow) { ud.placedShadow.position.x = x; ud.placedShadow.position.z = z; }
  if (ud.placedRec) { ud.placedRec.x = x; ud.placedRec.z = z; }        // פריט שנקנה
  if (ud.decorId) { (Game.decorPos || (Game.decorPos = {}))[ud.decorId] = { x, z }; }  // קישוט-חווה קבוע
}

// ---------- בחירה (הקלקה/נגיעה, להבדיל מגרירת מצלמה) ----------
let downX = 0, downY = 0, downT = 0;
const activePointers = new Set(); let multiTouch = false;
canvas.addEventListener('pointerdown', (e) => {
  activePointers.add(e.pointerId);
  if (activePointers.size > 1) multiTouch = true;     // צביטה לזום — לא נגיעה
  else multiTouch = false;
  downX = e.clientX; downY = e.clientY; downT = performance.now();
  if (arrangeMode) {
    const hit = World.pickAmong(e.clientX, e.clientY, movableSprites);
    if (hit) { dragging = hit.object; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} Audio.pop(); }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (arrangeMode && dragging) { e.preventDefault(); dragPlacedTo(e.clientX, e.clientY); }
}, { passive: false });
canvas.addEventListener('pointercancel', (e) => activePointers.delete(e.pointerId));
canvas.addEventListener('pointerup', (e) => {
  activePointers.delete(e.pointerId);
  if (multiTouch) { if (!activePointers.size) multiTouch = false; return; }
  if (arrangeMode) {
    if (dragging) { dragging = null; saveAll(); Audio.pop(); }
    return;   // במצב עיצוב אין פעולות-נגיעה רגילות
  }
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  const dt = performance.now() - downT;
  if (moved < 14 && dt < 900) {   // ילדה לוחצת לאט — 450ms פספס לחיצות מכוונות
    Audio.resume();
    if (Interiors.active) { Interiors.pick(e.clientX, e.clientY); return; }   // בתוך מבנה — רק דברים בחדר
    if (Track3D.active) return;                                              // ברכיבה — רק הכפתורים
    // בזמן משימת השוקת נגיעה מזיזה גזרים בלבד (לא פותחת סוסים/שדות)
    if (Transfer3D.active) {
      const c = Transfer3D.pickAt(e.clientX, e.clientY);
      if (c) Transfer3D.tap(c);
      return;
    }
    const hit = World.pickAt(e.clientX, e.clientY);
    if (!hit) return;
    const ud = hit.object.userData;
    Models3D.react(hit.object);   // חיה/דמות תלת-ממדית מגיבה לנגיעה
    if (ud.horse) { Audio.animalSound('horse'); ud.horse.celebrate(); UI.showHorseCard(ud.horse, Game); Tutorial.horseOpened(ud.horse); }
    else if (ud.plot) { Audio.pop(); handlePlot(ud.plot); }
    else if (ud.animal) { Audio.animalSound(ud.animal.type); ud.animal.celebrate(); handleAnimal(ud.animal); }
    else if (ud.magictree) { Audio.pop(); harvestTree(); }
    else if (ud.activity) { Audio.pop(); ud.activity(); }
  }
});

// ---------- שמירה תקופתית ----------
setInterval(saveAll, 8000);
window.addEventListener('beforeunload', saveAll);

// ---------- מיני-משחקים מבוססי-מודול (נבנו בטורבו) ----------
const _deps = {
  root: document.getElementById('ui'),
  Game, UI, Audio, World, THREE, Horses,
  askProblem, grantReward, spawnAt, saveAll
};
const Mini = {
  contest: createContest(_deps),
  delivery: createDelivery(_deps),
  photo: createPhoto(_deps)
};

// ---------- לולאת המשחק ----------
function loop() {
  const dt = World.update();
  Horses.update(dt);
  Fields.update(nowMs(), dt);
  Animals.update(nowMs(), dt);
  updateMagicTree();
  Transfer3D.update(dt);
  Track3D.update(dt);
  Interiors.update(dt);
  const t = performance.now() / 1000;
  Track3D.idle(t, dt);
  for (let i = 0; i < areaUpdaters.length; i++) areaUpdaters[i](t, dt);
  World.render();
  requestAnimationFrame(loop);
}
loop();
