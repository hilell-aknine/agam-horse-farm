// interiors.js — כניסה למבנים: האסם, המאפייה בכפר ובית בכפר.
// כל מבנה הוא "בית בובות": חדר תלת-ממדי עם קיר קדמי פתוח, בסצנה נפרדת שמוחלפת ברינדור.
// בפנים יש דברים לגעת בהם (סוסים בתאים, חציר, חתול, עכבר מתחבא, תנור, ספרים) —
// כל פעולה עוברת דרך askProblem כמו בשאר המשחק. העולם בחוץ ממשיך לחיות (יבול, חיות, שמירה).
import { World, THREE } from '../engine/world.js';
import { Audio } from '../systems/audio.js';
import { Game } from '../systems/game.js';
import { Horse3D } from '../engine/horse3d.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function mat(color, glow = 0.18) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true });
  m.emissive.copy(m.color).multiplyScalar(glow);
  return m;
}
function box(parent, w, h, d, m, x, y, z) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; parent.add(b); return b;
}
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function emoji(e, size) { const s = World.emojiSprite(e, size); s.center.set(0.5, 0); return s; }

// רצפת קרשים: פסים בהירים-כהים
function plankTex(a, b) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(0, i * 32, 256, 32); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, i * 32 + 30, 256, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
}
function plateTex(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = '#7a4f23'; g.beginPath(); g.roundRect(4, 4, 248, 72, 14); g.fill();
  g.fillStyle = '#fff7e6'; g.font = 'bold 40px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(text, 128, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(2.2, 0.69, 1); return s;
}

// מודלי עזר (חציר, חתול...) — טעינה ישירה, בלי מנגנון ההחלפה של העולם הראשי
const loader = new GLTFLoader();
function prop(file, height, opts = {}) {
  const wrap = new THREE.Group();
  loader.loadAsync('assets/models/' + file).then(g => {
    const root = g.scene;
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false;
      const arr = (Array.isArray(o.material) ? o.material : [o.material]).map(m => {
        if ('metalness' in m) { m.metalness = 0; m.roughness = Math.max(m.roughness ?? 1, 0.75); }
        if (m.emissive && m.color) m.emissive.copy(m.color).multiplyScalar(0.25);
        return m;
      });
      o.material = Array.isArray(o.material) ? arr : arr[0];
    });
    root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(root);
    const hh = (bb.max.y - bb.min.y) || 1;
    root.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    const inner = new THREE.Group(); inner.add(root); inner.scale.setScalar(height / hh);
    wrap.add(inner);
    if (g.animations && g.animations.length) {
      const clip = g.animations.find(c => /idle/i.test(c.name) && !/Gun|Sword/.test(c.name)) || g.animations[0];
      wrap.userData.mixer = new THREE.AnimationMixer(root);
      wrap.userData.mixer.clipAction(clip).play();
      wrap.userData.clips = g.animations;
    }
    if (opts.yaw) wrap.rotation.y = opts.yaw;
  }).catch(() => {
    if (opts.fallback) wrap.add(emoji(opts.fallback, height));   // אין מודל → אמוג'י
  });
  return wrap;
}

// ---------- החדרים ----------
const W = 18, D = 10, H = 6.2;   // רוחב, עומק, גובה קיר

