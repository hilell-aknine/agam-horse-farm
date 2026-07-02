// main.js — מקשר הכל: עולם, סוסים, שדות, חנות, ממשק, מצב ולולאת המשחק
import { World, THREE } from './world.js';
import { Horses } from './horses.js';
import { Fields } from './fields.js';
import { Animals } from './animals.js';
import { Cloud } from './cloud.js';
import { UI } from './ui.js';
import { Game, CROPS, SHOP } from './game.js';
import { Audio } from './audio.js';
import { generateProblem } from './math.js';
import { createContest } from './contest.js';
import { createDelivery } from './delivery.js';
import { createPhoto } from './photo.js';
import { buildForest } from './forest_area.js';
import { buildLake } from './lake_area.js';
import { buildVillage } from './village_area.js';
import { buildMountain } from './mountain_area.js';
import { buildFair } from './fair_area.js';

const nowMs = () => Date.now();
const today = () => new Date().toISOString().slice(0, 10);

// --- עולם חברתי: מצב ביקור אצל חברה (?visit=<user_id>&name=<שם>) ---
const VISIT = (() => {
  try {
    const p = new URLSearchParams(location.search);
    const id = p.get('visit');
    return id ? { id, name: p.get('name') || 'חברה' } : null;
  } catch (e) { return null; }
})();
const OWNER_KEY = 'agam_farm_owner';   // איזה חשבון "מחזיק" את השמירה המקומית במכשיר הזה
const LOCAL_SAVE_KEY = 'agam_farm_v2'; // מפתח השמירה המקומית (זהה ל-SAVE_KEY ב-game.js)

// מכשיר משותף: אחרי הרשמה/כניסה — אם השמירה המקומית לא שייכת למשתמש הנוכחי
// (כולל "בעלים לא ידוע" ממשחק-אורח), מוחקים אותה כדי שלא תזלוג לחשבון החדש.
// הענן ישחזר את החווה האמיתית של המשתמש. תמיד מסמנים בעלות למשתמש הנוכחי.
function claimDeviceForCurrentUser() {
  if (!Cloud.userId) return;
  let owner = null;
  try { owner = localStorage.getItem(OWNER_KEY); } catch (e) {}
  let hasLocal = false;
  try { hasLocal = !!localStorage.getItem(LOCAL_SAVE_KEY); } catch (e) {}
  if (hasLocal && owner !== Cloud.userId) {
    try { localStorage.removeItem(LOCAL_SAVE_KEY); } catch (e) {}
    Game.reset();
  }
  try { localStorage.setItem(OWNER_KEY, Cloud.userId); } catch (e) {}
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
  onSettings: applySettings,
  onReset: resetGame,
  onSpin: () => {
    if (Game.visiting) { visitBlock(); return { ok: false }; }
    if (!Game.canSpin(today())) return { ok: false };
    const prize = Game.doSpin(today());
    UI.updateHUD(Game); saveAll();
    return { ok: true, prize };
  },
  onRace: () => startRace(),
  onDelivery: () => Mini.delivery.start(),
  onContest: () => Mini.contest.open(),
  onPhoto: () => Mini.photo.take(),
  onMap: () => UI.openMap(AREAS, currentArea, travelToArea),
  onJournal: () => UI.openJournal(AREAS, Game),
  onFriends: async () => {
    const farms = await Cloud.listFarms();
    UI.openFriends(farms, (f) => {
      location.href = location.pathname + '?visit=' + encodeURIComponent(f.user_id) + '&name=' + encodeURIComponent(f.name);
    });
  },
  onAuth: {
    signUp: async (email, pass, name) => {
      await Cloud.signUp(email, pass, name);
      claimDeviceForCurrentUser();   // מנקה שמירה של חשבון אחר לפני ה-reload
    },
    signIn: async (email, pass) => {
      await Cloud.signIn(email, pass);
      claimDeviceForCurrentUser();   // מנקה שמירה של חשבון אחר לפני ה-reload
    }
  },
  getGame: () => Game
});

// אזור המכלאה — בו חיות המשק משוטטות
const PADDOCK = { x: 0, z: -7, r: 5 };

