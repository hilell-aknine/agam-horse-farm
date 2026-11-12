// props3d.js — אביזרים תלת-ממדיים שנבנים בקוד מצורות בסיס (במקום אימוג'י ענק בעולם).
// כל אביזר ממוזג לכמה שפחות ציורים: צבע לכל חלק נשמר בקודקודים, וחומר אחד משותף לכולם.
// בלי קבצים חיצוניים ובלי טקסטורות, אז זה לא מוסיף משקל להורדה.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
const HIT = new THREE.MeshBasicMaterial({ visible: false });      // אזור נגיעה: לא מצויר, אבל נתפס בלחיצה
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// אוסף חלקים (גיאומטריה + צבע + מיקום) וממזג אותם ל-Mesh אחד
class Kit {
  constructor() { this.parts = []; }
  add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    g.applyMatrix4(_m);
    const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    this.parts.push(g);
    return this;
  }
  // גיאומטריה מוכנה עם צבעי קודקודים משלה; flat=true נותן פאות חדות (סלע)
  raw(geo, x = 0, y = 0, z = 0, flat = true) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.translate(x, y, z);
    if (flat) g.computeVertexNormals();
    g.deleteAttribute('uv');
    this.parts.push(g);
    return this;
  }
  build() {
    const mesh = new THREE.Mesh(mergeGeometries(this.parts), MAT);
    this.parts.forEach(g => g.dispose());
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
}

const cyl = (r, h, seg = 10, r2 = r) => new THREE.CylinderGeometry(r2, r, h, seg);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ball = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
const BRIGHT = [0xff5d73, 0xffb52e, 0x4fc3f7, 0x7ed957, 0xb388ff, 0xff8fc7, 0xffe14d, 0x26c6da];

// אזור נגיעה נדיב סביב אביזר דק (ילדה בת 6 לא מכוונת לחישוק של גלגל)
function hitZone(geo, x, y, z) {
  const m = new THREE.Mesh(geo, HIT);
  m.position.set(x, y, z);
  return m;
}

