// animals.js — חיות משק (מייצרות תוצרת) + חיות נוף (משוטטות לחיוּת)
import { World, THREE } from './world.js';

// גורים: חיה שנקנתה ממליטה גור אחרי זמן, והגור גדל לבד עד שהוא בגודל מלא ומתחיל לתת תוצרת
const BIRTH_MS = 4 * 60 * 1000;     // כמה זמן עד שחיה בוגרת מוכנה להמליט
const GROW_MS = 3 * 60 * 1000;      // כמה זמן לוקח לגור לגדול
const BABY_SIZE = 0.45;             // גור נולד בחצי גודל בערך
const MAX_PER_TYPE = 5, MAX_TOTAL = 18;
const NAMES = ['פצפון', 'בּוּבּי', 'חמודי', 'פלאפי', 'קוקי', 'ננסי', 'שוקו', 'מרשמלו', 'כתם', 'שלגי', 'זנבי', 'ברק'];
let _id = 1;

class Animal {
  constructor(opts = {}) {
    this.id = opts.id || _id++;
    if (opts.id && opts.id >= _id) _id = opts.id + 1;
    this.type = opts.type;
    this.asset = opts.asset || (opts.type + '.png');
    this.scale = opts.scale || 1.7;
    this.produce = opts.produce || null;            // {emoji,intervalMs,sell}
    this.region = opts.region || { x: 0, z: -6, r: 5 };
    this.name = opts.name || NAMES[Math.floor(Math.random() * NAMES.length)];
    this.lastProduced = opts.lastProduced || Date.now();
    this.baby = !!opts.baby;                          // גור שעוד גדל
    this.bornAt = opts.bornAt || Date.now();
    this.lastBirth = opts.lastBirth || Date.now();    // ההמלטה הבאה נמדדת מכאן
    this.birthReady = false;
    this.ready = false;
    this.facing = 1; this.phase = Math.random() * 6;

    this.group = new THREE.Group();
    const a = Math.random() * Math.PI * 2, r = Math.random() * this.region.r;
    this.group.position.set(this.region.x + Math.cos(a) * r, 0, this.region.z + Math.sin(a) * r);

    this.shadow = World.makeGroundShadow(this.scale * 0.42);
    this.group.add(this.shadow);
    this.sprite = World.makeBillboard('assets/' + this.asset, this.size());
    this.sprite.userData.animal = this;
    this.group.add(this.sprite);
    World.scene.add(this.group);
    World.registerPickable(this.sprite);

    if (this.produce) {
      this.product = World.emojiSprite(this.produce.emoji, 1.2);
      this.product.center.set(0.5, 0.0);
      this.product.position.set(0, this.scale + 0.3, 0);
      this.product.visible = false;
      this.group.add(this.product);
      this.birthIcon = World.emojiSprite('🍼', 1.3);
      this.birthIcon.center.set(0.5, 0.0);
      this.birthIcon.visible = false;
      this.group.add(this.birthIcon);
    }
    this._newTarget();
  }

  // גודל נוכחי: גור גדל בהדרגה מ-45% לגודל מלא
  growth(now = Date.now()) { return this.baby ? Math.min(1, (now - this.bornAt) / GROW_MS) : 1; }
  size(now) { return this.scale * (BABY_SIZE + (1 - BABY_SIZE) * this.growth(now)); }

  _newTarget() {
    // גור הולך ליד אמא שלו
    const mom = this.momId && Animals.list.find(a => a.id === this.momId);
    if (this.baby && mom) {
      const a = Math.random() * Math.PI * 2;
      this.target = mom.group.position.clone().add(new THREE.Vector3(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4));
      this.wait = 0.5 + Math.random() * 1.5;
      return;
    }
    const a = Math.random() * Math.PI * 2, r = Math.random() * this.region.r;
    this.target = new THREE.Vector3(this.region.x + Math.cos(a) * r, 0, this.region.z + Math.sin(a) * r);
    this.wait = 1 + Math.random() * 3;
  }

