// models3d.js — מחליף ציורים שטוחים במודלים תלת-ממדיים, בלי לגעת בקוד שיצר אותם.
//
// World.makeBillboard הוא המקום היחיד שבו נוצר כל ציור בעולם. כשיש לציור מודל במניפסט,
// המודל נטען ו"עוקב" אחרי הציור בכל פריים: מיקום, גודל, נראות, והסרה מהסצנה.
// הציור עצמו נשאר (בלתי נראה) — לכן נגיעה, גרירה במצב עיצוב, גדילת גידולים ותנועת חיות
// ממשיכים לעבוד בדיוק כמו קודם. ציור בלי מודל נשאר ציור. מודל שלא נטען → נשאר ציור.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = 'assets/models/';

// key = שם קובץ הציור. file = המודל. fit = גובה המודל ביחס לגובה הציור
// (הציורים כוללים שוליים ריקים, לכן בדרך כלל פחות מ-1). yaw = סיבוב קבוע, spin = סיבוב אקראי לגיוון.
// anim = שמות הקליפים {idle, walk}. נמלא לפי מה שנמצא (ראו assets/models/CREDITS.txt).
const HORSE_BROWN = { Main: 0x9a5b2e, Main_Light: 0xc08a5c, Hair: 0x4a2a17, Muzzle: 0x6b3f22 };

const ANIM = { idle: 'Idle', walk: 'Walk' };
const MANIFEST = {
  // --- חיות (שלד + אנימציות) ---
  'cow.png':      { file: 'cow.glb', fit: 0.8, anim: ANIM },
  'sheep.png':    { file: 'sheep.glb', fit: 0.75, anim: ANIM },
  'pig.png':      { file: 'pig.glb', fit: 0.7, anim: ANIM },
  'chicken.png':  { file: 'chicken.glb', fit: 1.0, anim: ANIM },
  'rabbit.png':   { file: 'rabbit.glb', fit: 1.0, anim: ANIM },
  'cat.png':      { file: 'cat.glb', fit: 1.0, anim: ANIM },
  'dog.png':      { file: 'dog.glb', fit: 0.95, anim: ANIM },
  'fox.png':      { file: 'fox.glb', fit: 0.75, anim: ANIM },
  'deer.png':     { file: 'deer.glb', fit: 0.85, anim: ANIM },
  'turkey.png':   { file: 'turkey.glb', fit: 0.75 },
  // --- דמויות ---
  'shopkeeper.png': { file: 'shopkeeper.glb', fit: 0.85, anim: ANIM },
  'npc_vet.png':    { file: 'vet.glb', fit: 0.85, anim: ANIM },
  'npc_baker.png':  { file: 'baker.glb', fit: 0.85, anim: ANIM },
  // --- טבע ---
  'tree.png':         { file: 'tree.glb', fit: 0.95, spin: true, sway: true },
  'oak_tree.png':     { file: 'oak_tree.glb', fit: 0.95, spin: true, sway: true },
  'pine_tree.png':    { file: 'pine_tree.glb', fit: 0.95, spin: true, sway: true },
  'bush.png':         { file: 'bush.glb', fit: 0.8, spin: true, sway: true },
  'flower_bush.png':  { file: 'flower_bush.glb', fit: 0.8, spin: true, sway: true },
  'flowers_wild.png': { file: 'flowers_wild.glb', fit: 0.75, spin: true, sway: true },
  'grass_tuft.png':   { file: 'grass_tuft.glb', fit: 0.7, spin: true, sway: true },
  'rock.png':         { file: 'rock.glb', fit: 0.7, spin: true },
  'mushroom.png':     { file: 'mushroom.glb', fit: 0.8, spin: true },
  'cloud.png':        { file: 'cloud.glb', fit: 0.6 },
  // --- חווה ורכוש ---
  'barn.png':         { file: 'barn.glb', fit: 0.85 },
  'barn_big.png':     { file: 'barn_big.glb', fit: 0.85 },
  'silo.png':         { file: 'silo.glb', fit: 0.9 },
  'windmill.png':     { file: 'windmill.glb', fit: 0.9 },
  'well.png':         { file: 'well.glb', fit: 0.85 },
  'hay_bale.png':     { file: 'hay_bale.glb', fit: 0.7, spin: true },
  'trough.png':       { file: 'trough.glb', fit: 0.7 },
  'water_bucket.png': { file: 'water_bucket.glb', fit: 0.7 },
  'watering_can.png': { file: 'watering_can.glb', fit: 0.7 },
  'feed_sack.png':    { file: 'feed_sack.glb', fit: 0.4 },
  'doghouse.png':     { file: 'doghouse.glb', fit: 0.8 },
  'farm_gate.png':    { file: 'farm_gate.glb', fit: 0.6 },
  'signpost.png':     { file: 'signpost.glb', fit: 0.85 },
  'fountain.png':     { file: 'fountain.glb', fit: 0.8 },
  'bench.png':        { file: 'bench.glb', fit: 0.6 },
  'lamp_post.png':    { file: 'lamp_post.glb', fit: 0.95 },
  'cone.png':         { file: 'cone.glb', fit: 0.7 },
  'cottage.png':      { file: 'cottage.glb', fit: 0.85 },
  'bakery.png':       { file: 'bakery.glb', fit: 0.85 },
  'gem.png':          { file: 'gem.glb', fit: 0.7 },
  // אין מודל לבריכה: מים שטוחים על הקרקע (ציור עומד נראה כמו פס כחול מהצד)
  'pond.png':         { water: true },
  // --- גידולים (הציור גדל בשדה — המודל גדל איתו) ---
  'carrot.png':     { file: 'carrot.glb', fit: 0.8, spin: true },
  'wheat.png':      { file: 'wheat.glb', fit: 0.85, spin: true, sway: true },
  'strawberry.png': { file: 'strawberry.glb', fit: 0.75, spin: true },
  'corn.png':       { file: 'corn.glb', fit: 0.9, spin: true, sway: true },
  'pumpkin.png':    { file: 'pumpkin.glb', fit: 0.7, spin: true },
  'apple.png':      { file: 'apple.glb', fit: 0.9, spin: true },
  // --- סוסים שהם תפאורה (הסוסים של השחקנית: horse3d.js) ---
  'horse_jump.png': { file: 'horse.glb', fit: 0.62, yaw: -1.2, anim: { idle: 'Gallop_Jump' }, colors: HORSE_BROWN },
  'pony.png':       { file: 'horse.glb', fit: 0.85, anim: { idle: 'Idle', walk: 'Walk' }, colors: { Main: 0xe8c48a, Main_Light: 0xf6e3bf, Hair: 0xfff3d6 } },
};