// ---------- גלגל ענק ----------
// עומד במישור XY (פונה למצלמה שמגיעה מכיוון +z). hubY: גובה הציר, r: רדיוס.
function ferrisWheel({ r = 4.3, hubY = 6, cabins = 8 } = {}) {
  const group = new THREE.Group();
  // בסיס: שתי רגלי A, ציר ומדרגה
  const base = new Kit();
  const legLen = Math.hypot(hubY, 2.7), legA = Math.atan2(2.7, hubY);
  for (const z of [-0.75, 0.75]) for (const s of [-1, 1]) {
    base.add(cyl(0.16, legLen, 8), 0xf4f1ea, s * 1.35, hubY / 2, z, 0, 0, s * legA);
  }
  base.add(cyl(0.12, 5.4, 8), 0xf4f1ea, 0, 0.5, -0.75, 0, 0, Math.PI / 2);
  base.add(cyl(0.12, 5.4, 8), 0xf4f1ea, 0, 0.5, 0.75, 0, 0, Math.PI / 2);
  base.add(box(6.4, 0.3, 2.6), 0xd9534f, 0, 0.15, 0);
  base.add(box(5.6, 0.16, 2.2), 0xffd75e, 0, 0.36, 0);
  base.add(cyl(0.28, 1.9, 12), 0xffc93c, 0, hubY, 0, Math.PI / 2, 0, 0);
  group.add(base.build());

  // החלק המסתובב: שני חישוקים, חישורים, נורות וקורות שהתאים תלויים מהן
  const rotor = new THREE.Group();
  rotor.position.y = hubY;
  const k = new Kit();
  for (const z of [-0.5, 0.5]) {
    k.add(new THREE.TorusGeometry(r, 0.11, 8, 40), 0xff5d73, 0, 0, z);
    k.add(new THREE.TorusGeometry(r * 0.52, 0.07, 6, 28), 0xffffff, 0, 0, z);
    for (let i = 0; i < cabins; i++) {
      const a = (i / cabins) * Math.PI * 2;
      k.add(cyl(0.055, r, 6), 0xffffff, Math.cos(a) * r / 2, Math.sin(a) * r / 2, z, 0, 0, a - Math.PI / 2);
    }
  }
  for (let i = 0; i < cabins; i++) {
    const a = (i / cabins) * Math.PI * 2;
    k.add(cyl(0.07, 1.2, 6), 0xffc93c, Math.cos(a) * r, Math.sin(a) * r, 0, Math.PI / 2, 0, 0);
  }
  for (let i = 0; i < cabins * 2; i++) {                         // נורות צבעוניות על החישוק הקדמי
    const a = ((i + 0.5) / (cabins * 2)) * Math.PI * 2;
    k.add(ball(0.13, 8, 6), BRIGHT[i % BRIGHT.length], Math.cos(a) * r, Math.sin(a) * r, 0.62);
  }
  k.add(cyl(0.55, 1.2, 14), 0xffc93c, 0, 0, 0, Math.PI / 2, 0, 0);
  k.add(cyl(0.3, 1.3, 10), 0xff5d73, 0, 0, 0, Math.PI / 2, 0, 0);
  rotor.add(k.build());

  // תאים: כל אחד Mesh משלו, כדי שיישאר זקוף בזמן שהגלגל מסתובב
  const cabs = [];
  for (let i = 0; i < cabins; i++) {
    const col = BRIGHT[i % BRIGHT.length];
    const c = new Kit()
      .add(cyl(0.03, 0.45, 5), 0x8d99a6, 0, -0.22, 0)
      .add(new THREE.ConeGeometry(0.62, 0.34, 8), col, 0, -0.5, 0)
      .add(cyl(0.5, 0.5, 8, 0.56), 0xffffff, 0, -0.95, 0)
      .add(cyl(0.42, 0.22, 8, 0.52), col, 0, -1.26, 0)
      .build();
    const a = (i / cabins) * Math.PI * 2;
    c.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    rotor.add(c);
    cabs.push(c);
  }
  group.add(rotor);
  group.add(hitZone(new THREE.CircleGeometry(r + 1.2, 20), 0, hubY, 0.9));
  group.userData.update = (t) => {
    rotor.rotation.z = t * 0.28;
    for (const c of cabs) c.rotation.z = -rotor.rotation.z;
  };
  return group;
}

// ---------- סוס קרוסלה קטן (פונה ל-+x) ----------
function carouselHorse(coat, saddle) {
  const dark = new THREE.Color(coat).multiplyScalar(0.55).getHex();
  const k = new Kit()
    .add(cyl(0.035, 2.5, 6), 0xffd75e, 0, 0.75, 0)                        // מוט זהב
    .add(box(0.78, 0.34, 0.3), coat, 0, 0, 0)                             // גוף
    .add(box(0.2, 0.46, 0.22), coat, 0.36, 0.26, 0, 0, 0, -0.5)           // צוואר
    .add(box(0.36, 0.2, 0.2), coat, 0.56, 0.47, 0, 0, 0, -0.25)           // ראש
    .add(box(0.07, 0.42, 0.06), dark, 0.25, 0.3, 0, 0, 0, -0.5)           // רעמה
    .add(box(0.1, 0.36, 0.1), dark, -0.44, -0.05, 0, 0, 0, 0.5)           // זנב
    .add(box(0.3, 0.09, 0.34), saddle, -0.03, 0.2, 0)                     // אוכף
    .add(new THREE.ConeGeometry(0.035, 0.1, 4), dark, 0.5, 0.62, 0.07)
    .add(new THREE.ConeGeometry(0.035, 0.1, 4), dark, 0.5, 0.62, -0.07);
  for (const [x, rz] of [[0.28, 0.35], [-0.28, -0.35]]) for (const z of [-0.1, 0.1]) {
    k.add(box(0.09, 0.42, 0.09), coat, x + rz * 0.25, -0.34, z, 0, 0, rz);
    k.add(box(0.1, 0.08, 0.1), dark, x + rz * 0.42, -0.55, z);
  }
  return k.build();
}