function shell(room, o) {
  const floorMat = new THREE.MeshStandardMaterial({ map: plankTex(o.floorA, o.floorB), roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
  const wall = mat(o.wall, 0.22), trim = mat(o.trim, 0.2);
  box(room, W, H, 0.3, wall, 0, H / 2, -D / 2);                 // קיר אחורי
  box(room, 0.3, H, D, wall, -W / 2, H / 2, 0);                 // צדדים
  box(room, 0.3, H, D, wall, W / 2, H / 2, 0);
  box(room, W + 0.4, 0.35, 0.4, trim, 0, H, -D / 2);            // קורות עליונות
  for (const x of [-W / 2, W / 2]) box(room, 0.4, 0.35, D, trim, x, H, 0);
  for (let i = -2; i <= 2; i++) box(room, 0.3, 0.3, D, trim, i * 3.6, H - 0.3, 0);
  // קרש תחתון בחזית (קיר פתוח — רואים פנימה כמו בבית בובות)
  box(room, W, 0.5, 0.25, trim, 0, 0.25, D / 2);
}

function lights(room, warm) {
  room.add(new THREE.HemisphereLight(0xfff4e0, 0x6a4a2a, 0.95));
  const sun = new THREE.DirectionalLight(0xfff0d0, 0.9);
  sun.position.set(6, 14, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  room.add(sun);
  const lamp = new THREE.PointLight(warm, 1.4, 16, 1.6); lamp.position.set(0, H - 1, 0); room.add(lamp);
  return lamp;
}

// ---------- ערכת האסם: קרשים, קורות גג, מתבן, דלת הזזה, אור שמש מבעד לדלת ----------
// הכל פרימיטיבים של Three.js בסגנון השטוח של המשחק. קופסאות חוזרות נאספות ל-InstancedMesh
// (קריאת ציור אחת לכל חומר) כדי שהטלפון לא ייחנק.
function bm(color, glow = 0.32) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true });
  m.emissive.copy(m.color).multiplyScalar(glow);
  return m;
}
function tm(tex, glow = 0.3, extra = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ map: tex, roughness: 0.85, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: glow }, extra));
}
function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function toTex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
}
// מספר אקראי קבוע (אותו אסם בכל כניסה)
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function shade(hex, k) {
  const r = Math.min(255, Math.max(0, ((hex >> 16) & 255) * k)), g = Math.min(255, Math.max(0, ((hex >> 8) & 255) * k)), b = Math.min(255, Math.max(0, (hex & 255) * k));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
// קרשים אנכיים: גוון שונה לכל קרש, סיבים, עיניים, חריצים ומסמרים
function drawBoards(g, w, h, n, base, r) {
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    const x = i * bw;
    g.fillStyle = shade(base, 0.86 + r() * 0.28); g.fillRect(x, 0, bw, h);
    g.strokeStyle = 'rgba(40,20,8,.16)'; g.lineWidth = 1.5;
    for (let k = 0; k < 5; k++) {
      let gx = x + 4 + r() * (bw - 8); g.beginPath(); g.moveTo(gx, 0);
      for (let y = 0; y <= h; y += 32) { gx += (r() - 0.5) * 3; g.lineTo(gx, y); }
      g.stroke();
    }
    if (r() < 0.45) { g.fillStyle = 'rgba(50,25,10,.35)'; g.beginPath(); g.ellipse(x + bw * (0.3 + r() * 0.4), r() * h, 4, 9, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,240,210,.10)'; g.fillRect(x + 3, 0, 3, h);           // שוליים בהירים
    g.fillStyle = 'rgba(20,8,2,.55)'; g.fillRect(x, 0, 3, h);                    // חריץ
    g.fillStyle = 'rgba(30,30,35,.7)';
    for (const y of [h * 0.08, h * 0.5, h * 0.92]) { g.beginPath(); g.arc(x + bw * 0.3, y, 2.5, 0, 7); g.arc(x + bw * 0.7, y, 2.5, 0, 7); g.fill(); }
  }
}
function boardTex(base, n, rx, ry, seed = 1) {
  const [c, g] = cvs(512, 512); drawBoards(g, 512, 512, n, base, rng(seed)); return toTex(c, rx, ry);
}
function strawStrokes(g, r, n, x0, y0, w, h, cols, len = [8, 22]) {
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w, y = y0 + r() * h, a = r() * Math.PI, l = len[0] + r() * (len[1] - len[0]);
    g.strokeStyle = cols[(r() * cols.length) | 0]; g.lineWidth = 1.5 + r() * 1.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}
const STRAW = ['#e8c66a', '#d9b050', '#f3da8a', '#c49a3e', '#ead08a'];
// רצפה: קרשים רחבים ושאריות קש מפוזרות
function barnFloorTex() {
  const [c, g] = cvs(512, 512), r = rng(7);
  drawBoards(g, 512, 512, 6, 0xa27142, r);
  g.globalAlpha = 0.55; strawStrokes(g, r, 260, 0, 0, 512, 512, STRAW, [6, 18]); g.globalAlpha = 1;
  const t = toTex(c, 3, 1.6); t.rotation = Math.PI / 2; return t;
}
// קש שקוף לשפוך על הרצפה (מצע בתאים, שאריות)
function looseStrawTex(seed) {
  const [c, g] = cvs(256, 256), r = rng(seed);
  for (let i = 0; i < 900; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * 118;
    const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d * 0.9, b = r() * Math.PI, l = 8 + r() * 18;
    g.strokeStyle = STRAW[(r() * STRAW.length) | 0]; g.lineWidth = 1.5 + r() * 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function baleTex() {
  const [c, g] = cvs(128, 128), r = rng(3);
  g.fillStyle = '#d6b257'; g.fillRect(0, 0, 128, 128);
  strawStrokes(g, r, 380, -10, -4, 148, 136, ['#e8c66a', '#c79f45', '#f1d68a', '#b98f3a'], [10, 26]);
  g.strokeStyle = 'rgba(90,60,20,.35)'; g.lineWidth = 6; g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// מדרג שקיפות לאלומות אור
function shaftTex() {
  const [c, g] = cvs(64, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,236,190,0.95)'); gr.addColorStop(0.6, 'rgba(255,226,170,0.45)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.18, 'rgba(0,0,0,0)'); side.addColorStop(0.82, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = side; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}
function softRectTex() {
  const [c, g] = cvs(128, 128);
  const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,230,170,1)'); gr.addColorStop(0.65, 'rgba(255,220,150,0.6)'); gr.addColorStop(1, 'rgba(255,210,140,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
// אור יום שנראה מבעד לפתח: שמיים, גבעה ירוקה
function daylightTex() {
  const [c, g] = cvs(64, 128);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#bfe6ff'); gr.addColorStop(0.55, '#fff4d6'); gr.addColorStop(0.62, '#a9d86e'); gr.addColorStop(1, '#6fb24a');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function additive(tex, color, opacity) {
  return new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
}
// אוסף קופסאות/גלילים חוזרים → InstancedMesh אחד לכל (גאומטריה, חומר)
function batcher() {
  const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  const groups = new Map();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const add = (geo, m, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
    let list = groups.get(m)?.get(geo);
    if (!list) { if (!groups.has(m)) groups.set(m, new Map()); list = []; groups.get(m).set(geo, list); }
    e.set(rx, ry, rz); q.setFromEuler(e);
    list.push(m4.compose(p.set(x, y, z), q, s.set(sx, sy, sz)).clone());
  };
  return {
    box: (m, w, h, d, x, y, z, rx, ry, rz) => add(BOX, m, x, y, z, w, h, d, rx, ry, rz),
    cyl: (m, r, h, x, y, z, rx, ry, rz) => add(CYL, m, x, y, z, r * 2, h, r * 2, rx, ry, rz),
    flush(parent, shadow = true) {
      for (const [m, byGeo] of groups) for (const [geo, list] of byGeo) {
        const im = new THREE.InstancedMesh(geo, m, list.length);
        list.forEach((mm, i) => im.setMatrixAt(i, mm));
        im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false;
        parent.add(im);
      }
      groups.clear();
    }
  };
}
// דלת עם צלב X לבן (הסימן המוכר של אסם). plane: 'xy' = פונה ל-+z, 'zy' = פונה ל-−x
function crossDoor(B, panel, trim, cx, cy, cz, w, h, plane = 'xy') {
  const t = 0.13, d = 0.08, L = Math.hypot(w - t * 2, h - t * 2), a = Math.atan2(h - t * 2, w - t * 2);
  if (plane === 'xy') {
    B.box(panel, w, h, 0.08, cx, cy, cz);
    B.box(trim, w, t, d, cx, cy + h / 2 - t / 2, cz + 0.07); B.box(trim, w, t, d, cx, cy - h / 2 + t / 2, cz + 0.07);
    B.box(trim, t, h, d, cx - w / 2 + t / 2, cy, cz + 0.07); B.box(trim, t, h, d, cx + w / 2 - t / 2, cy, cz + 0.07);
    B.box(trim, L, t, d, cx, cy, cz + 0.08, 0, 0, a); B.box(trim, L, t, d, cx, cy, cz + 0.08, 0, 0, -a);
  } else {
    B.box(panel, 0.08, h, w, cx, cy, cz);
    B.box(trim, d, t, w, cx - 0.07, cy + h / 2 - t / 2, cz); B.box(trim, d, t, w, cx - 0.07, cy - h / 2 + t / 2, cz);
    B.box(trim, d, h, t, cx - 0.07, cy, cz - w / 2 + t / 2); B.box(trim, d, h, t, cx - 0.07, cy, cz + w / 2 - t / 2);
    B.box(trim, d, t, L, cx - 0.08, cy, cz, a, 0, 0); B.box(trim, d, t, L, cx - 0.08, cy, cz, -a, 0, 0);
  }
}
function plateMesh(text) {
  const [c, g] = cvs(256, 80);
  g.fillStyle = '#3e220c'; g.beginPath(); g.roundRect(2, 2, 252, 76, 12); g.fill();
  g.fillStyle = '#7a4f23'; g.beginPath(); g.roundRect(7, 7, 242, 66, 9); g.fill();
  g.fillStyle = '#fff3d6'; g.font = 'bold 40px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(text, 128, 43);
  g.fillStyle = '#8a8f96'; for (const x of [20, 236]) { g.beginPath(); g.arc(x, 40, 4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
}
function bale(parent, mats, w, h, d, x, y, z, yaw = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.bale);
  b.position.set(x, y, z); b.rotation.y = yaw; b.castShadow = true; b.receiveShadow = true; parent.add(b);
  for (const k of [-0.27, 0.27]) {                          // שני חוטי קשירה
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.035, h + 0.02, d + 0.02), mats.twine);
    s.position.x = k * w; b.add(s);
  }
  return b;
}
function lantern(room, mats, x, y, z, chain) {
  const g = new THREE.Group(); g.position.set(x, y, z); room.add(g);
  const add = (geo, m, py) => { const o = new THREE.Mesh(geo, m); o.position.y = py; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.03, 0.03, chain, 4), mats.iron, chain / 2 + 0.3);
  add(new THREE.TorusGeometry(0.1, 0.018, 4, 10, Math.PI), mats.iron, 0.22);
  add(new THREE.ConeGeometry(0.2, 0.16, 6), mats.iron, 0.16);
  add(new THREE.CylinderGeometry(0.14, 0.14, 0.34, 6), mats.glass, -0.09);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 6), mats.iron, -0.28);
  for (let i = 0; i < 3; i++) { const b = add(new THREE.BoxGeometry(0.02, 0.36, 0.02), mats.iron, -0.09); const a = i * Math.PI * 2 / 3; b.position.x = Math.cos(a) * 0.15; b.position.z = Math.sin(a) * 0.15; }
  return g;
}

function buildBarn(I, room, deps) {
  room.background = new THREE.Color(0x231812);
  room.fog = new THREE.Fog(0x231812, 30, 62);
  const B = batcher();
  const HB = H;                                   // גובה הקירות
  const RIDGE = H + 3.2;                          // שיא הגג
  const M = {
    wall: tm(boardTex(0xa8492f, 8, 3, 1, 11), 0.3),
    side: tm(boardTex(0xa8492f, 8, D / 6, 1, 12), 0.3),
    gable: null,
    beam: bm(0x6b4122), beamDark: bm(0x553219, 0.28),
    wood: bm(0x9a6a3a), woodLight: bm(0xb88a55),
    doorPanel: tm(boardTex(0xb24e33, 5, 1, 1, 21), 0.3),
    white: bm(0xf3ead8, 0.3),
    iron: bm(0x4a4a50, 0.2), metal: bm(0x9aa0a8, 0.3),
    leather: bm(0x6b3a1e), leatherDark: bm(0x4a2614, 0.28), blanket: bm(0x2f6fb0),
    bale: tm(baleTex(), 0.32), twine: bm(0x7a5a2a, 0.2),
    hay: bm(0xe2bd5c), green: bm(0x3f8f5a), water: bm(0x4aa3d8, 0.45),
    glass: new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.6, roughness: 0.4, transparent: true, opacity: 0.92 }),
    roof: tm(boardTex(0x7a4a2a, 8, 1, 1, 31), 0.22, { side: THREE.DoubleSide })
  };
  M.roof.map.repeat.set(1, 3); M.roof.emissiveMap = M.roof.map;
  const gtex = boardTex(0xa8492f, 8, 1 / 6, 1 / 3.2, 13); gtex.offset.set(0.5, 0);
  M.gable = tm(gtex, 0.3);

  // ---- רצפה + מצע קש ----
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), tm(barnFloorTex(), 0.26, { roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
  const strawMats = [1, 2, 3].map(s => new THREE.MeshStandardMaterial({ map: looseStrawTex(40 + s), transparent: true, alphaTest: 0.25, depthWrite: false, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.3 }));
  strawMats.forEach(m => { m.emissiveMap = m.map; });
  const straw = (x, z, sx, sz, k, rot = 0, y = 0.02) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), strawMats[k % 3]);
    p.rotation.set(-Math.PI / 2, 0, rot); p.position.set(x, y, z); p.receiveShadow = true; room.add(p);
  };

  // ---- קירות: קרשים אנכיים + עמודים + קורות רוחב ----
  const wallMesh = (geo, m, x, y, z) => { const w = new THREE.Mesh(geo, m); w.position.set(x, y, z); w.receiveShadow = true; room.add(w); return w; };
  wallMesh(new THREE.BoxGeometry(W, HB, 0.3), M.wall, 0, HB / 2, -D / 2);
  wallMesh(new THREE.BoxGeometry(0.3, HB, D), M.side, -W / 2, HB / 2, 0);
  // קיר ימין עם פתח לדלת ההזזה (z בין 0.8 ל-2.6 פתוח לגמרי)
  const OPEN0 = 0.8, OPEN1 = 2.6, DOOR_H = 3.9;
  const segA = new THREE.Mesh(new THREE.BoxGeometry(0.3, HB, OPEN0 + D / 2), tm(boardTex(0xa8492f, 8, (OPEN0 + D / 2) / 6, 1, 14), 0.3));
  segA.position.set(W / 2, HB / 2, (-D / 2 + OPEN0) / 2); segA.receiveShadow = true; room.add(segA);
  const segB = new THREE.Mesh(new THREE.BoxGeometry(0.3, HB, D / 2 - OPEN1), tm(boardTex(0xa8492f, 8, (D / 2 - OPEN1) / 6, 1, 15), 0.3));
  segB.position.set(W / 2, HB / 2, (D / 2 + OPEN1) / 2); segB.receiveShadow = true; room.add(segB);
  B.box(M.side, 0.3, HB - DOOR_H, OPEN1 - OPEN0, W / 2, (HB + DOOR_H) / 2, (OPEN0 + OPEN1) / 2);
  // גמלון משולש מעל הקיר האחורי
  const tri = new THREE.Shape(); tri.moveTo(-W / 2, HB); tri.lineTo(W / 2, HB); tri.lineTo(0, RIDGE); tri.closePath();
  const gable = new THREE.Mesh(new THREE.ShapeGeometry(tri), M.gable); gable.position.z = -D / 2 + 0.16; room.add(gable);
  // עמודים וקורות על הקירות
  for (const z of [-D / 2 + 0.25, -1.2, OPEN0 - 0.2, OPEN1 + 0.2, D / 2 - 0.2]) for (const s of [-1, 1]) B.box(M.beam, 0.32, HB, 0.32, s * (W / 2 - 0.2), HB / 2, z);
  for (const x of [-W / 2 + 0.2, -4.5, 4.5, W / 2 - 0.2]) B.box(M.beam, 0.32, HB, 0.3, x, HB / 2, -D / 2 + 0.2);
  for (const y of [2.3, 4.6]) {
    B.box(M.beamDark, W, 0.22, 0.2, 0, y, -D / 2 + 0.25);
    B.box(M.beamDark, 0.2, 0.22, D, -W / 2 + 0.25, y, 0);
    B.box(M.beamDark, 0.2, 0.22, OPEN0 + D / 2 - 0.3, W / 2 - 0.25, y, (-D / 2 + OPEN0) / 2);
    B.box(M.beamDark, 0.2, 0.22, D / 2 - OPEN1, W / 2 - 0.25, y, (D / 2 + OPEN1) / 2);
  }
  B.box(M.beam, 0.4, 0.4, D, -W / 2, HB, 0); B.box(M.beam, 0.4, 0.4, D, W / 2, HB, 0);
  B.box(M.beam, W + 0.4, 0.4, 0.4, 0, HB, -D / 2);
  // קרש בסיס בחזית (בית בובות פתוח)
  B.box(M.beamDark, W, 0.45, 0.3, 0, 0.22, D / 2);

  // ---- גג: מסבכים (קורה תחתונה, עמוד מלך, קורות משופעות), רכס ומרישים ----
  const slopeL = Math.hypot(W / 2, RIDGE - HB), slopeA = Math.atan2(RIDGE - HB, W / 2);
  const COLLAR = HB + 1.6;
  for (const z of [-D / 2 + 0.3, -1.6, 1.5]) {
    const front = z > 0;                          // המסבך הקדמי: קורת קשר גבוהה בלבד, כדי לא להסתיר את המתבן
    for (const s of [-1, 1]) B.box(M.beam, slopeL + 0.3, 0.32, 0.28, s * W / 4, (HB + RIDGE) / 2 + 0.1, z, 0, 0, -s * slopeA);
    if (front) { B.box(M.beam, W / 2 + 0.4, 0.26, 0.24, 0, COLLAR, z); continue; }
    B.box(M.beam, W, 0.3, 0.26, 0, HB + 0.05, z);
    B.box(M.beam, 0.24, RIDGE - HB, 0.24, 0, (HB + RIDGE) / 2, z);
    for (const s of [-1, 1]) B.box(M.beamDark, 3.6, 0.18, 0.2, s * 1.9, HB + 1.15, z, 0, 0, s * 0.62);   // תמוכות אלכסוניות
  }
  B.box(M.beam, 0.3, 0.3, D * 0.75, 0, RIDGE - 0.05, -D / 2 + D * 0.375);
  for (const s of [-1, 1]) for (const f of [0.3, 0.62]) {
    B.box(M.beamDark, 0.2, 0.2, D * 0.72, s * W / 2 * (1 - f), HB + (RIDGE - HB) * f + 0.28, -D / 2 + D * 0.36);
  }
  // לוחות גג מאחור בלבד — החזית נשארת פתוחה לצפייה
  for (const s of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(slopeL + 0.4, 4.2), M.roof);
    roof.position.set(s * W / 4, (HB + RIDGE) / 2 + 0.32, -D / 2 + 2.1);
    roof.rotation.order = 'ZYX'; roof.rotation.set(-Math.PI / 2, 0, -s * slopeA);
    room.add(roof);
  }

  // ---- דלת המתבן בגמלון: פתוחה אל אור היום ----
  const day = new THREE.MeshBasicMaterial({ map: daylightTex(), fog: false });
  const loftWin = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.7), day); loftWin.position.set(0, HB + 1.25, -D / 2 + 0.2); room.add(loftWin);
  for (const [w, h, x, y] of [[2.1, 0.16, 0, HB + 2.15], [2.1, 0.16, 0, HB + 0.38], [0.16, 1.9, -1.0, HB + 1.25], [0.16, 1.9, 1.0, HB + 1.25]]) B.box(M.white, w, h, 0.12, x, y, -D / 2 + 0.25);
  // כנפי הדלת פתוחות לצדדים
  crossDoor(B, M.doorPanel, M.white, -1.95, HB + 1.25, -D / 2 + 0.32, 0.95, 1.7);
  crossDoor(B, M.doorPanel, M.white, 1.95, HB + 1.25, -D / 2 + 0.32, 0.95, 1.7);
  B.box(M.beamDark, 0.16, 0.16, 1.0, 0, HB + 2.55, -D / 2 + 0.6);                     // זרוע הגלגלת
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 4), M.twine); rope.position.set(0, HB + 1.85, -D / 2 + 1.05); room.add(rope);

  // ---- מתבן מעל התאים + סולם ----
  const LOFT_Y = 3.55, LOFT_Z0 = -D / 2 + 0.15, LOFT_Z1 = -3.35;
  const loft = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.2, LOFT_Z1 - LOFT_Z0), tm(boardTex(0x9a6a3a, 8, 4, 1, 41), 0.3));
  loft.position.set(0, LOFT_Y, (LOFT_Z0 + LOFT_Z1) / 2); loft.receiveShadow = true; room.add(loft);
  B.box(M.beam, W - 0.3, 0.34, 0.3, 0, LOFT_Y - 0.2, LOFT_Z1);
  for (const x of [-7.2, -3.6, 0, 3.6, 7.2]) {
    B.box(M.beam, 0.26, LOFT_Y - 0.2, 0.26, x, (LOFT_Y - 0.2) / 2, LOFT_Z1);
    if (x > -7) B.box(M.beam, 0.14, 0.9, 0.14, x, LOFT_Y + 0.45, LOFT_Z1 + 0.05);     // מעקה (משאירים פתח לסולם)
  }
  B.box(M.beam, 14.6, 0.14, 0.14, 0.15, LOFT_Y + 0.85, LOFT_Z1 + 0.05);
  B.box(M.beam, 14.6, 0.1, 0.1, 0.15, LOFT_Y + 0.45, LOFT_Z1 + 0.05);
  // חבילות קש מלבניות על המתבן
  const balesLoft = [[-5.6, 0, -0.1], [-4.1, 0, 0.15], [-2.4, 0, -0.05], [2.2, 0, 0.1], [3.8, 0, -0.1], [5.4, 0, 0.05], [6.9, 0, -0.08],
    [-4.8, 1, 0.1], [-3.2, 1, -0.06], [3.0, 1, 0.03], [4.6, 1, -0.1], [6.1, 1, 0.12], [3.8, 2, 0]];
  for (const [x, lvl, yaw] of balesLoft) {
    const y = LOFT_Y + 0.1 + 0.33 + lvl * 0.64, z = -4.35 + (lvl === 1 ? -0.1 : 0);
    B.box(M.bale, 1.45, 0.64, 0.82, x, y, z, 0, yaw, 0);
    for (const k of [-0.36, 0.36]) B.box(M.twine, 0.04, 0.66, 0.84, x + Math.cos(yaw) * k, y, z - Math.sin(yaw) * k, 0, yaw, 0);
  }
  straw(0.0, -4.2, 3.2, 1.6, 0, 0.3, LOFT_Y + 0.11); straw(-7.4, -4.0, 2.4, 1.4, 1, 1.0, LOFT_Y + 0.11);
  // סולם שנשען על המתבן
  {
    const top = new THREE.Vector3(-8.2, LOFT_Y + 0.9, LOFT_Z1 + 0.05), bot = new THREE.Vector3(-8.2, 0, -1.5);
    const len = top.distanceTo(bot), ang = Math.atan2(top.z - bot.z, top.y - bot.y);   // הטיה סביב x
    const mid = top.clone().add(bot).multiplyScalar(0.5);
    for (const dx of [-0.32, 0.32]) B.box(M.woodLight, 0.1, len, 0.12, mid.x + dx, mid.y, mid.z, ang, 0, 0);
    for (let i = 1; i < 8; i++) { const f = i / 8; B.box(M.woodLight, 0.64, 0.07, 0.07, bot.x, bot.y + (top.y - bot.y) * f, bot.z + (top.z - bot.z) * f); }
  }

  // ---- תאי הסוסים: מחיצות קרשים, דלתות-חצי עם X, שלט שם, אבוס ודלי ----
  const horses = deps.Horses.list.slice(0, 4);
  for (const x of [-7.2, -3.6, 0, 3.6, 7.2]) {
    B.box(M.wood, 0.16, 1.55, 3.3, x, 0.78, -3.2);
    B.box(M.beam, 0.22, 0.14, 3.4, x, 1.6, -3.2);
    B.box(M.beam, 0.24, 2.25, 0.24, x, 1.12, -1.45);
    B.box(M.beamDark, 0.34, 0.1, 0.34, x, 2.28, -1.45);
  }
  for (let i = 0; i < 4; i++) {
    const x = -5.4 + i * 3.6;
    straw(x, -3.2, 3.6, 3.3, i, i * 1.3);
    // דלת-חצי פתוחה מעט (חצי רוחב, צמודה לעמוד הימני)
    crossDoor(B, M.doorPanel, M.white, x + 0.85, 0.62, -1.42, 1.6, 1.05);
    B.box(M.metal, 0.12, 0.08, 0.14, x + 0.06, 0.95, -1.36);                              // בריח
    const plate = plateMesh(horses[i] ? horses[i].name : 'תא פנוי');
    plate.position.set(x + 0.85, 0.66, -1.24); room.add(plate);
    // אבוס עם חציר בפינה האחורית
    B.box(M.wood, 1.1, 0.45, 0.55, x - 1.0, 0.75, -4.55);
    B.box(M.hay, 0.95, 0.22, 0.42, x - 1.0, 1.02, -4.55, 0.1, 0, 0.05);
    // דלי מים תלוי על המחיצה
    B.cyl(M.metal, 0.2, 0.34, x + 1.45, 1.05, -2.6);
    B.cyl(M.water, 0.17, 0.02, x + 1.45, 1.21, -2.6);
    B.cyl(M.iron, 0.205, 0.04, x + 1.45, 1.0, -2.6);
    const h = horses[i];
    if (!h) continue;
    const fake = { stage: h.stage, color: h.color, group: new THREE.Group() };
    fake.group.position.set(x - 0.2, 0, -3.0);
    room.add(fake.group);
    const h3d = new Horse3D(fake);
    h3d.init().then(() => { h3d.lookDir = new THREE.Vector3(-x, 0, 16); }).catch(() => {});   // מסתכלים אל המצלמה
    I.anims.push((dt) => h3d.update(dt, { moving: false, sleeping: false }));
    I.tap(fake.group, () => deps.stallCare(h, (res) => {
      if (h3d.ready) h3d.once('eat', 2.5);
      I.burst(fake.group.position, ['🧼', '❤️', '✨'], 12);
    }), 'stall');
  }

  // ---- דלת הזזה גדולה בקיר ימין: כנף אחת סגורה, אחת פתוחה אל השמש ----
  const dayDoor = new THREE.Mesh(new THREE.PlaneGeometry(OPEN1 - OPEN0, DOOR_H), day);
  dayDoor.rotation.y = -Math.PI / 2; dayDoor.position.set(W / 2 + 0.1, DOOR_H / 2, (OPEN0 + OPEN1) / 2); room.add(dayDoor);
  crossDoor(B, M.doorPanel, M.white, W / 2 - 0.28, DOOR_H / 2 + 0.05, OPEN0 - 0.95, 1.9, DOOR_H, 'zy');
  crossDoor(B, M.doorPanel, M.white, W / 2 - 0.28, DOOR_H / 2 + 0.05, OPEN1 + 1.0, 1.9, DOOR_H, 'zy');
  B.box(M.iron, 0.1, 0.12, 6.4, W / 2 - 0.3, DOOR_H + 0.18, 1.6);                           // מסילה עליונה
  for (const z of [-1.5, -0.3, OPEN1 + 0.4, OPEN1 + 1.6]) B.cyl(M.iron, 0.09, 0.08, W / 2 - 0.36, DOOR_H + 0.1, z, 0, 0, Math.PI / 2);
  // פרסה למזל מעל הדלת
  const shoe = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 5, 14, Math.PI * 1.45), M.metal);
  shoe.rotation.set(0, -Math.PI / 2, -Math.PI * 1.225); shoe.position.set(W / 2 - 0.22, DOOR_H + 0.75, (OPEN0 + OPEN1) / 2); room.add(shoe);

  // ---- אלומת שמש מהדלת + כתם אור על הרצפה + אבק מרחף ----
  const sTex = shaftTex(), SUNX = 4.0;                                   // השמש נוחתת עד x=4
  const sheetGeo = new THREE.BufferGeometry();
  const zA = OPEN0, zB = OPEN1 + 0.3;
  sheetGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    W / 2, DOOR_H, zA, W / 2, DOOR_H, zB, SUNX, 0.02, zA + 0.3, SUNX, 0.02, zB + 0.3,
    W / 2, 0.02, zA, W / 2, 0.02, zB], 3));
  sheetGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0], 2));
  sheetGeo.setIndex([0, 2, 1, 1, 2, 3, 0, 4, 2, 1, 3, 5]);
  const shaft = new THREE.Mesh(sheetGeo, additive(sTex, 0xffd9a0, 0.32)); room.add(shaft);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(W / 2 - SUNX + 0.4, zB - zA + 0.5), additive(softRectTex(), 0xffcf8a, 0.55));
  patch.rotation.x = -Math.PI / 2; patch.position.set((W / 2 + SUNX) / 2 + 0.1, 0.04, (zA + zB) / 2 + 0.15); room.add(patch);
  const loftShaftGeo = new THREE.BufferGeometry();
  loftShaftGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.9, HB + 2.1, -D / 2 + 0.25, 0.9, HB + 2.1, -D / 2 + 0.25, -1.1, LOFT_Y + 0.12, -3.6, 1.1, LOFT_Y + 0.12, -3.6], 3));
  loftShaftGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
  loftShaftGeo.setIndex([0, 2, 1, 1, 2, 3]);
  room.add(new THREE.Mesh(loftShaftGeo, additive(sTex, 0xffe2b0, 0.22)));
  {
    const N = 70, pos = new Float32Array(N * 3), seeds = [], r = rng(99);
    for (let i = 0; i < N; i++) {
      const u = r(), y = 0.3 + r() * (DOOR_H - 0.3), f = r();
      seeds.push({ x: W / 2 - (W / 2 - SUNX) * (1 - y / DOOR_H) * f - 0.2, y, z: zA + u * (zB - zA) + 0.2, ph: r() * 6.28 });
    }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff0c8, size: 0.07, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    dust.frustumCulled = false; room.add(dust);
    I.anims.push((dt, t) => {
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        pos[i * 3] = s.x + Math.sin(t * 0.3 + s.ph) * 0.25;
        pos[i * 3 + 1] = ((s.y + t * 0.08 + Math.sin(t * 0.5 + s.ph) * 0.1) % DOOR_H) + 0.1;
        pos[i * 3 + 2] = s.z + Math.cos(t * 0.25 + s.ph) * 0.2;
      }
      dg.attributes.position.needsUpdate = true;
    });
  }

  // ---- אור: חם ונעים. חצי-כדור + שמש (צללים) + שני פנסים מהבהבים ----
  room.add(new THREE.HemisphereLight(0xffe6c0, 0x5a3a20, 0.85));
  const sun = new THREE.DirectionalLight(0xffe2b0, 0.85);
  sun.position.set(8, 14, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  room.add(sun);
  const lamps = [];
  for (const [x, z] of [[-4.0, 1.5], [3.6, 1.5]]) {
    lantern(room, M, x, HB - 1.25, z, COLLAR - (HB - 1.25) - 0.3);
    const l = new THREE.PointLight(0xffb45a, 1.5, 11, 1.5); l.position.set(x, HB - 1.5, z + 0.1); room.add(l); lamps.push(l);
  }
  I.anims.push((dt, t) => { lamps.forEach((l, i) => { l.intensity = 1.4 + Math.sin(t * 7 + i * 2) * 0.08 + Math.sin(t * 13 + i) * 0.05; }); });

  // ---- ערימת חציר (חבילות מלבניות) + חתול שישן עליה ----
  const pile = new THREE.Group(); pile.position.set(-6.0, 0, 2.3); room.add(pile);
  bale(pile, M, 1.5, 0.7, 0.85, -0.8, 0.35, 0, 0.05); bale(pile, M, 1.5, 0.7, 0.85, 0.78, 0.35, 0.05, -0.04);
  bale(pile, M, 1.5, 0.7, 0.85, 0.0, 1.05, 0.02, 0.12);
  bale(pile, M, 1.5, 0.7, 0.85, -0.9, 0.35, -0.95, 1.57);
  straw(-6.0, 3.2, 3.4, 1.6, 2, 0.2);
  I.tap(pile, () => deps.ask('harvest', (res) => { deps.coins(8); I.burst(pile.position, ['🌾', '🪙'], 12); Audio.speak('אספת חציר לסוסים'); deps.event('barn_hay'); }), 'hay');
  const pile2 = new THREE.Group(); pile2.position.set(-3.6, 0, 3.4); room.add(pile2);
  bale(pile2, M, 1.4, 0.66, 0.8, 0, 0.33, 0, 0.5);
  straw(-3.0, 3.6, 2.0, 1.2, 1, 1.2);
  I.tap(pile2, () => I.taps.find(t => t.kind === 'hay').fn(), 'hay2');
  const cat = prop('cat.glb', 0.9, { fallback: '🐱', yaw: 0.6 }); cat.position.set(-6.0, 1.4, 2.35); room.add(cat);
  I.tap(cat, () => { Audio.animalSound('cat'); I.burst(cat.position, ['❤️', '💤'], 8); Audio.speak('מיאו! החתול אוהב לישון על החציר'); }, 'cat');
  // קלשון נשען על הקיר השמאלי
  {
    const fork = new THREE.Group(); fork.position.set(-8.6, 0, 0.3); fork.rotation.z = -0.22; room.add(fork);
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; fork.add(o); return o; };
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), M.woodLight, 0, 1.15, 0);
    add(new THREE.BoxGeometry(0.42, 0.06, 0.06), M.metal, 0, 2.32, 0);
    for (const dx of [-0.18, 0, 0.18]) add(new THREE.CylinderGeometry(0.02, 0.012, 0.5, 4), M.metal, dx, 2.58, 0);
  }

  // ---- עגלת יד מלאה חציר ----
  {
    const wb = new THREE.Group(); wb.position.set(-1.4, 0, 3.0); wb.rotation.y = 0.5; room.add(wb);
    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; wb.add(o); return o; };
    add(new THREE.CylinderGeometry(0.62, 0.42, 0.45, 4, 1), M.green, 0, 0.62, 0, 0, Math.PI / 4, 0).scale.set(1.25, 1, 0.85);
    add(new THREE.IcosahedronGeometry(0.5, 0), M.hay, 0, 0.88, 0).scale.set(1.3, 0.45, 0.85);
    add(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10), M.iron, 0.95, 0.26, 0, Math.PI / 2, 0, 0);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(1.9, 0.06, 0.06), M.woodLight, -0.2, 0.55, s * 0.33, 0, 0, 0.12);
      add(new THREE.BoxGeometry(0.06, 0.4, 0.06), M.woodLight, -0.45, 0.2, s * 0.3);
    }
  }
  // ---- אוכף על כן עץ + שמיכה ----
  {
    const sd = new THREE.Group(); sd.position.set(2.6, 0, 3.4); sd.rotation.y = -0.35; room.add(sd);
    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; sd.add(o); return o; };
    add(new THREE.BoxGeometry(1.3, 0.12, 0.16), M.wood, 0, 0.95, 0);
    for (const sx of [-0.55, 0.55]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.08, 1.0, 0.08), M.wood, sx, 0.47, sz * 0.14, sz * 0.25, 0, 0);
    add(new THREE.BoxGeometry(0.95, 0.04, 0.95), M.blanket, 0, 1.03, 0);
    add(new THREE.CylinderGeometry(0.32, 0.32, 0.72, 10, 1, false, 0, Math.PI), M.leather, 0, 1.02, 0, 0, 0, Math.PI / 2).scale.set(1, 1, 0.7);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.5, 0.42, 0.03), M.leatherDark, 0.05, 0.86, s * 0.33);
    add(new THREE.CylinderGeometry(0.05, 0.07, 0.18, 6), M.leatherDark, 0.33, 1.42, 0);     // קרן
    add(new THREE.TorusGeometry(0.2, 0.05, 4, 10, Math.PI), M.leatherDark, -0.32, 1.2, 0, 0, Math.PI / 2, 0);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.04, 0.42, 0.02), M.leatherDark, 0.05, 0.6, s * 0.36);
      add(new THREE.TorusGeometry(0.07, 0.018, 4, 8), M.metal, 0.05, 0.36, s * 0.36);
    }
  }
  // ---- שולחן עבודה: דלי מים (נגיע), מברשות, פרסה ----
  B.box(M.wood, 3.0, 0.14, 1.0, 6.2, 1.08, 3.9);
  for (const x of [4.85, 7.55]) for (const z of [3.5, 4.3]) B.box(M.wood, 0.12, 1.05, 0.12, x, 0.52, z);
  B.box(M.wood, 2.8, 0.08, 0.8, 6.2, 0.35, 3.9);
  B.box(M.woodLight, 0.45, 0.12, 0.2, 5.1, 1.21, 3.7); B.box(M.leatherDark, 0.4, 0.06, 0.16, 5.1, 1.3, 3.7);   // מברשת
  B.box(M.woodLight, 0.45, 0.12, 0.2, 5.4, 1.21, 4.1, 0, 0.5, 0); B.box(M.hay, 0.4, 0.06, 0.16, 5.4, 1.3, 4.1, 0, 0.5, 0);
  {
    const s2 = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 5, 12, Math.PI * 1.45), M.metal);
    s2.rotation.set(-Math.PI / 2, 0, 0.3); s2.position.set(6.1, 1.18, 3.9); room.add(s2);
  }
  const bucket = prop('water_bucket.glb', 0.8, { fallback: '🪣' }); bucket.position.set(7.0, 1.15, 3.9); room.add(bucket);
  I.tap(bucket, () => deps.ask('feed', () => { deps.coins(6); I.burst(bucket.position, ['💧', '💧', '✨'], 10); Audio.speak('מילאת מים לסוסים'); deps.event('barn_water'); }), 'water');
  const sack = prop('feed_sack.glb', 0.6, { fallback: '🌾', yaw: 0.4 }); sack.position.set(-8.3, 0, 1.3); room.add(sack);

  // ---- קיר רתמות (ימין, ליד התא האחרון): וו, רסן, חבל, פרסה ----
  {
    const zx = W / 2 - 0.2;
    for (const [z, y] of [[-4.0, 2.9], [-3.0, 2.9], [-2.0, 2.9]]) B.cyl(M.iron, 0.04, 0.3, zx - 0.12, y, z, 0, 0, Math.PI / 2);
    const tor = (r, tube, m, y, z, sx = 1) => { const o = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 5, 14), m); o.rotation.y = Math.PI / 2; o.scale.set(sx, 1, 1); o.position.set(zx - 0.2, y, z); room.add(o); return o; };
    tor(0.3, 0.04, M.leather, 2.55, -4.0).scale.set(1, 1.5, 1);          // רסן
    tor(0.14, 0.03, M.leather, 2.25, -4.0);
    tor(0.28, 0.07, mat(0xd94a3a, 0.3), 2.6, -3.0);                       // חבל הובלה מגולגל
    tor(0.2, 0.06, mat(0xd94a3a, 0.3), 2.6, -3.0);
    tor(0.24, 0.04, M.blanket, 2.6, -2.0).scale.set(1, 1.4, 1);
  }

  // ---- תרנגולות מסתובבות באסם ----
  for (const [x, z, yaw, s] of [[6.6, 1.6, -1.0, 0.65], [1.0, 1.0, 0.8, 0.6]]) {
    const ch = prop('chicken.glb', s, { fallback: '🐔', yaw }); ch.position.set(x, 0, z); room.add(ch);
    I.tap(ch, () => { Audio.animalSound('chicken'); I.burst(ch.position, ['🥚', '❤️'], 8); Audio.speak('קוקוריקו! גם התרנגולות גרות באסם'); }, 'chicken');
  }

  B.flush(room);
  // מכסים עדינים לרצפה: קש מפוזר באזור המעבר
  straw(0.5, 0.2, 2.2, 1.4, 0, 2.0); straw(4.6, -0.4, 1.8, 1.1, 1, 0.7); straw(-6.6, -0.5, 1.6, 1.0, 2, 1.5);
  I.addHider(['🐭'], [[-3.3, 0, 4.3], [1.6, 0, 4.2], [-7.6, 0, -0.5], [8.0, 0, -1.0], [3.0, 0, -1.0], [-1.2, 0, -1.0]]);
}

