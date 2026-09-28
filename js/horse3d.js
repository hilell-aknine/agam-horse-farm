// horse3d.js — סוס תלת-ממדי אמיתי עם שלד ואנימציות (Quaternius, CC0), במקום ציור שטוח.
// הסוס נשאר אותו אובייקט במשחק: נגיעה, האכלה, שמירה ותנועה לא משתנים. רק המראה מתחלף.
// אם המודל לא נטען (אין רשת, קובץ חסר) — הסוס נשאר ציור, והמשחק ממשיך כרגיל.
import { THREE } from './world.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = 'assets/models/horse.glb';
const ADULT_HEIGHT = 3.8;      // גובה הגוף — מותאם לגודל הנראה של סוסי-הציור (הציור כולל שוליים ריקים)
const FOAL_SCALE = 0.72;

// צבע הגוף לכל סוג סוס במשחק (החומר "Main" במודל)
const BODY = {
  brown: 0x9a5b2e, white: 0xf2efe8, golden: 0xe3b35c, gray: 0x9c9fa3,
  pink: 0xf3a5c8, black: 0x3a3330, spotted: 0xc9a27a, unicorn: 0xf5f0ff
};
const HAIR = {
  brown: 0x4a2a17, white: 0xe9dfc8, golden: 0xfff1c9, gray: 0x5d6166,
  pink: 0xd94f8c, black: 0x1c1816, spotted: 0x4a2a17, unicorn: 0xb68cf0
};

// הקובץ יורד פעם אחת; כל סוס בונה ממנו מודל עצמאי (שלד, אנימציות וחומרים משלו)
let _buf = null;
function loadModel() {
  if (!_buf) _buf = fetch(MODEL_URL).then(r => { if (!r.ok) throw new Error('model ' + r.status); return r.arrayBuffer(); });
  return _buf.then(b => new Promise((res, rej) => new GLTFLoader().parse(b.slice(0), '', res, rej)));
}

let _ramp = null;
function toonRamp() {
  if (_ramp) return _ramp;
  const d = new Uint8Array([90, 170, 255]);           // צל, אמצע, אור
  _ramp = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  _ramp.minFilter = _ramp.magFilter = THREE.NearestFilter;
  _ramp.needsUpdate = true;
  return _ramp;
}

// אנימציות שבמודל (בלי הכפילויות "AnimalArmature|...")
const CLIP = { idle: 'Idle', idle2: 'Idle_2', sleep: 'Idle_Headlow', walk: 'Walk', gallop: 'Gallop', eat: 'Eating', jump: 'Jump_toIdle' };

class Horse3D {
  constructor(horse) {
    this.horse = horse;
    this.ready = false;
    this.current = null;
    this.oneShot = 0;           // שניות שנשארו לאנימציה חד-פעמית (אכילה/קפיצה)
    this.yaw = 0;
  }

  async init() {
    const gltf = await loadModel();
    this.root = gltf.scene;
    this.clips = gltf.animations;
    this._fit();
    this._paint();
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    for (const k in CLIP) {
      const clip = this.clips.find(c => c.name === CLIP[k]);
      if (clip) this.actions[k] = this.mixer.clipAction(clip);
    }
    this.horse.group.add(this.root);
    this.ready = true;
    this.play('idle');
    return this;
  }

  _fit() {
    const s = this.root;
    s.scale.setScalar(1); s.position.set(0, 0, 0); s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s);
    const h = box.max.y - box.min.y || 1;
    const k = (ADULT_HEIGHT / h) * (this.horse.stage === 'adult' ? 1 : FOAL_SCALE);
    s.scale.setScalar(k);
    s.position.y = -box.min.y * k;
  }

  // צביעה לפי צבע הסוס במשחק
  _paint() {
    const c = this.horse.color;
    this.root.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map(m => {
        let col = m.color ? m.color.getHex() : 0xffffff;
        if (m.name === 'Main') col = BODY[c] ?? BODY.brown;
        else if (m.name === 'Main_Light') col = new THREE.Color(BODY[c] ?? BODY.brown).offsetHSL(0, -0.05, 0.12).getHex();
        else if (m.name === 'Hair') col = HAIR[c] ?? HAIR.brown;
        // מט, כמו שאר מודלי העולם (אותו יוצר, אותו סגנון)
        const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, metalness: 0, name: m.name });
        mat.emissive.copy(mat.color).multiplyScalar(0.32);   // כמו שאר המודלים (models3d.js)
        return mat;
      });
      o.material = out.length === 1 ? out[0] : out;
    });
  }

  // "קליפה הפוכה": עותק של הגוף, מנופח מעט לאורך הנורמלים ומצויר רק מבפנים בצבע כהה
  _outline(mesh) {
    const box = new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
    const size = box.getSize(new THREE.Vector3()).length();
    const mat = new THREE.MeshBasicMaterial({ color: 0x2b1a10, side: THREE.BackSide });
    const t = (size * 0.012).toFixed(5);
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
 transformed += normalize(objectNormal) * ${t};`);
    };
    const o = new THREE.SkinnedMesh(mesh.geometry, mat);
    o.bind(mesh.skeleton, mesh.bindMatrix);
    o.frustumCulled = false;
    mesh.parent.add(o);
  }

  grow() { if (this.ready) this._fit(); }

  play(name, fade = 0.25) {
    const next = this.actions[name];
    if (!next || this.current === next) return;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
  }

  // אנימציה חד-פעמית (אכילה, קפיצת שמחה) — ואז חוזרים למצב הרגיל
  once(name, seconds) {
    const a = this.actions[name];
    if (!a) return;
    this.play(name, 0.15);
    this.oneShot = seconds ?? a.getClip().duration;
  }

  update(dt, { moving, sleeping, dir }) {
    if (!this.ready) return;
    this.mixer.update(dt);
    if (this.oneShot > 0) { this.oneShot -= dt; }
    else if (sleeping) this.play('sleep', 0.6);
    else if (moving) this.play('walk');
    else this.play('idle');
    // פונה לכיוון ההליכה, בסיבוב רך
    if (moving && dir && (dir.x || dir.z)) {
      const want = Math.atan2(dir.x, dir.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 6);
      this.root.rotation.y = this.yaw;
    }
  }
}

export { Horse3D, loadModel };