// ---------- קרוסלת סוסים ----------
function carousel({ r = 2.6, horses = 6 } = {}) {
  const group = new THREE.Group();
  const base = new Kit()
    .add(cyl(r + 0.9, 0.22, 24), 0xd9534f, 0, 0.11, 0)
    .add(cyl(r + 0.7, 0.14, 24), 0xfff3d6, 0, 0.29, 0)
    .build();
  group.add(base);
  const rotor = new THREE.Group();
  const k = new Kit();
  k.add(cyl(0.38, 3.3, 12), 0xfff3d6, 0, 1.95, 0);
  for (let i = 0; i < 4; i++) k.add(cyl(0.4, 0.14, 12), BRIGHT[i], 0, 0.9 + i * 0.7, 0);
  const SEG = 12, roofR = r + 1.0;
  for (let i = 0; i < SEG; i++) {                                         // גג פסים
    k.add(new THREE.ConeGeometry(roofR, 1.5, 3, 1, true, (i / SEG) * Math.PI * 2, Math.PI * 2 / SEG),
      i % 2 ? 0xffffff : 0xff5d73, 0, 4.35, 0);
    const a = ((i + 0.5) / SEG) * Math.PI * 2;                            // שוליים מסולסלים
    k.add(ball(0.2, 8, 6), i % 2 ? 0xff5d73 : 0xffd75e, Math.cos(a) * roofR * 0.97, 3.55, Math.sin(a) * roofR * 0.97);
  }
  k.add(cyl(roofR, 0.16, 24), 0xffd75e, 0, 3.6, 0);
  k.add(ball(0.3), 0xffd75e, 0, 5.2, 0);
  rotor.add(k.build());
  const coats = [0xffffff, 0xc98a52, 0x6b4a36, 0xf2d6a2, 0x9aa3ad, 0x3d3a3a];
  const list = [];
  for (let i = 0; i < horses; i++) {
    const a = (i / horses) * Math.PI * 2;
    const h = carouselHorse(coats[i % coats.length], BRIGHT[(i * 3) % BRIGHT.length]);
    h.position.set(Math.cos(a) * r, 1.35, Math.sin(a) * r);
    h.rotation.y = -(a + Math.PI / 2);
    rotor.add(h);
    list.push({ h, ph: i * 1.9 });
  }
  group.add(rotor);
  group.add(hitZone(cyl(r + 1.0, 5, 12), 0, 2.5, 0));
  group.userData.update = (t) => {
    rotor.rotation.y = -t * 0.55;
    for (const o of list) o.h.position.y = 1.35 + Math.sin(t * 2.4 + o.ph) * 0.3;
  };
  return group;
}

// ---------- סירת מפרש ----------
function sailboat() {
  const tri = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0], pts[1]); s.lineTo(pts[2], pts[3]); s.lineTo(pts[4], pts[5]); s.closePath(); return new THREE.ShapeGeometry(s); };
  const k = new Kit()
    .add(new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xd9534f, 0, 0.42, 0, 0, 0, 0, 1.25, 0.5, 0.5)   // גוף הסירה
    .add(new THREE.CircleGeometry(1, 14), 0xe8c48a, 0, 0.42, 0, -Math.PI / 2, 0, 0, 1.2, 0.46, 1)                                    // סיפון
    .add(new THREE.TorusGeometry(1, 0.05, 5, 20), 0xffffff, 0, 0.43, 0, Math.PI / 2, 0, 0, 1.25, 0.5, 1)                               // פס לבן
    .add(cyl(0.045, 2.5, 6), 0x8a5a3a, 0.05, 1.65, 0)                                                                                 // תורן
    .add(tri([0, 0, 0, 2.05, -1.05, 0]), 0xffffff, 0.0, 0.7, 0)                                                                       // מפרש ראשי
    .add(tri([0, 0, 0, 1.6, 0.8, 0]), 0xffd75e, 0.1, 0.75, 0)                                                                         // מפרש קדמי
    .add(tri([0, 0, 0, 0.28, 0.42, 0.14]), 0xff5d73, 0.05, 2.62, 0);                                                                  // דגלון
  const mesh = k.build();
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.update = (t) => {
    mesh.position.y = Math.sin(t * 1.5) * 0.07;
    mesh.rotation.z = Math.sin(t * 1.1) * 0.05;
    mesh.rotation.x = Math.sin(t * 0.8 + 1) * 0.04;
  };
  return g;
}