const _bufs = {};        // file → Promise<ArrayBuffer>
const _static = {};      // file → Promise<gltf> (לשכפול זול של מודל בלי שלד)
const links = [];

function fetchBuf(file) {
  if (!_bufs[file]) _bufs[file] = fetch(BASE + file).then(r => { if (!r.ok) throw new Error(file + ' ' + r.status); return r.arrayBuffer(); });
  return _bufs[file];
}
function parse(buf) { return new Promise((res, rej) => new GLTFLoader().parse(buf.slice(0), '', res, rej)); }

// מודל עם שלד חייב עותק עצמאי (שלד משלו); מודל סטטי משוכפל מאותו מקור (גאומטריה וחומרים משותפים)
async function instance(file) {
  const buf = await fetchBuf(file);
  if (!_static[file]) _static[file] = parse(buf);
  const src = await _static[file];
  let skinned = false;
  src.scene.traverse(o => { if (o.isSkinnedMesh) skinned = true; });
  if (!skinned) return { scene: src.scene.clone(true), animations: [] };
  return parse(buf);
}

// התאורה כוונה לציורים (שלא מושפעים מאור), ולכן מודלים נראים כהים לידם.
// זוהר עדין בצבע החומר עצמו מחזיר את הבהירות בלי לשטוף את הדשא ושאר העולם.
const GLOW = 0.32;
function brighten(m) {
  if (!m || !m.emissive || m.userData._glow) return;
  m.userData._glow = true;
  if (m.map) { m.emissiveMap = m.map; m.emissive.setRGB(GLOW, GLOW, GLOW); }
  else if (m.color) m.emissive.copy(m.color).multiplyScalar(GLOW);
}

// משטח מים שטוח: אליפסה בגובה 1 (הסנכרון מקנה לו את גודל הציור), עם שוליים בהירים
function waterDisc() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40), new THREE.MeshStandardMaterial({ color: 0xd8c89a, roughness: 1 }));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.56, 40),
    new THREE.MeshStandardMaterial({ color: 0x4fb3e8, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.92, emissive: 0x1a5f8a, emissiveIntensity: 0.4 }));
  rim.rotation.x = water.rotation.x = -Math.PI / 2;
  rim.position.y = 0.02; water.position.y = 0.035;
  rim.scale.set(1.5, 1, 1); water.scale.set(1.5, 1, 1);   // אליפסה
  rim.receiveShadow = water.receiveShadow = true;
  g.add(rim, water);
  // תיבת גבולות בגובה 1 כדי שהנרמול לא ימתח את השטוח לגובה
  const probe = new THREE.Mesh(new THREE.BoxGeometry(0.01, 1, 0.01), new THREE.MeshBasicMaterial({ visible: false }));
  probe.position.y = 0.5; g.add(probe);
  return g;
}

function keyOf(url) { const m = /([a-z0-9_]+\.png)$/i.exec(url || ''); return m ? m[1] : null; }

