// fields.js — חלקות שדה: שתילה, גדילה בזמן אמת (ללא לחץ/הפסד), קצירה
import { World, THREE } from './world.js';

// עד 9 חלקות, רשת 3x3 באזור גינת הירק (חזית-שמאל)
const SLOTS = [];
(function () {
  const xs = [-10.2, -7.5, -4.8], zs = [0.6, 3.5, 6.4];
  for (const z of zs) for (const x of xs) SLOTS.push(new THREE.Vector3(x, 0, z));
})();

class Plot {
  constructor(index) {
    this.index = index;
    this.pos = SLOTS[index].clone();
    this.state = 'empty';     // empty | growing | ready
    this.cropKey = null; this.plantedAt = 0; this.growMs = 0;
    this.phase = Math.random() * 6;

    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.35, 2.3),
      new THREE.MeshStandardMaterial({ color: 0x804d28, roughness: 1 })
    );
    soil.position.y = 0.17; soil.receiveShadow = true; soil.castShadow = true;
    soil.userData.plot = this;
    this.group.add(soil);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.06, 2.0),
      new THREE.MeshStandardMaterial({ color: 0x5e3719, roughness: 1 })
    );
    top.position.y = 0.36;
    this.group.add(top);
    this.soil = soil;
    World.scene.add(this.group);
    World.registerPickable(soil);

    this.sprout = World.emojiSprite('🌱', 1.0);
    this.sprout.center.set(0.5, 0.0);
    this.sprout.position.set(this.pos.x, 0.42, this.pos.z);
    this.sprout.visible = false;
    World.scene.add(this.sprout);

    this.crop = null;
  }

  plant(def, now) {
    this.state = 'growing';
    this.cropKey = def.key;
    this.growMs = def.growMs;
    this.plantedAt = now;
    if (this.crop) { World.unregisterPickable(this.crop); World.scene.remove(this.crop); this.crop.material.dispose(); this.crop = null; }
    this.crop = World.makeBillboard('assets/' + def.asset, def.size || 2.0);
    this.crop.position.set(this.pos.x, 0.4, this.pos.z);
    this.crop.userData.plot = this;
    this.crop.visible = false;
    World.scene.add(this.crop);
    World.registerPickable(this.crop);
    this.sprout.visible = true;
  }

  progress(now) { return this.growMs ? Math.min(1, (now - this.plantedAt) / this.growMs) : 0; }
  remainingSec(now) { return Math.max(0, Math.ceil((this.growMs - (now - this.plantedAt)) / 1000)); }

  update(now, dt) {
    if (this.state === 'growing') {
      const p = this.progress(now);
      const s = 0.55 + p * 1.1;
      this.sprout.scale.set(s, s, 1);
      if (p >= 1) { this.state = 'ready'; this.sprout.visible = false; if (this.crop) this.crop.visible = true; }
    }
    if (this.state === 'ready' && this.crop) {
      this.phase += dt * 2.5;
      this.crop.position.y = 0.4 + Math.abs(Math.sin(this.phase)) * 0.2;
    }
  }

  harvest() {
    const key = this.cropKey;
    this.state = 'empty'; this.cropKey = null; this.plantedAt = 0; this.growMs = 0;
    this.sprout.visible = false;
    if (this.crop) { this.crop.visible = false; World.unregisterPickable(this.crop); World.scene.remove(this.crop); this.crop.material.dispose(); this.crop = null; }
    return key;
  }

  dispose() {
    World.unregisterPickable(this.soil);
    if (this.crop) {
      World.unregisterPickable(this.crop);
      if (this.crop.material.map) this.crop.material.map.dispose();
      this.crop.material.dispose();
    }
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    World.scene.remove(this.group);
    World.scene.remove(this.sprout);
    this.sprout.material.dispose(); // הטקסטורה משותפת (אימוג'י במטמון) — לא משחררים אותה
  }

  toJSON() { return { index: this.index, state: this.state, cropKey: this.cropKey, plantedAt: this.plantedAt, growMs: this.growMs }; }
}

const Fields = {
  plots: [],
  maxPlots: SLOTS.length,

  ensure(n) { while (this.plots.length < n && this.plots.length < this.maxPlots) this.plots.push(new Plot(this.plots.length)); },
  count() { return this.plots.length; },
  canExpand() { return this.plots.length < this.maxPlots; },
  freePlot() { return this.plots.find(p => p.state === 'empty'); },
  hasFree() { return !!this.freePlot(); },
  update(now, dt) { for (const p of this.plots) p.update(now, dt); },
  toJSON() { return this.plots.map(p => p.toJSON()); },

  load(arr, CROPS, now) {
    this.ensure((arr && arr.length) || 0);
    if (!arr) return;
    arr.forEach((d, i) => {
      const p = this.plots[i];
      if (!p) return;
      if ((d.state === 'growing' || d.state === 'ready') && d.cropKey && CROPS[d.cropKey]) {
        const def = Object.assign({ key: d.cropKey }, CROPS[d.cropKey]);
        p.plant(def, d.plantedAt || now);
        p.growMs = d.growMs || def.growMs;
      }
    });
  },

  clear() { for (const p of this.plots) p.dispose(); this.plots = []; }
};

export { Fields };