// --- עולם פתוח: אזורים שאפשר לנסוע אליהם ---
const AREAS = [
  { id: 'farm',     name: 'החווה', emoji: '🏡', x: 0,   z: 0,   unlock: 1 },
  { id: 'forest',   name: 'היער',  emoji: '🌲', x: 0,   z: -70, unlock: 1 },
  { id: 'lake',     name: 'האגם',  emoji: '🏖️', x: 70,  z: 6,   unlock: 2 },
  { id: 'village',  name: 'הכפר',  emoji: '🏘️', x: -72, z: 0,   unlock: 3 },
  { id: 'mountain', name: 'ההר',   emoji: '🏔️', x: 0,   z: 72,  unlock: 4 },
  { id: 'fair',     name: 'היריד', emoji: '🎪', x: 64,  z: -64, unlock: 5 }
];
let currentArea = 'farm';
function travelToArea(id) {
  const a = AREAS.find(x => x.id === id);
  if (!a) return;
  if (Game.level < a.unlock) { UI.toast('🔒 ' + a.name + ' נפתח ברמה ' + a.unlock, true); Audio.wrong(); return; }
  currentArea = id;
  World.travelTo(a.x, a.z);
  Game.visitArea(id);
  UI.setLocation(a.emoji, a.name);
  UI.setTip(a.emoji + ' ' + a.name);
  Audio.areaAmbient(id);
  Audio.speak('נוסעים ל' + a.name);
}
// תגמול עוטף פר-אזור — סופר פעילויות ונותן כוכב בונוס כל 3
function areaReward(id) {
  return (pos, res) => {
    grantReward(pos, res);
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
  if (saved && saved.placed) saved.placed.forEach(p => { placeBought(p.id, p.x, p.z, false); placedItems.push({ id: p.id, x: p.x, z: p.z }); });
  if (saved && saved.animals) saved.animals.forEach(a => {
    const def = SHOP.animals.find(s => s.id === a.type);
    if (def) Animals.add({ id: a.id, type: a.type, asset: def.asset, scale: def.scale, produce: def.produce, region: PADDOCK, name: a.name, lastProduced: a.lastProduced });
  });
  spawnCritters();   // חיות נוף (לא נשמרות — תמיד מופיעות)
  // החלת שדרוגי אסם/חווה שנקנו
  const ups = Game.upgrades || {};
  Object.keys(ups).forEach(id => { if (ups[id]) applyUpgrade(id); });
  spawnRares();       // חיות נדירות שכבר נפתחו
  initMagicTree();    // עץ הקסם
  // אזורי העולם הפתוח (יער, אגם)
  const areaDeps = { THREE, World, decor, activity: registerActivity, onUpdate: registerUpdater, Animals, askProblem, spawnAt, grantReward, saveAll, Game, UI, Audio };
  buildForest(Object.assign({}, areaDeps, { center: { x: 0, z: -70 }, grantReward: areaReward('forest') }));
  buildLake(Object.assign({}, areaDeps, { center: { x: 70, z: 6 }, grantReward: areaReward('lake') }));
  buildVillage(Object.assign({}, areaDeps, { center: { x: -72, z: 0 }, grantReward: areaReward('village') }));
  buildMountain(Object.assign({}, areaDeps, { center: { x: 0, z: 72 }, grantReward: areaReward('mountain') }));
  buildFair(Object.assign({}, areaDeps, { center: { x: 64, z: -64 }, grantReward: areaReward('fair') }));
  forestDensify();
  buildPaths();
}

// ציפוף היער (היה דליל בחזית)
function forestDensify() {
  const c = { x: 0, z: -70 }, trees = ['assets/pine_tree.png', 'assets/oak_tree.png', 'assets/tree.png'];
  for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 10; decor(trees[i % 3], c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 6.5 + Math.random() * 2, true); }
  for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 11; decor('assets/bush.png', c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 2.2, false); }
  for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 13; decor('assets/flowers_wild.png', c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 1.4, false); }
}