const ROOMS = {
  barn: {
    title: '🏠 בתוך האסם', say: 'נכנסנו לאסם! כאן הסוסים ישנים. אפשר לגעת בסוס, בחציר, בחתול ובתרנגולות. ואולי מתחבא כאן עכבר?',
    build(I, room, deps) { buildBarn(I, room, deps); }
  },
  bakery: {
    title: '🥐 בתוך המאפייה', say: 'ריח של עוגיות! אפשר לאפות בתנור, לקשט עוגה, ולתת לחיות הכפר משהו טעים',
    build(I, room, deps) {
      shell(room, { floorA: '#e9d8bf', floorB: '#ddc7a8', wall: 0xf3d9b1, trim: 0xb07a45 });
      lights(room, 0xffb36b);
      const brick = mat(0xb5523b), dark = mat(0x3a2a20), wood = mat(0x9a6535), white = mat(0xfaf6ee);
      // תנור לבנים עם אש
      box(room, 4.2, 3.2, 2.2, brick, -5.6, 1.6, -3.7);
      box(room, 2.0, 1.3, 0.2, dark, -5.6, 1.35, -2.55);
      const fire = emoji('🔥', 1.0); fire.position.set(-5.6, 0.7, -1.9); room.add(fire);
      I.anims.push((dt, t) => { fire.scale.setScalar(1 + Math.sin(t * 9) * 0.08); });
      const glow = new THREE.PointLight(0xff7a2a, 1.6, 8, 1.6); glow.position.set(-5.6, 1.4, -1.8); room.add(glow);
      I.anims.push((dt, t) => { glow.intensity = 1.4 + Math.sin(t * 7) * 0.3; });
      const tray = new THREE.Group(); tray.position.set(-5.6, 1.0, -1.6); room.add(tray);
      I.tap(fire, () => deps.ask('treat', (res) => {
        tray.clear();
        for (let i = 0; i < 6; i++) { const c = emoji('🍪', 0.55); c.position.set((i % 3 - 1) * 0.55, 0, Math.floor(i / 3) * 0.5); tray.add(c); }
        deps.coins(10); I.burst(fire.position, ['🍪', '✨', '🪙'], 14); Audio.speak('אפית עוגיות! איזה ריח'); deps.event('bake');
      }), 'oven');
      // דלפק + מדפים עם מאפים
      box(room, 6.5, 1.3, 1.4, wood, 3.4, 0.65, 1.6);
      box(room, 6.7, 0.12, 1.6, white, 3.4, 1.36, 1.6);
      const goods = ['🥖', '🥐', '🍞', '🧁', '🍩', '🥨'];
      goods.forEach((g, i) => { const s = emoji(g, 0.8); s.position.set(1.0 + i * 0.95, 1.42, 1.6); room.add(s); });
      for (let r = 0; r < 2; r++) {
        box(room, 7, 0.14, 0.9, wood, 3.4, 2.2 + r * 1.3, -4.4);
        ['🍰', '🎂', '🥧', '🍪', '🍫'].forEach((g, i) => { const s = emoji(g, 0.75); s.position.set(0.9 + i * 1.3 + r * 0.4, 2.27 + r * 1.3, -4.3); room.add(s); });
      }
      const cake = emoji('🎂', 1.2); cake.position.set(3.4, 1.42, 1.0); room.add(cake);
      I.tap(cake, () => deps.ask('buy', () => {
        const top = ['🍓', '🍒', '⭐', '🌸'][Math.floor(Math.random() * 4)];
        const d = emoji(top, 0.45); d.position.set(cake.position.x + (Math.random() - 0.5) * 0.5, 2.3, cake.position.z); room.add(d);
        deps.coins(8); I.burst(cake.position, [top, '✨'], 10); Audio.speak('קישטת את העוגה!'); deps.event('bake');
      }), 'cake');
      const baker = prop('baker.glb', 2.6, { fallback: '👩‍🍳', yaw: 0 }); baker.position.set(3.4, 0, -1.4); room.add(baker);
      I.tap(baker, () => { I.burst(baker.position, ['❤️'], 6); const n = Game.playerName(); Audio.speak('שלום' + (n ? ' ' + n : '') + '! תודה שבאת לעזור לי באפייה'); }, 'baker');
      // שק קמח וחביות
      const sack = prop('feed_sack.glb', 1.2, { fallback: '🌾' }); sack.position.set(7.6, 0, -2.4); room.add(sack);
      I.addHider(['🐭'], [[-2.0, 0, 3.4], [7.6, 0, 3.4], [-7.8, 0, 0.8], [0.0, 0, -3.0]]);
    }
  },
  cottage: {
    title: '🏡 בבית בכפר', say: 'איזה בית חמים! אפשר לשבת ליד האח, לקרוא ספר, ולהכין תה',
    build(I, room, deps) {
      shell(room, { floorA: '#c99a6a', floorB: '#b98a5a', wall: 0xcfe3d4, trim: 0x8a5a2b });
      lights(room, 0xffcf8a);
      const stone = mat(0x9c9ea3), wood = mat(0x8a5a2b), sofa = mat(0x4f8fd1), rug = mat(0xe86f8f), books = [0xe24b4b, 0x4caf50, 0xffcf4d, 0x4f8fd1, 0xb06ad9];
      // אח
      box(room, 3.6, 3.4, 1.2, stone, 0, 1.7, -4.3);
      box(room, 1.8, 1.3, 0.3, mat(0x2a1d16), 0, 0.85, -3.7);
      const fire = emoji('🔥', 0.95); fire.position.set(0, 0.2, -3.0); room.add(fire);
      const glow = new THREE.PointLight(0xff8a3a, 1.4, 8, 1.6); glow.position.set(0, 1.0, -2.8); room.add(glow);
      I.anims.push((dt, t) => { fire.scale.setScalar(1 + Math.sin(t * 8) * 0.08); glow.intensity = 1.2 + Math.sin(t * 6) * 0.25; });
      I.tap(fire, () => { I.burst(fire.position, ['❤️', '✨'], 10); Audio.speak('איזה חם ונעים ליד האש'); deps.event('cottage'); }, 'fire');
      // שטיח וספה
      const r = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), rug); r.rotation.x = -Math.PI / 2; r.position.set(0, 0.03, 0.4); room.add(r);
      box(room, 4.6, 0.8, 1.4, sofa, 0, 0.4, 2.9);
      box(room, 4.6, 1.2, 0.35, sofa, 0, 1.0, 3.5);
      for (const x of [-2.4, 2.4]) box(room, 0.4, 1.0, 1.4, sofa, x, 0.6, 2.9);
      // מדף ספרים
      box(room, 0.6, 4.2, 3.4, wood, -8.4, 2.1, -1.8);
      const bookGroup = new THREE.Group(); room.add(bookGroup);
      for (let s = 0; s < 3; s++) for (let i = 0; i < 6; i++) {
        box(bookGroup, 0.35, 0.8 + (i % 3) * 0.12, 0.22, mat(books[(i + s) % books.length]), -8.0, 0.9 + s * 1.3, -3.2 + i * 0.5);
      }
      const STORIES = [
        'פעם הייתה סוסה קטנה שפחדה לקפוץ. היא התאמנה כל יום, ובסוף קפצה הכי גבוה בכפר',
        'בלילה, כשכולם ישנים, הגחליליות מאירות את השדה כדי שהגזרים יגדלו',
        'החתול של האסם הוא השומר של החווה. הוא שומר על העכברים, אבל רק משחק איתם',
        'יש ביער עץ שכל פעם שמישהו מחייך אליו, צומח עליו פרח חדש'
      ];
      let si = 0;
      I.tap(bookGroup, () => { const st = STORIES[si++ % STORIES.length]; I.burst(new THREE.Vector3(-7.6, 2.5, -1.8), ['📖', '✨'], 8); Audio.speak(st); deps.toast('📖 ' + st, false); deps.event('cottage'); }, 'books');
      // שולחן עם קומקום
      box(room, 2.2, 0.12, 1.4, wood, 6.0, 1.2, -1.0);
      for (const x of [5.1, 6.9]) for (const z of [-1.5, -0.5]) box(room, 0.12, 1.2, 0.12, wood, x, 0.6, z);
      const tea = emoji('🫖', 0.9); tea.position.set(5.6, 1.27, -1.0); room.add(tea);
      const cups = new THREE.Group(); cups.position.set(6.6, 1.27, -1.0); room.add(cups);
      I.tap(tea, () => deps.ask('treat', () => {
        cups.clear();
        for (let i = 0; i < 3; i++) { const c = emoji('☕', 0.45); c.position.set((i - 1) * 0.4, 0, 0); cups.add(c); }
        deps.coins(7); I.burst(tea.position, ['☕', '✨', '🪙'], 10); Audio.speak('הכנת תה לכל החברים'); deps.event('cottage');
      }), 'tea');
      const plant = emoji('🪴', 1.4); plant.position.set(8.0, 0, 3.2); room.add(plant);
      const dog = prop('dog.glb', 1.1, { fallback: '🐶', yaw: -0.5 }); dog.position.set(1.4, 0, 0.6); room.add(dog);
      I.tap(dog, () => { Audio.animalSound('dog'); I.burst(dog.position, ['❤️', '🦴'], 8); Audio.speak('הב הב! הכלב שמח שבאת'); }, 'dog');
      I.addHider(['🐭'], [[-5.0, 0, 3.4], [7.5, 0, 1.4], [-6.5, 0, -3.6], [3.4, 0, -3.8]]);
    }
  }
};