function visibleChain(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
function inScene(o, scene) { for (let p = o; p; p = p.parent) if (p === scene) return true; return false; }

const Models3D = {
  enabled: true,
  scene: null,

  has(url) { return this.enabled && !!MANIFEST[keyOf(url)]; },

  // נקרא מ-makeBillboard: sp הוא הציור, height הגובה שביקשו לו
  attach(sp, url, height) {
    const key = keyOf(url);
    const def = this.enabled && MANIFEST[key];
    if (!def) return;
    const link = { sp, def, key, h0: height, model: null, mixer: null, actions: {}, cur: null, last: null, yaw: 0 };
    links.push(link);
    (def.water ? Promise.resolve({ scene: waterDisc(), animations: [] }) : instance(def.file)).then(g => {
      const root = g.scene;
      root.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        if (o.isSkinnedMesh) o.frustumCulled = false;
        // מודלים רבים יוצאים "מתכתיים" ונראים כהים בלי השתקפויות — הופכים הכל למט
        const arr = (Array.isArray(o.material) ? o.material : [o.material]).map(m => {
          // colors: צבע לפי שם חומר (אותו מודל משמש כמה חיות/צבעים) — עותק כדי לא לצבוע מופעים אחרים
          if (def.colors && def.colors[m.name] != null) { m = m.clone(); m.color.setHex(def.colors[m.name]); }
          if ('metalness' in m) { m.metalness = 0; m.roughness = Math.max(m.roughness ?? 1, 0.75); }
          brighten(m);
          return m;
        });
        o.material = Array.isArray(o.material) ? arr : arr[0];
      });
      // נרמול: בסיס המודל על הקרקע, גובה 1 יחידה (הגודל האמיתי נקבע בסנכרון)
      const wrap = new THREE.Group();
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const hh = (box.max.y - box.min.y) || 1;
      root.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      const inner = new THREE.Group(); inner.add(root); inner.scale.setScalar(1 / hh);
      wrap.add(inner);
      link.yaw = def.spin ? Math.random() * Math.PI * 2 : (def.yaw || 0);
      wrap.rotation.y = link.yaw;
      if (g.animations && g.animations.length) {
        link.mixer = new THREE.AnimationMixer(root);
        const pick = (name) => name && (g.animations.find(c => c.name === name || c.name.endsWith('|' + name))
          || g.animations.find(c => c.name.includes(name) && !/Gun|Sword|Attack|Death|Punch|HitReact/.test(c.name)));
        for (const k of ['idle', 'walk', 'run']) {
          const clip = pick(def.anim && def.anim[k]);
          if (clip) link.actions[k] = link.mixer.clipAction(clip);
        }
        if (link.actions.idle) { link.actions.idle.play(); link.cur = link.actions.idle; link.actions.idle.time = Math.random() * 2; }
      }
      link.model = wrap;
      sp.material.visible = false;          // הציור נשאר לנגיעה, רק לא מצויר
    }).catch(() => { /* אין מודל → הציור נשאר */ });
  },

  _play(link, name) {
    const a = link.actions[name] || link.actions.idle;
    if (!a || a === link.cur) return;
    a.reset().fadeIn(0.25).play();
    if (link.cur) link.cur.fadeOut(0.25);
    link.cur = a;
  },

  // כל פריים: המודל עוקב אחרי הציור
  sync(dt) {
    if (!this.scene) return;
    const p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = links.length - 1; i >= 0; i--) {
      const L = links[i], sp = L.sp;
      if (!L.model) continue;
      const alive = inScene(sp, this.scene);
      if (!alive) {
        if (L.model.parent) L.model.parent.remove(L.model);
        if (L.everInScene) links.splice(i, 1);   // הוסר מהסצנה אחרי שהיה בה → נשחרר
        continue;
      }
      L.everInScene = true;
      if (!L.model.parent) this.scene.add(L.model);
      L.model.visible = visibleChain(sp);
      if (!L.model.visible) continue;
      sp.getWorldPosition(p); sp.getWorldScale(s);
      const h = Math.abs(s.y) * (L.def.fit ?? 0.85);
      p.y -= sp.center.y * Math.abs(s.y);        // ציור שמרכזו לא בתחתית
      L.model.position.copy(p);
      L.model.scale.setScalar(h * (L.def.scale ?? 1));
      if (L.mixer) {
        // תנועה: הולך לכיוון התנועה; עומד → מנוחה
        let moving = false;
        if (L.last) {
          const dx = p.x - L.last.x, dz = p.z - L.last.z, v = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
          moving = v > 0.25;
          if (moving) {
            const want = Math.atan2(dx, dz) + (L.def.yaw || 0);
            let d = want - L.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
            L.yaw += d * Math.min(1, dt * 6);
            L.model.rotation.y = L.yaw;
          }
        }
        L.last = (L.last || new THREE.Vector3()).copy(p);
        this._play(L, moving ? (L.actions.walk ? 'walk' : 'run') : 'idle');
        L.mixer.update(dt);
      } else if (L.def.sway) {
        // נדנוד עדין ברוח לעצים ושיחים
        const t = performance.now() / 1000 + (L.phase ??= Math.random() * 6);
        L.model.rotation.z = Math.sin(t * 1.3) * 0.02;
      }
    }
  },

  define(entries) { Object.assign(MANIFEST, entries); },
  manifest() { return MANIFEST; }
};

export { Models3D };