// שבילי עפר שמחברים את החווה לכל אזור
function buildPaths() {
  const targets = [[0, -70], [70, 6], [-72, 0], [0, 72], [64, -64]];
  targets.forEach(([tx, tz]) => {
    const steps = 11;
    for (let i = 2; i < steps; i++) { World.floorPatch(tx * i / steps, tz * i / steps, 5.5, 5.5, 0xc8a878); }
  });
}

// החלת שדרוג נראה על העולם
function applyUpgrade(id) {
  if (id === 'barn_big') {
    if (barnSprite) { World.scene.remove(barnSprite); barnSprite.material.dispose(); }
    barnSprite = decor('assets/barn_big.png', 0, -14, 11);
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
  let localData = Game.load();
  let saved = localData;
  await withTimeout(Cloud.init(), 4500, false);   // לא נתקע אם אין רשת

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

  if (Cloud.ready) {
    const loggedIn = Cloud.loggedIn();                  // משתמש עם אימייל (לא אורח)
    // מכשיר משותף: אם השמירה המקומית שייכת לחשבון אחר — לא נוגעים בה, הענן קובע
    let owner = null;
    try { owner = localStorage.getItem(OWNER_KEY); } catch (e) {}
    // בעלים שונה — או בעלים לא ידוע (משחק-אורח קודם) — השמירה המקומית אינה של המשתמש הנוכחי
    if (loggedIn && localData && owner !== Cloud.userId) {
      Game.reset();                                     // החווה של המשתמש הקודם שמורה בענן שלו
      localData = null; saved = null;
    }
    const cloudData = await withTimeout(Cloud.pull(), 4000, null);
    if (cloudData && (loggedIn || !localData || (cloudData.savedAt || 0) >= (localData.savedAt || 0))) {
      Game.applyData(cloudData); saved = cloudData;     // מחובר/עדכני יותר → הענן מנצח
    } else if (localData) {
      Cloud.push(Game.lastData());                      // העלאת השמירה המקומית לענן ("claim" של השמירה במכשיר)
    }
    if (loggedIn) {
      try { localStorage.setItem(OWNER_KEY, Cloud.userId); } catch (e) {}
      await withTimeout(Cloud.fetchProfile(), 3000, null);
    }
  }
  buildFarm(saved);
  applySettings();

  // ---------- שער כניסה: אונליין בלי חשבון → הרשמה/כניסה קודם ----------
  if (Cloud.ready && !Cloud.loggedIn()) {
    UI.showAuthGate();
    readyUI();
    return;
  }
  // מחוברת אבל בלי שם (חשבון ותיק) — שואלים פעם אחת ושומרים פרופיל
  if (Cloud.loggedIn() && !Cloud.profileName()) {
    UI.askPlayerName(async (name) => {
      await Cloud.saveProfile(name, Game.level);
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
}

// ---------- תפאורה קבועה ----------
function decor(url, x, z, height, withShadow = true) {
  const sp = World.makeBillboard(url, height, true);
  sp.position.set(x, 0, z);
  World.scene.add(sp);
  if (withShadow) {
    const sh = World.makeGroundShadow(height * 0.3);
    sh.position.set(x, 0.04, z);
    World.scene.add(sh);
  }
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
function placeBought(id, x, z, record) {
  const it = shopItemById(id);
  const h = it ? it.h : 2.5;
  const asset = it ? it.asset : (id + '.png');
  const sp = World.makeBillboard('assets/' + asset, h, true);
  sp.position.set(x, 0, z);
  const sh = World.makeGroundShadow(h * 0.3);
  sh.position.set(x, 0.04, z);
  World.scene.add(sp); World.scene.add(sh);
  placedMeshes.push(sp, sh);
  if (record) { placedItems.push({ id, x, z }); saveAll(); }
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
}

// מעדכן התקדמות משימה ומתריע על השלמה
function questBump(action) {
  const done = Game.bumpQuest(action);
  done.forEach(q => { UI.toast('✅ משימה הושלמה! +' + q.reward + ' 🪙', true); Audio.fanfare(); Audio.speak('משימה הושלמה! כל הכבוד'); });
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
function grantReward(pos, res) {
  World.spawnParticles(pos, 'heart', 8);
  World.spawnParticles(pos, 'coin', 6);
  const r = Game.onCorrect();
  const bonus = res.firstTry ? 2 : 0;
  if (bonus) Game.addCoins(bonus);
  Audio.coin(); Audio.praise();
  UI.updateHUD(Game);
  if (r.leveledUp) { World.spawnParticles(pos, 'star', 16); UI.levelUp(Game.level); checkRareUnlocks(); }
  return 5 + bonus;
}

// פותח תרגיל עם קושי מותאם (35% מהזמן מחזק את הסוג החלש), ומתעד את התוצאה
function askProblem(actionType, onCorrect, harder) {
  if (Game.visiting) { visitBlock(); return; }
  const focus = Math.random() < 0.35 ? Game.weakType() : null;
  const problem = generateProblem(Game.difficulty() + (harder ? 1 : 0), focus);
  UI.askMath(problem, actionType, (res) => {
    if (res.correct) { Game.recordResult(problem.type, res.firstTry); questBump('solve'); onCorrect(res); }
    else if (!res.cancelled) Game.onWrong();
  });
}

// ---------- טיפול בסוס ----------
function handleAction(type, horse) {
  UI.closeHorseCard();
  askProblem(type, (res) => {
    if (type === 'feed') { horse.hunger = 100; horse.feedCount++; }
    else if (type === 'brush') { horse.clean = 100; }
    else if (type === 'play') { horse.happy = 100; }
    else if (type === 'grow') {
      if (horse.grow()) { UI.toast('🎉 ' + horse.name + ' גדל/ה!', true); Audio.fanfare(); }
    }
    horse.celebrate();
    const fx = { feed: 'apple', brush: 'bubble', play: 'ball', grow: 'sparkle' }[type] || 'heart';
    // פידבק ויזואלי מומחש — אמוji ענק של הפעולה קופץ ליד הסוס
    const bigIcon = { feed: '🍎', brush: '🧼', play: '🎾', grow: '🌟' }[type] || '❤️';
    World.showAction(horse.group.position.clone(), bigIcon);
    World.spawnParticles(horse.group.position.clone(), fx, 12);
    questBump(type);
    const got = grantReward(horse.group.position.clone(), res);
    UI.toast('+' + got + ' 🪙', false);
    saveAll();
    if (Horses.getById(horse.id)) setTimeout(() => UI.showHorseCard(horse, Game), 200);
  }, type === 'grow');
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
    grantReward({ x, y: 1, z }, res);
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
    grantReward({ x: p.pos.x, y: 1, z: p.pos.z }, res);
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
    grantReward({ x: 0, y: 2, z: 10 }, res);
    saveAll();
  });
}

function buyHorse() {
  const owned = Horses.list.length;
  const cost = Game.horseCost(owned);
  if (!Game.canAfford(cost)) { notEnough(cost); return; }
  askProblem('buy', (res) => {
    if (!Game.spend(cost)) return;
    const h = Horses.add({ color: Horses.randomColor(), stage: 'foal', name: Horses.randomName() });
    h.celebrate();
    spawnAt(h.group.position.x, h.group.position.z, 'confetti', 18);
    Audio.fanfare(); Audio.speak('סוס חדש הצטרף לחווה! קוראים לו ' + h.name);
    UI.toast('🐴 ' + h.name + ' הצטרף/ה לחווה!', true);
    grantReward(h.group.position.clone(), res);
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
    grantReward({ x: an.group.position.x, y: 1, z: an.group.position.z }, res);
    saveAll();
  });
}

function handleAnimal(a) {
  if (!a.produce) return;            // חיית נוף — אין אינטראקציה
  if (a.ready) { collectProduce(a); }
  else {
    const s = a.remainingSec(nowMs());
    UI.toast('⏳ עוד ' + s + ' שניות לתוצרת', false);
    Audio.speak('עוד אין תוצרת, עוד קצת');
  }
}

function collectProduce(a) {
  askProblem('harvest', (res) => {
    const gain = a.collect(nowMs());
    Game.addCoins(gain);
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
    grantReward({ x: 0, y: 3, z: -12 }, res);
    saveAll();
  });
}

// הלבשת סוס (אביזר)
function handleDress(horse, emoji) {
  askProblem('buy', (res) => {
    horse.setAccessory(emoji);
    horse.celebrate();
    World.showAction(horse.group.position.clone(), emoji || '👒');
    World.spawnParticles(horse.group.position.clone(), 'sparkle', 10);
    Audio.pop();
    UI.toast(emoji ? '👒 איזה יופי!' : 'הורדנו את האביזר', false);
    grantReward(horse.group.position.clone(), res);
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
    const gain = 22;
    Game.addCoins(gain);
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

// מיני-משחק מירוץ סוסים — עונים מהר על תרגילים והסוס מתקדם לקו הסיום
function startRace() {
  let step = 0; const total = 6;
  UI.raceBar(step, total);
  Audio.speak('מירוץ! פתרי מהר כדי להגיע ראשונה');
  const next = () => {
    if (step >= total) {
      UI.raceBar(total, total);
      const prize = 25 + Game.level * 2;
      Game.coins += prize; Game.stars += 1; Game.save();
      Audio.fanfare();
      setTimeout(() => { UI.raceEnd(prize); UI.updateHUD(Game); saveAll(); }, 500);
      return;
    }
    const p = generateProblem(Game.difficulty());
    UI.askMath(p, 'race', (res) => {
      if (res.correct) {
        Game.recordResult(p.type, res.firstTry); questBump('solve');
        step++; UI.raceBar(step, total);
        setTimeout(next, 250);
      } else { UI.raceClear(); }   // ביטול → סיום שקט
    });
  };
  next();
}

// עזר ליצירת חלקיקים בנקודת קרקע
function spawnAt(x, z, kind, count) {
  World.spawnParticles({ x, y: 1, z }, kind, count);
}

// ---------- טיפול בחלקת שדה ----------
function handlePlot(plot) {
  if (plot.state === 'empty') {
    UI.chooseCrop(Game, (key) => startPlant(plot, key));
  } else if (plot.state === 'growing') {
    UI.toast('🌱 עוד ' + plot.remainingSec(nowMs()) + ' שניות לגדילה', false);
    Audio.speak('עוד קצת והגידול יהיה מוכן');
  } else if (plot.state === 'ready') {
    startHarvest(plot);
  }
}

function startPlant(plot, cropKey) {
  const def = CROPS[cropKey];
  if (!Game.canAfford(def.seedCost)) { notEnough(def.seedCost); return; }
  askProblem('plant', (res) => {
    if (!Game.spend(def.seedCost)) return;
    plot.plant(Object.assign({ key: cropKey }, def), nowMs());
    questBump('plant');
    World.showAction({ x: plot.pos.x, y: 0, z: plot.pos.z }, '🌱');
    spawnAt(plot.pos.x, plot.pos.z, 'sparkle', 10);
    Audio.pop(); Audio.speak('שתלת ' + def.name + '. עכשיו צריך לחכות שיגדל');
    UI.toast('🌱 שתלת ' + def.name + '!', false);
    grantReward({ x: plot.pos.x, y: 1, z: plot.pos.z }, res);
    saveAll();
  });
}

function startHarvest(plot) {
  askProblem('harvest', (res) => {
    const key = plot.harvest();
    const gain = Game.sellCrop(key);
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

// ---------- בחירה (הקלקה/נגיעה, להבדיל מגרירת מצלמה) ----------
let downX = 0, downY = 0, downT = 0;
canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); });
canvas.addEventListener('pointerup', (e) => {
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  const dt = performance.now() - downT;
  if (moved < 12 && dt < 450) {
    Audio.resume();
    const hit = World.pickAt(e.clientX, e.clientY);
    if (!hit) return;
    const ud = hit.object.userData;
    if (ud.horse) { Audio.animalSound('horse'); ud.horse.celebrate(); UI.showHorseCard(ud.horse, Game); }
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
  const t = performance.now() / 1000;
  for (let i = 0; i < areaUpdaters.length; i++) areaUpdaters[i](t, dt);
  World.render();
  requestAnimationFrame(loop);
}
loop();