// ---------- ציפור עם כנפיים מנפנפות (פונה ל-+x) ----------
function bird({ body = 0x6b4a36, belly = 0xfff3d6, beak = 0xffb52e, size = 1 } = {}) {
  const g = new THREE.Group();
  g.add(new Kit()
    .add(ball(0.3, 10, 8), body, 0, 0, 0, 0, 0, 0, 1.5, 0.8, 0.85)
    .add(ball(0.2, 8, 6), belly, 0.05, -0.08, 0, 0, 0, 0, 1.5, 0.7, 0.8)
    .add(ball(0.19, 10, 8), belly, 0.46, 0.1, 0)
    .add(new THREE.ConeGeometry(0.07, 0.24, 6), beak, 0.72, 0.07, 0, 0, 0, -Math.PI / 2)
    .add(box(0.5, 0.05, 0.3), body, -0.6, 0.02, 0, 0, 0, 0.12)
    .build());
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new Kit()
      .add(box(0.42, 0.05, 0.75), body, 0, 0, s * 0.38)
      .add(box(0.3, 0.045, 0.55), new THREE.Color(body).multiplyScalar(0.7).getHex(), -0.04, 0, s * 0.95)
      .build();
    w.position.set(0, 0.1, s * 0.12);
    g.add(w);
    wings.push({ w, s });
  }
  g.scale.setScalar(size);
  const ph = Math.random() * 6;
  g.userData.update = (t) => {
    const f = Math.sin(t * 5 + ph) * 0.55 + 0.1;
    for (const o of wings) o.w.rotation.x = -o.s * f;
  };
  return g;
}

// ---------- בלון על חוט ----------
function balloon(color = BRIGHT[0], size = 1) {
  const m = new Kit()
    .add(ball(0.42, 12, 10), color, 0, 0.5, 0, 0, 0, 0, 1, 1.18, 1)
    .add(new THREE.ConeGeometry(0.08, 0.12, 6), color, 0, -0.02, 0)
    .add(cyl(0.012, 1.1, 4), 0xffffff, 0, -0.6, 0)
    .build();
  m.castShadow = false;
  m.scale.setScalar(size);
  return m;
}

// ---------- לוח מטרה על חצובה (פונה ל-+z) ----------
function dartboard() {
  const k = new Kit();
  const rings = [[0.95, 0xffffff], [0.76, 0xff5d73], [0.57, 0xffffff], [0.38, 0xff5d73], [0.17, 0xffd75e]];
  rings.forEach(([r, c], i) => k.add(cyl(r, 0.06, 24), c, 0, 0, i * 0.02, Math.PI / 2, 0, 0));
  k.add(cyl(1.02, 0.1, 24), 0x8a5a3a, 0, 0, -0.06, Math.PI / 2, 0, 0);
  k.add(cyl(0.05, 2.3, 6), 0x8a5a3a, -0.5, -1.15, -0.35, 0.3, 0, 0.2);
  k.add(cyl(0.05, 2.3, 6), 0x8a5a3a, 0.5, -1.15, -0.35, 0.3, 0, -0.2);
  const g = new THREE.Group();
  g.add(k.build());
  g.add(hitZone(new THREE.CircleGeometry(1.5, 14), 0, 0, 0.2));
  return g;
}

