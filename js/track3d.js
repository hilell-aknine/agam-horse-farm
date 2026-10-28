// track3d.js — מסלול הרכיבה: אגם רוכבת על הסוס שלה במסלול אליפסה עם 4 משוכות.
// לפני כל משוכה הסוס עוצר ומחכה, אגם פותרת תרגיל, והסוס קופץ. אין הפסד: טעות מראה רמז,
// שתי טעויות חושפות את התשובה, והסוס קופץ בכל מקרה. ניסיון ראשון = ⭐ שנאסף באוויר.
// המצלמה רודפת אחרי הסוס; בסוף הסיבוב — סיכום כוכבים, "עוד סיבוב" או חזרה.
import { World, THREE } from './world.js';
import { Audio } from './audio.js';
import { Horse3D } from './horse3d.js';
import { generateProblem } from './math.js';

const C = { x: -42, z: -62 };            // מרכז המסלול: בין החווה ליער, הרחק מהגבעות
const RX = 17, RZ = 11, W = 4.4;         // רדיוסי קו האמצע ורוחב המסלול
const JUMPS = [0.17, 0.39, 0.62, 0.84];  // מיקום המשוכות כחלק מהסיבוב
const CRUISE = 8.5, ACCEL = 5, BRAKE = 6;
const STOP_BEFORE = 5.5;                 // הסוס עוצר כמה יחידות לפני המשוכה
const RIDER_Y = 2.3, RIDER_Z = -0.15;    // מושב הרוכבת על גב הסוס (נמדד בצילום)

function mat(color, glow = 0.25) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true });
  m.emissive.copy(m.color).multiplyScalar(glow);
  return m;
}
function shadowed(o) { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; }
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

// ---------- גיאומטריית המסלול: טבלת אורך-קשת כדי שהסוס ירוץ במהירות אחידה ----------
const N = 480;
const TABLE = (() => {
  const pts = [], cum = [0];
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;                     // מתחילים בצד ימין — השער לא חוסם את מבט המצלמה
    pts.push(new THREE.Vector3(C.x + Math.cos(th) * RX, 0, C.z + Math.sin(th) * RZ));
    if (i) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  return { pts, cum, L: cum[N] };
})();
const LAP = TABLE.L;
// נקודה וכיוון במרחק s לאורך המסלול
function at(s) {
  s = ((s % LAP) + LAP) % LAP;
  let lo = 0, hi = N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TABLE.cum[m] <= s) lo = m; else hi = m; }
  const k = (s - TABLE.cum[lo]) / Math.max(1e-6, TABLE.cum[hi] - TABLE.cum[lo]);
  const p = TABLE.pts[lo].clone().lerp(TABLE.pts[hi], k);
  const t = TABLE.pts[hi].clone().sub(TABLE.pts[lo]).normalize();
  return { p, t, n: new THREE.Vector3(-t.z, 0, t.x) };   // n = הצד (החוצה/פנימה)
}
const JUMP_S = JUMPS.map(f => f * LAP);

// ---------- בניית העולם של המסלול ----------
function ellipseShape(rx, rz) {
  const s = new THREE.Shape(); s.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0); return s;
}
function stripeTex(a, b, n = 6) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16;
  const g = c.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 128 / n, 0, 128 / n + 1, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function bannerTex(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#222' : '#fff'; g.fillRect(x * 32, y * 32, 32, 32); }
  g.fillStyle = 'rgba(10,77,87,.92)'; g.beginPath(); g.roundRect(70, 18, 372, 92, 24); g.fill();
  g.fillStyle = '#ffcf4d'; g.font = 'bold 58px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function railRing(group, rx, rz, color, count) {
  const post = mat(color), rail = mat(color);
  const pts = [];
  for (let i = 0; i < count; i++) { const a = (i / count) * Math.PI * 2; pts.push([Math.cos(a) * rx, Math.sin(a) * rz]); }
  pts.forEach(([x, z], i) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), post);
    p.position.set(x, 0.55, z); group.add(p);
    const [x2, z2] = pts[(i + 1) % count];
    const len = Math.hypot(x2 - x, z2 - z);
    const r = new THREE.Mesh(new THREE.BoxGeometry(len + 0.05, 0.1, 0.1), rail);
    r.position.set((x + x2) / 2, 0.9, (z + z2) / 2);
    r.rotation.y = Math.atan2(-(z2 - z), x2 - x);
    group.add(r);
  });
}

