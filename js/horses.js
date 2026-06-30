// horses.js — סוסים: שלטים בעברית, תנועה חופשית, סטטיסטיקות, גדילה
import { World, THREE } from './world.js';

const NAMES = ['כוכב', 'ברק', 'סוכר', 'ענן', 'פרח', 'יהלום', 'נסיכה', 'אלוף',
  'דבש', 'תות', 'שלג', 'זהבה', 'רוח', 'נמר', 'מלכה', 'אגוז', 'קפיץ', 'חלום'];
const COLORS = ['brown', 'white', 'golden', 'gray', 'pink', 'black', 'spotted', 'unicorn'];
const ROAM = 12;

let _id = 1;

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 80;
  const g = c.getContext('2d');
  g.font = 'bold 44px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // רקע גלולה
  const w = Math.min(240, g.measureText(text).width + 40);
  const x = 128 - w / 2;
  g.fillStyle = 'rgba(0,59,70,0.85)';
  roundRect(g, x, 16, w, 48, 24); g.fill();
  g.lineWidth = 3; g.strokeStyle = '#D4AF37'; roundRect(g, x, 16, w, 48, 24); g.stroke();
  g.fillStyle = '#fff';
  g.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(3.2, 1.0, 1);
  return sp;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

class Horse {
  constructor(opts = {}) {
    this.id = opts.id || _id++;
    if (opts.id && opts.id >= _id) _id = opts.id + 1;
    this.name = opts.name || NAMES[Math.floor(Math.random() * NAMES.length)];
    this.color = opts.color || COLORS[Math.floor(Math.random() * COLORS.length)];
    this.stage = opts.stage || 'foal';      // foal | adult
    this.hunger = opts.hunger ?? 80;          // שובע
    this.happy = opts.happy ?? 80;
    this.clean = opts.clean ?? 80;
    this.feedCount = opts.feedCount || 0;     // כמה פעמים הואכל (לגדילה)

    this.group = new THREE.Group();
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * (ROAM - 3);
    this.group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);

    this.shadow = World.makeGroundShadow(this._height() * 0.42);
    this.group.add(this.shadow);

    this.sprite = World.makeBillboard(this._tex(), this._height());
    this.sprite.userData.horse = this;
    this.group.add(this.sprite);

    this.label = makeLabel(this.name);
    this.label.position.y = this._height() + 0.6;
    this.group.add(this.label);

    World.scene.add(this.group);
    World.registerPickable(this.sprite);

    this.phase = Math.random() * Math.PI * 2;
    this._newTarget();
    this.facing = 1;
  }

  _height() { return this.stage === 'adult' ? 4.2 : 2.7; }
  _tex() { return `assets/${this.stage === 'adult' ? 'horse' : 'foal'}_${this.color}.png`; }

  _newTarget() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * ROAM;
    this.target = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    this.wait = 1 + Math.random() * 3;
  }

  grow() {
    if (this.stage === 'adult') return false;
    this.stage = 'adult';
    this.sprite.material.map = World.loadTexture(this._tex());
    this.sprite.material.needsUpdate = true;
    this.sprite.scale.set(this._height(), this._height(), 1);
    this.label.position.y = this._height() + 0.6;
    this.shadow.scale.set(this._height() * 0.42 * 2 / 3.2, 1, this._height() * 0.42 * 2 / 3.2);
    return true;
  }

  mood() { return Math.round((this.hunger + this.happy + this.clean) / 3); }

  update(dt) {
    // דעיכת סטטיסטיקות איטית — עם רצפה גבוהה כדי שהסוס לעולם לא ייראה מוזנח (ללא תחושת כישלון)
    this.hunger = Math.max(50, this.hunger - 0.5 * dt);
    this.happy = Math.max(50, this.happy - 0.35 * dt);
    this.clean = Math.max(50, this.clean - 0.3 * dt);

    // תנועה אל היעד
    const pos = this.group.position;
    const to = this.target.clone().sub(pos); to.y = 0;
    const d = to.length();
    if (d > 0.3 && this.wait <= 0) {
      to.normalize();
      const speed = (this.stage === 'adult' ? 1.4 : 1.1);
      pos.addScaledVector(to, speed * dt);
      if (Math.abs(to.x) > 0.05) this.facing = to.x > 0 ? -1 : 1;
    } else {
      this.wait -= dt;
      if (this.wait < -1) this._newTarget();
    }

    // קפיצה עדינה + כיוון פנים
    this.phase += dt * 3;
    const h = this._height();
    this.sprite.position.y = Math.abs(Math.sin(this.phase)) * 0.12;
    this.sprite.scale.x = h * this.facing;
    this.sprite.scale.y = h;

    // הסוס תמיד צבעוני ושמח
  }

  dispose() {
    World.unregisterPickable(this.sprite);
    World.scene.remove(this.group);
    if (this.sprite.material.map) this.sprite.material.map.dispose();
    this.sprite.material.dispose();
    if (this.label.material.map) this.label.material.map.dispose();
    this.label.material.dispose();
    if (this.shadow) {
      if (this.shadow.geometry) this.shadow.geometry.dispose();
      if (this.shadow.material.map) this.shadow.material.map.dispose();
      this.shadow.material.dispose();
    }
  }

  toJSON() {
    return { id: this.id, name: this.name, color: this.color, stage: this.stage,
      hunger: this.hunger, happy: this.happy, clean: this.clean, feedCount: this.feedCount };
  }
}

const Horses = {
  list: [],
  add(opts) { const h = new Horse(opts); this.list.push(h); return h; },
  remove(h) { const i = this.list.indexOf(h); if (i >= 0) this.list.splice(i, 1); h.dispose(); },
  getById(id) { return this.list.find(h => h.id === id); },
  update(dt) { for (const h of this.list) h.update(dt); },
  clear() { for (const h of this.list) h.dispose(); this.list = []; },
  randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; },
  randomName() {
    const used = new Set(this.list.map(h => h.name));
    const free = NAMES.filter(n => !used.has(n));
    return (free.length ? free : NAMES)[Math.floor(Math.random() * (free.length ? free.length : NAMES.length))];
  },
  toJSON() { return this.list.map(h => h.toJSON()); }
};

export { Horses, Horse, COLORS, NAMES };