// ---------- סוכרייה על מקל ----------
function lollipop() {
  const k = new Kit();
  [[0.62, 0xff5d73], [0.47, 0xffffff], [0.32, 0xff8fc7], [0.16, 0xffffff]].forEach(([r, c], i) =>
    k.add(cyl(r, 0.2, 20), c, 0, 0, i * 0.03, Math.PI / 2, 0, 0));
  k.add(cyl(0.045, 1.5, 6), 0xffffff, 0, -1.3, 0);
  const g = new THREE.Group();
  g.add(k.build());
  g.add(hitZone(new THREE.CircleGeometry(1.2, 12), 0, -0.3, 0.2));
  return g;
}

// ---------- פסגת הר מושלגת עם פתח מערה בחזית (+z) ----------
function peak({ r = 9, h = 18 } = {}) {
  const geo = new THREE.ConeGeometry(r, h, 11, 6);
  const pos = geo.attributes.position, col = [], c = new THREE.Color();
  const rock = new THREE.Color(0x8d9199), rockDark = new THREE.Color(0x6f737c), snow = new THREE.Color(0xffffff);
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v), t = (y + h / 2) / h;
    const ang = Math.atan2(z, x);
    if (t > 0.02 && t < 0.97) {
      const k = 1 + 0.14 * Math.sin(ang * 3 + t * 7) + 0.08 * Math.cos(ang * 5 - t * 4);
      pos.setX(v, x * k); pos.setZ(v, z * k);
    }
    const line = 0.6 + 0.07 * Math.sin(ang * 4) + 0.04 * Math.cos(ang * 7);       // קו שלג לא ישר
    if (t > line) c.copy(snow); else c.copy(rockDark).lerp(rock, 0.35 + 0.65 * Math.abs(Math.sin(ang * 2.3 + t * 5)));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const k = new Kit().raw(geo, 0, h / 2, 0);
  // פתח המערה: שער סלע קצר שבולט מהמדרון, ובתוכו חושך
  const mz = r * 0.86;
  k.add(new THREE.CylinderGeometry(2.9, 3.3, 3.2, 9, 1, false, 0, Math.PI), 0x7a7e86, 0, 0, mz - 0.9, Math.PI / 2, Math.PI / 2, 0);
  k.add(new THREE.CircleGeometry(2.25, 14, 0, Math.PI), 0x1d1a22, 0, 0, mz + 0.72);
  k.add(new THREE.CircleGeometry(1.5, 12, 0, Math.PI), 0x0d0b10, 0, 0, mz + 0.74);
  for (let i = 0; i < 7; i++) {                                                    // אבני השער
    const a = (i / 6) * Math.PI;
    k.add(ball(0.62, 6, 5), i % 2 ? 0x9a9ea6 : 0x858991, Math.cos(a) * 2.55, Math.sin(a) * 2.55, mz + 0.62, 0, i, 0, 1, 0.9, 0.8);
  }
  const g = new THREE.Group();
  g.add(k.build());
  return g;
}

// ---------- מצוף דיג אדום-לבן שצף על המים ----------
function bobber() {
  const g = new THREE.Group();
  g.add(new Kit()
    .add(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xff4d5e, 0, 0.3, 0)
    .add(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xffffff, 0, 0.3, 0)
    .add(cyl(0.04, 0.5, 6), 0xffd75e, 0, 0.8, 0)
    .add(ball(0.08, 6, 5), 0xff4d5e, 0, 1.08, 0)
    .add(new THREE.TorusGeometry(0.62, 0.035, 5, 20), 0xffffff, 0, 0.03, 0, Math.PI / 2, 0, 0)
    .build());
  g.add(hitZone(cyl(1.3, 2.2, 10), 0, 1, 0));
  return g;
}

// רושם פעולת נגיעה על כל חלקי האביזר (הלחיצה פוגעת ב-Mesh פנימי, לא בקבוצה)
function onTap(World, obj, fn) {
  obj.traverse(o => { if (o.isMesh) o.userData.activity = fn; });
  World.registerPickable(obj);
}

export const Props = { ferrisWheel, carousel, sailboat, bird, balloon, dartboard, lollipop, peak, bobber, onTap, BRIGHT };