// משוכה: שני עמודים מפוספסים, שני מוטות אדום-לבן, עציצי פרחים, מספר וכוכב
function makeJump(idx) {
  const g = new THREE.Group();
  const red = mat(0xe24b4b), white = mat(0xf7f3ea), green = mat(0x4caf50), pot = mat(0xb5703a);
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 + 0.15);
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.3), k % 2 ? white : red);
      b.position.set(x, 0.225 + k * 0.45, 0); g.add(b);
    }
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.7), pot); p.position.set(x + sx * 0.45, 0.15, 0); g.add(p);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), green); bush.position.set(x + sx * 0.45, 0.45, 0); g.add(bush);
  }
  const poleMat = new THREE.MeshStandardMaterial({ map: stripeTex('#e24b4b', '#ffffff', 8), roughness: 0.8 });
  poleMat.emissive.setHex(0x222222);
  for (const y of [0.55, 1.0]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, W + 0.3, 10), poleMat);
    pole.rotation.z = Math.PI / 2; pole.position.y = y; g.add(pole);
  }
  shadowed(g);
  const num = World.emojiSprite(['1️⃣', '2️⃣', '3️⃣', '4️⃣'][idx], 1.1);
  num.center.set(0.5, 0); num.position.set(W / 2 + 0.15, 1.95, 0); g.add(num);
  const star = World.emojiSprite('⭐', 1.3);
  star.center.set(0.5, 0.5); star.position.set(0, 2.6, 0); g.add(star);
  g.userData.star = star;
  return g;
}

// הרוכבת: אגם עם קסדה, חולצה ורודה וקוקו — יושבת על הסוס ומחזיקה מושכות
function makeRider() {
  const g = new THREE.Group();
  const skin = mat(0xf1c6a0), shirt = mat(0xff7eb6), pants = mat(0x3f6fd1), helmet = mat(0x3b2b5f), hair = mat(0x5a3418), boot = mat(0x2b211c);
  for (const sx of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.5), pants);
    thigh.position.set(sx * 0.33, 0.02, 0.15); g.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), pants);
    shin.position.set(sx * 0.46, -0.3, 0.32); g.add(shin);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.32), boot);
    b.position.set(sx * 0.46, -0.62, 0.38); g.add(b);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.55, 6), shirt);
    arm.position.set(sx * 0.27, 0.48, 0.24); arm.rotation.x = 1.05; g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), skin);
    hand.position.set(sx * 0.2, 0.36, 0.48); g.add(hand);
  }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.72, 10), shirt);
  torso.position.y = 0.4; torso.rotation.x = 0.12; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), skin);
  head.position.set(0, 0.98, 0.05); g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), helmet);
  cap.position.set(0, 1.02, 0.03); g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.16), helmet);
  brim.position.set(0, 1.03, 0.3); g.add(brim);
  const pony = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), hair);
  pony.position.set(0, 0.92, -0.27); g.add(pony);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 6), hair);
  tail.position.set(0, 0.68, -0.33); tail.rotation.x = Math.PI + 0.35; g.add(tail);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), boot);
    eye.position.set(sx * 0.09, 1.0, 0.27); g.add(eye);
  }
  return shadowed(g);
}

const FANS = ['🐰', '🐶', '🐱', '🦊', '🐷', '🐻', '🐥', '🐮'];