// ---------- המנהל ----------
const Interiors = {
  active: null,
  deps: null,
  init(deps) { this.deps = deps; },
  has(id) { return !!ROOMS[id]; },

  enter(id) {
    const def = ROOMS[id];
    if (!def || this.active) return;
    const room = new THREE.Scene();
    room.background = new THREE.Color(0x24363a);
    room.fog = new THREE.Fog(0x24363a, 28, 60);
    const I = this.active = { id, room, taps: [], anims: [], fx: [], hider: null, t: 0 };
    I.tap = (obj, fn, kind) => { I.taps.push({ obj, fn, kind }); };
    I.burst = (pos, emojis, n) => this._burst(pos, emojis, n);
    I.addHider = (em, spots) => this._hider(em, spots);
    def.build(I, room, this.deps);

    // מצלמה: "בית בובות" מלפנים, סיבוב קטן, קרוב
    const ctl = World.controls;
    I.saved = { pos: World.camera.position.clone(), target: ctl.target.clone(), min: ctl.minDistance, max: ctl.maxDistance };
    World._travel = null;
    ctl.minDistance = 9; ctl.maxDistance = 15;
    ctl.target.set(0, 1.6, 0);
    World.camera.position.set(0, 9.5, 13);
    ctl.update();
    this._fade(() => { World.activeScene = room; });
    document.body.classList.add('inside');
    const bar = el('div', 'inside-bar');
    bar.innerHTML = `<span class="ib-title">${def.title}</span><button class="btn-home ib-exit">🚪 לצאת</button>`;
    document.getElementById('ui').appendChild(bar);
    bar.querySelector('.ib-exit').onclick = () => { Audio.click(); this.exit(); };
    I.bar = bar;
    this.deps.onEnter && this.deps.onEnter(id);
    setTimeout(() => Audio.speak(def.say), 400);
  },

  exit() {
    const I = this.active;
    if (!I) return;
    this.active = null;
    this._fade(() => {
      World.activeScene = null;
      const ctl = World.controls;
      ctl.minDistance = I.saved.min; ctl.maxDistance = I.saved.max;
      ctl.target.copy(I.saved.target); World.camera.position.copy(I.saved.pos); ctl.update();
      I.room.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    });
    if (I.bar) I.bar.remove();
    document.body.classList.remove('inside');
    Audio.speak('יצאנו החוצה');
    this.deps.onExit && this.deps.onExit(I.id);
  },

  _fade(mid) {
    const f = el('div', 'scene-fade');
    document.body.appendChild(f);
    requestAnimationFrame(() => f.classList.add('on'));
    setTimeout(() => { mid(); f.classList.remove('on'); setTimeout(() => f.remove(), 350); }, 300);
  },

  // עכבר שמתחבא: מופיע באחד המקומות ומציץ; נגיעה = מצאת! והוא בורח למקום אחר
  _hider(emojis, spots) {
    const I = this.active;
    const m = emoji(emojis[0], 0.7);
    I.room.add(m);
    const H = I.hider = { m, spots, at: -1, found: 0, peek: 0 };
    const move = () => {
      let k; do { k = Math.floor(Math.random() * spots.length); } while (k === H.at && spots.length > 1);
      H.at = k; m.position.set(...spots[k]); H.peek = 0;
    };
    move();
    I.tap(m, () => {
      H.found++;
      this._burst(m.position, ['⭐', '🧀'], 10);
      Audio.success();
      if (H.found % 3 === 0) { this.deps.coins(10); Audio.speak('מצאת את העכבר שלוש פעמים! קיבלת עשר מטבעות'); }
      else Audio.speak('מצאת את העכבר! הוא ברח להתחבא שוב');
      this.deps.event('mouse');
      move();
    }, 'mouse');
  },

  _burst(pos, emojis, n) {
    const I = this.active;
    if (!I) return;
    for (let i = 0; i < n; i++) {
      const s = World.emojiSprite(emojis[i % emojis.length], 0.5 + Math.random() * 0.35);
      s.position.set(pos.x, (pos.y || 0) + 1.2, pos.z);
      const a = Math.random() * Math.PI * 2, v = 1.2 + Math.random() * 2;
      s.userData = { v: new THREE.Vector3(Math.cos(a) * v, 2.5 + Math.random() * 2.5, Math.sin(a) * v), age: 0, life: 1.1 + Math.random() * 0.5 };
      I.room.add(s); I.fx.push(s);
    }
  },

  // נגיעה בתוך המבנה: רק אובייקטים של החדר (העולם בחוץ לא נבחר)
  pick(x, y) {
    const I = this.active;
    if (!I) return false;
    const rc = World.raycaster, p = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    rc.setFromCamera(p, World.camera);
    let best = null, bestD = Infinity;
    for (const t of I.taps) {
      const hit = rc.intersectObject(t.obj, true)[0];
      if (hit && hit.distance < bestD) { bestD = hit.distance; best = t; }
    }
    // אמוג'י קטנים קשה לפגוע בהם באצבע — מקבלים גם נגיעה קרובה במסך
    if (!best) {
      const v = new THREE.Vector3(), reach = Math.max(40, Math.min(window.innerWidth, window.innerHeight) * 0.08);
      for (const t of I.taps) {
        t.obj.getWorldPosition(v); v.y += 0.4; v.project(World.camera);
        const d = Math.hypot((v.x + 1) / 2 * window.innerWidth - x, (1 - v.y) / 2 * window.innerHeight - y);
        if (d < reach && d < bestD) { bestD = d; best = t; }
      }
    }
    if (best) { Audio.pop(); best.fn(); }
    return !!best;
  },

  update(dt) {
    const I = this.active;
    if (!I) return;
    I.t += dt;
    for (const a of I.anims) a(dt, I.t);
    I.room.traverse(o => { if (o.userData && o.userData.mixer) o.userData.mixer.update(dt); });
    if (I.hider) { I.hider.peek += dt; I.hider.m.position.y = Math.max(0, Math.sin(I.hider.peek * 2.2)) * 0.25; }
    for (let i = I.fx.length - 1; i >= 0; i--) {
      const s = I.fx[i], u = s.userData;
      u.age += dt; u.v.y -= 6 * dt; s.position.addScaledVector(u.v, dt);
      s.material.opacity = Math.max(0, 1 - u.age / u.life);
      if (u.age >= u.life) { I.room.remove(s); s.material.dispose(); I.fx.splice(i, 1); }
    }
  }
};

export { Interiors };
