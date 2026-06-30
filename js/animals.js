// animals.js — חיות משק (מייצרות תוצרת) + חיות נוף (משוטטות לחיוּת)
import { World, THREE } from './world.js';

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
    this.ready = false;
    this.facing = 1; this.phase = Math.random() * 6;

    this.group = new THREE.Group();
    const a = Math.random() * Math.PI * 2, r = Math.random() * this.region.r;
    this.group.position.set(this.region.x + Math.cos(a) * r, 0, this.region.z + Math.sin(a) * r);

    this.shadow = World.makeGroundShadow(this.scale * 0.42);
    this.group.add(this.shadow);
    this.sprite = World.makeBillboard('assets/' + this.asset, this.scale);
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
    }
    this._newTarget();
  }

  _newTarget() {
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
    this.sprite.position.y = Math.abs(Math.sin(this.phase)) * 0.1 + hop;
    this.sprite.scale.x = this.scale * this.facing * breathe;
    this.sprite.scale.y = this.scale * (hop > 0 ? 1 + hop * 0.1 : breathe);
    if (this.produce && !this.ready && now - this.lastProduced >= this.produce.intervalMs) {
      this.ready = true; if (this.product) this.product.visible = true;
    }
    if (this.ready && this.product) {
      this.product.position.y = this.scale + 0.3 + Math.abs(Math.sin(this.phase * 0.5)) * 0.3;
    }
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
  }

  toJSON() { return { id: this.id, type: this.type, name: this.name, lastProduced: this.lastProduced }; }
}

const Animals = {
  list: [],
  add(opts) { const a = new Animal(opts); this.list.push(a); return a; },
  update(now, dt) { for (const a of this.list) a.update(now, dt); },
  productive() { return this.list.filter(a => a.produce); },
  count() { return this.productive().length; },
  clear() { for (const a of this.list) a.dispose(); this.list = []; },
  toJSON() { return this.productive().map(a => a.toJSON()); } // נשמרות רק חיות שנקנו
};

export { Animals, Animal, NAMES };