const Track3D = {
  center: C, built: false, active: null, fans: [],

  // נבנה פעם אחת עם העולם (אזור במפה כמו היער והאגם)
  build(deps) {
    if (this.built) return;
    this.built = true; this.deps = deps;
    const root = new THREE.Group();
    root.position.set(C.x, 0, C.z);
    World.scene.add(root);
    this.root = root;

    // דשא בהיר בפנים + טבעת עפר
    const dirtGeo = new THREE.ShapeGeometry((() => { const s = ellipseShape(RX + W / 2, RZ + W / 2); s.holes.push(ellipseShape(RX - W / 2, RZ - W / 2)); return s; })(), 96);
    dirtGeo.rotateX(-Math.PI / 2);
    const dirt = new THREE.Mesh(dirtGeo, new THREE.MeshStandardMaterial({ color: 0xd2a56c, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    dirt.position.y = 0.06; dirt.receiveShadow = true; root.add(dirt);
    const infieldGeo = new THREE.ShapeGeometry(ellipseShape(RX - W / 2, RZ - W / 2), 64); infieldGeo.rotateX(-Math.PI / 2);
    const infield = new THREE.Mesh(infieldGeo, new THREE.MeshStandardMaterial({ color: 0x93d867, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    infield.position.y = 0.05; infield.receiveShadow = true; root.add(infield);

    railRing(root, RX + W / 2 + 0.35, RZ + W / 2 + 0.35, 0xfafafa, 44);
    railRing(root, RX - W / 2 - 0.35, RZ - W / 2 - 0.35, 0xfafafa, 30);
    shadowed(root);

    // משוכות
    this.jumps = JUMP_S.map((s, i) => {
      const { p, t } = at(s);
      const j = makeJump(i);
      j.position.set(p.x, 0, p.z);
      j.rotation.y = Math.atan2(t.x, t.z);
      World.scene.add(j);
      return j;
    });

    // שער התחלה/סיום
    const s0 = at(0), gate = new THREE.Group();
    const pm = mat(0x1d8a99), gold = mat(0xffcf4d);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 0.35), pm);
      post.position.set(sx * (W / 2 + 0.6), 2.1, 0); gate.add(post);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), gold);
      ball.position.set(sx * (W / 2 + 0.6), 4.4, 0); gate.add(ball);
    }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.2, 1.3), new THREE.MeshBasicMaterial({ map: bannerTex('🏇 מסלול הרכיבה'), side: THREE.DoubleSide }));
    banner.position.y = 3.55; gate.add(banner);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.6), new THREE.MeshBasicMaterial({ map: bannerTex(''), transparent: true, opacity: 0.85 }));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.09; gate.add(line);
    shadowed(gate);
    gate.position.set(s0.p.x, 0, s0.p.z);
    gate.rotation.y = Math.atan2(s0.t.x, s0.t.z) + Math.PI;   // הכיתוב פונה אל המצלמה
    World.scene.add(gate);

    // יציע קהל: חיות חמודות שמריעות בכל קפיצה
    const stand = new THREE.Group(), wood = mat(0xa0683a), seat = mat(0xffcf4d);
    for (let r = 0; r < 2; r++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5 + r * 0.6, 1.2), r ? seat : wood);
      b.position.set(0, (0.5 + r * 0.6) / 2, -r * 1.2); stand.add(b);
    }
    shadowed(stand);
    const front = at(LAP * 0.04);
    stand.position.set(front.p.x + 0.0, 0, C.z + RZ + W / 2 + 2.6);
    stand.rotation.y = Math.PI;
    World.scene.add(stand);
    this.fans = [];
    for (let i = 0; i < 10; i++) {
      const f = World.emojiSprite(FANS[i % FANS.length], 1.25);
      f.center.set(0.5, 0);
      const row = i % 2;
      const baseY = row ? 1.1 : 0.5;
      f.position.set(stand.position.x - 5.2 + i * 1.15, baseY, stand.position.z + row * 1.2);
      f.userData = { baseY, ph: Math.random() * 6, cheer: 0 };
      World.scene.add(f); this.fans.push(f);
    }

    // דגלים, עצים ופרחים
    const flags = ['🚩', '🎏', '🚩', '🎏', '🚩', '🎏'];
    flags.forEach((e, i) => {
      const a = (i / flags.length) * Math.PI * 2 + 0.3;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), mat(0xdddddd));
      const x = C.x + Math.cos(a) * (RX + W / 2 + 1.6), z = C.z + Math.sin(a) * (RZ + W / 2 + 1.6);
      pole.position.set(x, 1.6, z); World.scene.add(pole);
      const fl = World.emojiSprite(e, 1.1); fl.center.set(0.1, 0.5); fl.position.set(x, 3.0, z); World.scene.add(fl);
    });
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * 0.45;
      const fl = World.makeBillboard('assets/flowers_wild.png', 1.4, true);
      fl.position.set(C.x + Math.cos(a) * (RX - W) * r, 0, C.z + Math.sin(a) * (RZ - W) * r);
      World.scene.add(fl);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.15;
      if (Math.sin(a) > 0.55) continue;                   // לא חוסמים את מבט המצלמה מקדימה
      const tr = World.makeBillboard(['assets/tree.png', 'assets/oak_tree.png', 'assets/pine_tree.png'][i % 3], 6.5 + Math.random() * 1.5, true);
      tr.position.set(C.x + Math.cos(a) * (RX + 9), 0, C.z + Math.sin(a) * (RZ + 8));
      World.scene.add(tr);
    }
    const sign = World.makeSign('🏇 מסלול רכיבה');
    sign.position.set(C.x + RX * 0.55, 0, C.z + RZ + W / 2 + 1.4);
    World.scene.add(sign);
  },

  // עדכון קבוע (גם כשלא רוכבים): כוכבים מסתובבים, קהל מנדנד
  idle(t, dt) {
    if (!this.built) return;
    for (const j of this.jumps) { const s = j.userData.star; if (s.visible) s.position.y = 2.6 + Math.sin(t * 2.4) * 0.15; }
    for (const f of this.fans) {
      const u = f.userData;
      if (u.cheer > 0) { u.cheer -= dt; f.position.y = u.baseY + Math.abs(Math.sin(u.cheer * 12)) * 0.6; }
      else f.position.y = u.baseY + Math.abs(Math.sin(t * 1.5 + u.ph)) * 0.05;
    }
  },
  cheer() { this.fans.forEach((f, i) => { f.userData.cheer = 1.2 + i * 0.05; }); },

  // ---------- רכיבה ----------
  // deps (ב-build): { Game, UI, onSolved(problem, firstTry, pos), onLap({stars,perfect}), onExit() }
  async start(horse) {
    if (this.active) return;
    const d = this.deps;
    const rig = new THREE.Group();
    const fake = { stage: 'adult', color: horse.color, group: new THREE.Group() };
    rig.add(fake.group);
    const h3d = new Horse3D(fake);
    try { await h3d.init(); } catch (e) { d.UI.toast('🐴 הסוס לא נטען, נסי שוב', true); return; }
    const rider = makeRider();
    rider.position.set(0, RIDER_Y, RIDER_Z);
    rig.add(rider);
    World.scene.add(rig);

    const S = this.active = {
      horse, rig, h3d, rider, s: -3, v: 0, state: 'go', next: 0, stars: 0, answered: [],
      jumpT: -1, jumpH: 0, t: 0, camInit: false
    };
    this.jumps.forEach(j => { j.userData.star.visible = true; });

    // מצלמה חופשית: בלי גבולות סיבוב, בלי נגיעות
    const ctl = World.controls;
    S.saved = { enabled: ctl.enabled, minA: ctl.minAzimuthAngle, maxA: ctl.maxAzimuthAngle, sun: World.sunLight.position.clone() };
    ctl.enabled = false; ctl.minAzimuthAngle = -Infinity; ctl.maxAzimuthAngle = Infinity;
    World._travel = null;
    if (!World.sunLight.target.parent) World.scene.add(World.sunLight.target);
    document.body.classList.add('riding');
    this._ui();
    Audio.animalSound('horse');
    Audio.speak('יוצאות לדרך עם ' + horse.name + '! לפני כל משוכה נפתור תרגיל');
  },

  _ui() {
    const S = this.active;
    const ui = el('div', 'ride-ui');
    ui.innerHTML = `
      <div class="ride-top">
        <button class="ride-exit" aria-label="יציאה">✖</button>
        <div class="ride-jumps">${JUMPS.map((_, i) => `<span data-j="${i}">${i + 1}</span>`).join('')}</div>
        <div class="ride-stars">⭐ <b>0</b></div>
      </div>
      <div class="ride-q hidden">
        <button class="ride-say" aria-label="שמיעה">🔊</button>
        <div class="ride-qtext"></div>
        <div class="ride-vis"></div>
        <div class="ride-hint hidden"></div>
      </div>
      <div class="ride-choices hidden"></div>
      <div class="ride-end hidden"></div>`;
    document.getElementById('ui').appendChild(ui);
    S.ui = ui;
    ui.querySelector('.ride-exit').onclick = () => { Audio.click(); this.stop(); };
  },

  _ask() {
    const S = this.active, d = this.deps, G = d.Game;
    S.state = 'ask';
    const focus = Math.random() < 0.35 ? G.weakType() : null;
    const pr = S.problem = generateProblem(G.difficulty(), focus);
    const q = S.ui.querySelector('.ride-q'), qt = q.querySelector('.ride-qtext'), vis = q.querySelector('.ride-vis');
    const hint = q.querySelector('.ride-hint'), ch = S.ui.querySelector('.ride-choices');
    qt.textContent = pr.question; qt.style.direction = pr.ltr ? 'ltr' : 'rtl';
    vis.style.direction = 'ltr';
    vis.innerHTML = d.UI._renderVisual(pr.visual);
    d.UI._wireCounting(vis);
    hint.classList.add('hidden'); hint.textContent = '';
    ch.innerHTML = '';
    if (S.choiceCtl) S.choiceCtl.stop();
    // אותו מנוע נגד ניחושים כמו בחלון התרגיל
    S.choiceCtl = d.UI.wireChoices(ch, pr, {
      hintEl: hint, visEl: vis,
      onCorrect: (res) => { setTimeout(() => { if (this.active === S && S.state === 'ask') this._answered(res.firstTry); }, 550); }
    });
    q.querySelector('.ride-say').onclick = () => Audio.speak(pr.speech || pr.question);
    q.classList.remove('hidden'); ch.classList.remove('hidden');
    Audio.speak((S.next === 0 ? 'משוכה ראשונה! ' : 'עוד משוכה! ') + (pr.speech || pr.question));
  },

  _answered(firstTry) {
    const S = this.active;
    if (!S) return;
    S.ui.querySelector('.ride-q').classList.add('hidden');
    S.ui.querySelector('.ride-choices').classList.add('hidden');
    S.answered[S.next] = firstTry;
    S.jumpH = firstTry ? 1.9 : 1.3;
    S.state = 'go';
    const pos = at(JUMP_S[S.next]).p;
    this.deps.onSolved(S.problem, firstTry, pos);
    const mark = S.ui.querySelector(`[data-j="${S.next}"]`);
    if (mark) { mark.classList.add(firstTry ? 'star' : 'ok'); mark.textContent = firstTry ? '⭐' : '✔'; }
    Audio.speak(firstTry ? 'קפיצה!' : 'יופי! קופצים');
  },

  _land(i) {
    const S = this.active, j = this.jumps[i];
    this.cheer();
    Audio.pop();
    if (S.answered[i]) {
      S.stars++;
      S.ui.querySelector('.ride-stars b').textContent = S.stars;
      World.spawnParticles(j.userData.star.getWorldPosition(new THREE.Vector3()), 'star', 10);
      j.userData.star.visible = false;
      Audio.coin();
    } else World.spawnParticles(j.position.clone(), 'sparkle', 8);
  },

  _lapDone() {
    const S = this.active;
    S.state = 'end';
    const perfect = S.answered.length === JUMPS.length && S.answered.every(Boolean);
    const prize = this.deps.onLap({ stars: S.stars, perfect });
    this.cheer(); Audio.fanfare();
    const box = S.ui.querySelector('.ride-end');
    const stars = JUMPS.map((_, i) => S.answered[i] ? '⭐' : '<span class="dim">⭐</span>').join('');
    box.innerHTML = `<div class="card ride-card">
        <div class="ride-medal">${perfect ? '🥇' : '🏅'}</div>
        <h2>${perfect ? 'סיבוב מושלם!' : 'סיימת סיבוב!'}</h2>
        <div class="ride-starrow">${stars}</div>
        <div class="ride-prize">+${prize} 🪙${perfect ? ' · 🎀 סרט אלופה' : ''}</div>
        <button class="btn-big btn-play ride-again">🔁 עוד סיבוב</button>
        <button class="btn-ghost ride-home">🏡 מספיק להיום</button></div>`;
    box.classList.remove('hidden');
    box.querySelector('.ride-again').onclick = () => { Audio.click(); this._again(); };
    box.querySelector('.ride-home').onclick = () => { Audio.click(); this.stop(); };
    setTimeout(() => Audio.speak(perfect ? 'סיבוב מושלם! אספת את כל הכוכבים' : 'סיימת סיבוב! אספת ' + S.stars + ' כוכבים'), 400);
  },

  _again() {
    const S = this.active;
    S.ui.querySelector('.ride-end').classList.add('hidden');
    S.s -= LAP; S.next = 0; S.stars = 0; S.answered = []; S.state = 'go';
    S.ui.querySelector('.ride-stars b').textContent = 0;
    S.ui.querySelectorAll('[data-j]').forEach((m, i) => { m.className = ''; m.textContent = i + 1; });
    this.jumps.forEach(j => { j.userData.star.visible = true; });
    Audio.speak('עוד סיבוב! יאללה');
  },

  stop() {
    const S = this.active;
    if (!S) return;
    if (S.choiceCtl) S.choiceCtl.stop();
    this.active = null;
    Audio.stopSpeak();
    World.scene.remove(S.rig);
    if (S.ui) S.ui.remove();
    document.body.classList.remove('riding');
    const ctl = World.controls;
    ctl.minAzimuthAngle = S.saved.minA; ctl.maxAzimuthAngle = S.saved.maxA; ctl.enabled = S.saved.enabled;
    World.sunLight.position.copy(S.saved.sun);
    World.sunLight.target.position.set(0, 0, 0); World.sunLight.target.updateMatrixWorld();
    // מצלמה חוזרת למבט רגיל על המסלול (בתוך גבולות הסיבוב)
    ctl.target.set(C.x, 1.5, C.z);
    World.camera.position.set(C.x, 15, C.z + 24);
    World.travelTo(C.x, C.z, 26);
    this.jumps.forEach(j => { j.userData.star.visible = true; });
    this.deps.onExit && this.deps.onExit();
  },

  update(dt) {
    const S = this.active;
    if (!S) return;
    S.t += dt;
    // מהירות: מאיצים לשיוט, בולמים כדי לעצור בדיוק לפני המשוכה הבאה שעוד לא נפתרה
    let want = CRUISE;
    if (S.state === 'go' && S.next < JUMPS.length && S.answered[S.next] === undefined) {
      const stopAt = JUMP_S[S.next] - STOP_BEFORE;
      const left = stopAt - S.s;
      want = Math.min(CRUISE, Math.sqrt(Math.max(0, 2 * BRAKE * left)));
      if (left <= 0.08) { want = 0; S.v = 0; this._ask(); }
    } else if (S.state === 'ask') want = 0;
    else if (S.state === 'end' || (S.next >= JUMPS.length && S.s > LAP)) {
      const left = LAP + 7 - S.s;
      want = Math.min(CRUISE, Math.sqrt(Math.max(0, 2 * BRAKE * left)));
      if (S.state !== 'end' && S.s >= LAP + 0.5) this._lapDone();
    }
    S.v += Math.max(-BRAKE * dt * 2, Math.min(ACCEL * dt, want - S.v));
    if (S.state === 'ask') S.v = 0;
    S.s += S.v * dt;

    // קפיצה מעל המשוכה: קשת סביב מיקום המשוכה
    let y = 0, pitch = 0;
    if (S.next < JUMPS.length && S.answered[S.next] !== undefined) {
      const dj = S.s - JUMP_S[S.next], half = 2.2;
      if (dj > -half && dj < half) {
        const k = (dj + half) / (2 * half);
        y = Math.sin(k * Math.PI) * S.jumpH;
        pitch = Math.cos(k * Math.PI) * -0.25;
      } else if (dj >= half) { this._land(S.next); S.next++; }
    }

    const { p, t } = at(S.s);
    S.rig.position.set(p.x, y, p.z);
    S.rig.rotation.set(0, 0, 0);
    S.rig.rotation.y = Math.atan2(t.x, t.z);
    S.rig.rotateX(pitch);
    // סוס: דהירה כשרצים, עמידה כשמחכים
    const h = S.h3d;
    if (h.ready) {
      if (S.v > 0.6) { h.play(S.v > 4 ? 'gallop' : 'walk'); if (h.current) h.current.timeScale = Math.max(0.6, S.v / CRUISE * 1.1); }
      else { h.play('idle'); if (h.current) h.current.timeScale = 1; }
      h.mixer.update(dt);
    }
    S.rider.position.y = RIDER_Y + (S.v > 4 ? Math.abs(Math.sin(S.t * 9)) * 0.07 : 0);

    // מצלמה רודפת: מאחור ומעט מהצד; בעצירה — קרוב יותר כדי לראות את המשוכה
    const back = S.state === 'ask' ? 8 : 10.5, up = S.state === 'ask' ? 4.2 : 5.2;
    const side = at(S.s).n.multiplyScalar(-2.2);                        // קצת מבחוץ לסיבוב — רואים את הסוס מהצד
    const camWant = p.clone().addScaledVector(t, -back).add(side).add(new THREE.Vector3(0, up, 0));
    const look = p.clone().addScaledVector(t, S.state === 'ask' ? 5 : 3.5); look.y = 1.6;
    const cam = World.camera;
    if (!S.camInit) { cam.position.copy(camWant); S.look = look.clone(); S.camInit = true; }
    const k = 1 - Math.exp(-dt * 3);
    cam.position.lerp(camWant, k);
    S.look.lerp(look, k);
    cam.lookAt(S.look);
    World.controls.target.copy(S.look);
    // צל אמיתי: השמש "הולכת" עם הסוס (מצלמת הצל מכסה רק סביב מרכז העולם)
    World.sunLight.position.set(p.x + 14, 24, p.z + 10);
    World.sunLight.target.position.copy(p); World.sunLight.target.updateMatrixWorld();
  }
};

export { Track3D, LAP };