  update(now, dt) {
    const pos = this.group.position, to = this.target.clone().sub(pos); to.y = 0;
    const d = to.length();
    if (d > 0.3 && this.wait <= 0) {
      to.normalize();
      pos.addScaledVector(to, (this.produce ? 0.8 : 1.2) * dt);
      if (Math.abs(to.x) > 0.05) this.facing = to.x > 0 ? -1 : 1;
    } else {
      this.wait -= dt; if (this.wait < -1) this._newTarget();
    }
    this.phase += dt * 4;
    if (this._hop > 0) this._hop -= dt;
    const hop = this._hop > 0 ? Math.sin((1 - this._hop / 0.6) * Math.PI) * 0.6 : 0;
    const breathe = 1 + Math.sin(this.phase * 0.5) * 0.03;
    const sz = this.size(now);
    if (this.baby && this.growth(now) >= 1) {        // הגור גדל! מעכשיו הוא נותן תוצרת
      this.baby = false; this.lastProduced = now; this.lastBirth = now;
      Animals.onGrown && Animals.onGrown(this);
    }
    this.sprite.position.y = Math.abs(Math.sin(this.phase)) * 0.1 + hop;
    this.sprite.scale.x = sz * this.facing * breathe;
    this.sprite.scale.y = sz * (hop > 0 ? 1 + hop * 0.1 : breathe);
    if (this.produce && !this.baby && !this.ready && now - this.lastProduced >= this.produce.intervalMs) {
      this.ready = true; if (this.product) this.product.visible = true;
    }
    if (this.ready && this.product) {
      this.product.position.y = sz + 0.3 + Math.abs(Math.sin(this.phase * 0.5)) * 0.3;
    }
    // מוכנה להמליט: בקבוק קטן מעל הראש (אם יש מקום בחווה)
    if (this.birthIcon) {
      this.birthReady = !this.baby && now - this.lastBirth >= BIRTH_MS && Animals.canBirth(this.type);
      this.birthIcon.visible = this.birthReady;
      if (this.birthReady) {
        this.birthIcon.position.set(this.ready ? 1.0 : 0, sz + 0.4 + Math.abs(Math.sin(this.phase * 0.4)) * 0.3, 0);
      }
    }
  }

  // הגור הולך ליד אמא — מעדכנים יעד כשהיא מתרחקת
  followMom() {
    const mom = this.momId && Animals.list.find(a => a.id === this.momId);
    if (mom && this.baby && this.target.distanceTo(mom.group.position) > 3) this._newTarget();
  }

  remainingSec(now) { return this.produce ? Math.max(0, Math.ceil((this.produce.intervalMs - (now - this.lastProduced)) / 1000)) : 0; }

  collect(now) {
    this.ready = false; this.lastProduced = now;
    if (this.product) this.product.visible = false;
    return this.produce ? this.produce.sell : 0;
  }

  celebrate() { this._hop = 0.6; }

  dispose() {
    World.unregisterPickable(this.sprite);
    World.scene.remove(this.group);
    if (this.sprite.material.map) this.sprite.material.map.dispose();
    this.sprite.material.dispose();
    if (this.shadow) {
      this.shadow.geometry.dispose();
      if (this.shadow.material.map) this.shadow.material.map.dispose();
      this.shadow.material.dispose();
    }
    if (this.product) this.product.material.dispose();
    if (this.birthIcon) this.birthIcon.material.dispose();
  }

  toJSON() {
    return { id: this.id, type: this.type, name: this.name, lastProduced: this.lastProduced,
      baby: this.baby, bornAt: this.bornAt, lastBirth: this.lastBirth, momId: this.momId || null };
  }
}

const Animals = {
  list: [],
  onGrown: null,      // main.js: הודעה כשגור גדל
  add(opts) { const a = new Animal(opts); if (opts.momId) a.momId = opts.momId; this.list.push(a); return a; },
  update(now, dt) { for (const a of this.list) { a.update(now, dt); a.followMom(); } },
  remove(a) { const i = this.list.indexOf(a); if (i >= 0) this.list.splice(i, 1); a.dispose(); },
  // יש מקום לעוד גור מהסוג הזה?
  canBirth(type) {
    const prod = this.productive();
    return prod.length < MAX_TOTAL && prod.filter(a => a.type === type).length < MAX_PER_TYPE;
  },
  // אמא ממליטה: גור קטן נולד לידה
  birth(mom, now = Date.now()) {
    mom.lastBirth = now; mom.birthReady = false;
    const baby = this.add({ type: mom.type, asset: mom.asset, scale: mom.scale, produce: mom.produce,
      region: mom.region, baby: true, bornAt: now, lastBirth: now, momId: mom.id });
    baby.group.position.copy(mom.group.position).add(new THREE.Vector3(1.2, 0, 0.6));
    baby._newTarget();
    return baby;
  },
  productive() { return this.list.filter(a => a.produce); },
  count() { return this.productive().length; },
  clear() { for (const a of this.list) a.dispose(); this.list = []; },
  toJSON() { return this.productive().map(a => a.toJSON()); } // נשמרות רק חיות שנקנו
};

export { Animals, Animal, NAMES };
