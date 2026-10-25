// interiors.js — כניסה למבנים: האסם, המאפייה בכפר ובית בכפר.
// כל מבנה הוא "בית בובות": חדר תלת-ממדי עם קיר קדמי פתוח, בסצנה נפרדת שמוחלפת ברינדור.
// בפנים יש דברים לגעת בהם (סוסים בתאים, חציר, חתול, עכבר מתחבא, תנור, ספרים) —
// כל פעולה עוברת דרך askProblem כמו בשאר המשחק. העולם בחוץ ממשיך לחיות (יבול, חיות, שמירה).
import { World, THREE } from './world.js';
import { Audio } from './audio.js';
import { Horse3D } from './horse3d.js';
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

const ROOMS = {
  barn: {
    title: '🏠 בתוך האסם', say: 'נכנסנו לאסם! כאן הסוסים ישנים. אפשר לגעת בסוס, בחציר, ובחתול. ואולי מתחבא כאן עכבר?',
    build(I, room, deps) {
      shell(room, { floorA: '#b98b55', floorB: '#a97b48', wall: 0xb5523b, trim: 0x7a3b28 });
      lights(room, 0xffc77a);
      const wood = mat(0x8a5a2b), hay = mat(0xe8c66a);
      // ארבעה תאים לסוסים לאורך הקיר האחורי
      const horses = deps.Horses.list.slice(0, 4);
      for (let i = 0; i < 4; i++) {
        const x = -5.4 + i * 3.6;
        box(room, 0.18, 1.6, 3.4, wood, x - 1.8, 0.8, -3.2);
        if (i === 3) box(room, 0.18, 1.6, 3.4, wood, x + 1.8, 0.8, -3.2);
        const straw = new THREE.Mesh(new THREE.CircleGeometry(1.5, 12), hay); straw.rotation.x = -Math.PI / 2; straw.position.set(x, 0.02, -3.2); room.add(straw);
        const h = horses[i];
        const plate = plateTex(h ? h.name : 'תא פנוי'); plate.position.set(x, 2.25, -4.8); room.add(plate);
        if (!h) continue;
        const fake = { stage: h.stage, color: h.color, group: new THREE.Group() };
        fake.group.position.set(x, 0, -3.0);
        room.add(fake.group);
        const h3d = new Horse3D(fake);
        h3d.init().then(() => { h3d.lookDir = new THREE.Vector3(-x, 0, 16); }).catch(() => {});   // מסתכלים אל המצלמה
        I.anims.push((dt) => h3d.update(dt, { moving: false, sleeping: false }));
        I.tap(fake.group, () => deps.stallCare(h, (res) => {
          if (h3d.ready) h3d.once('eat', 2.5);
          I.burst(fake.group.position, ['🧼', '❤️', '✨'], 12);
        }), 'stall');
      }
      // ערימת חציר + חתול שישן עליה
      const pile = prop('hay_bale.glb', 1.6, { fallback: '🌾' }); pile.position.set(-6.5, 0, 2.2); room.add(pile);
      const pile2 = prop('hay_bale.glb', 1.6, { fallback: '🌾', yaw: 0.7 }); pile2.position.set(-4.6, 0, 2.6); room.add(pile2);
      const pile3 = prop('hay_bale.glb', 1.5, { fallback: '🌾', yaw: 0.3 }); pile3.position.set(-5.6, 1.5, 2.3); room.add(pile3);
      I.tap(pile, () => deps.ask('harvest', (res) => { deps.coins(8); I.burst(pile.position, ['🌾', '🪙'], 12); Audio.speak('אספת חציר לסוסים'); deps.event('barn_hay'); }), 'hay');
      I.tap(pile2, () => I.taps.find(t => t.kind === 'hay').fn(), 'hay2');
      const cat = prop('cat.glb', 0.9, { fallback: '🐱', yaw: 0.6 }); cat.position.set(-5.6, 3.0, 2.3); room.add(cat);
      I.tap(cat, () => { Audio.animalSound('cat'); I.burst(cat.position, ['❤️', '💤'], 8); Audio.speak('מיאו! החתול אוהב לישון על החציר'); }, 'cat');
      // שולחן כלים: אוכף, פרסה, דלי
      box(room, 3.2, 0.15, 1.2, wood, 6.2, 1.1, 3.0);
      for (const x of [4.8, 7.6]) box(room, 0.15, 1.1, 1.0, wood, x, 0.55, 3.0);
      const saddle = emoji('🏇', 0.9); saddle.position.set(5.6, 1.2, 3.0); room.add(saddle);
      const shoe = emoji('🪢', 0.7); shoe.position.set(6.6, 1.2, 3.0); room.add(shoe);
      const bucket = prop('water_bucket.glb', 0.8, { fallback: '🪣' }); bucket.position.set(7.4, 1.18, 3.0); room.add(bucket);
      I.tap(bucket, () => deps.ask('feed', () => { deps.coins(6); I.burst(bucket.position, ['💧', '💧', '✨'], 10); Audio.speak('מילאת מים לסוסים'); deps.event('barn_water'); }), 'water');
      // פנס תלוי
      const lantern = emoji('🏮', 1.0); lantern.position.set(0, H - 1.6, 0.5); room.add(lantern);
      I.addHider(['🐭'], [[-3.3, 0, 3.4], [2.6, 0, 3.6], [-7.6, 0, -0.5], [7.8, 0, -1.2], [3.2, 0, -1.4], [-1.0, 0, -1.4]]);
    }
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
      I.tap(baker, () => { I.burst(baker.position, ['❤️'], 6); Audio.speak('שלום אגם! תודה שבאת לעזור לי באפייה'); }, 'baker');
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
