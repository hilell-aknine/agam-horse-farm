// transfer3d.js — משימת ההעברה בתוך העולם: גזרים אמיתיים על הקרקע ושוקת אמיתית ליד הסוס.
// אותו חשבון כמו UI.askTransfer (ספירה / "כמה חסר", פיגום, שתי טעויות → משבצות),
// רק שבמקום חלון שמסתיר את החווה — נוגעים בגזר, הוא עף לשוקת, והסוס ניגש ואוכל בדיוק את מה ששמו.
// אם משהו חסר (אין סוס/עולם) main.js נופל לחלון הרגיל.
import { World, THREE } from './world.js';
import { Audio } from './audio.js';

const WORDS = ['אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר', 'אחת עשרה', 'שתים עשרה'];
const word = (n) => WORDS[n - 1] || String(n);

const CAM_DIST = 8.2;          // קרוב מהרגיל (12) כדי שגזר יהיה גדול מספיק לאצבע של ילדה
const TROUGH_FROM_HORSE = 4.2; // הסוס עומד מאחורי השוקת, והגזרים מולה — הכל בתוך המסגרת
const SLOT_X = [1.95, 1.17, 0.39, -0.39, -1.17, -1.95];   // מימין לשמאל, כמו שקוראים
const SLOT_Z = [0.5, -0.5];                               // שורה קדמית ואז אחורית
const PILE_Z = [2.35, 3.4];

// --- חומרים: אותו מראה מט וזוהר עדין כמו שאר המודלים (models3d.js) ---
function mat(color, glow = 0.28) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true });
  m.emissive.copy(m.color).multiplyScalar(glow);
  return m;
}
const MATS = {};
function M(key, color) { return MATS[key] || (MATS[key] = mat(color)); }

function shadowed(o) { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; }

// גזר שוכב: גוף כתום לאורך ציר x, ציצת עלים בקצה הרחב
function makeCarrot() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.05, 8), M('carrot', 0xf27a1a));
  body.rotation.z = Math.PI / 2;          // החוד פונה ל- x שלילי
  g.add(body);
  for (const [a, s] of [[-0.5, 0.9], [0, 1.1], [0.5, 0.85]]) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5 * s, 5), M('leaf', 0x4caf50));
    leaf.position.set(0.68, 0, 0);
    leaf.rotation.z = -Math.PI / 2;
    leaf.rotation.x = a;
    leaf.translateY(0.12);
    g.add(leaf);
  }
  return shadowed(g);
}

// שוקת עץ עם קש, הצד הארוך מול המצלמה
function makeTrough() {
  const g = new THREE.Group();
  const wood = M('wood', 0xa0683a), dark = M('woodDark', 0x7a4b27), hay = M('hay', 0xe8c66a);
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); };
  box(5.0, 0.16, 2.2, wood, 0, 0.42, 0);            // רצפה
  box(4.8, 0.06, 2.0, hay, 0, 0.52, 0);             // קש
  box(5.3, 0.26, 0.16, wood, 0, 0.6, 1.12);         // דופן קדמית נמוכה — רואים כל גזר ואפשר לספור
  box(5.3, 0.7, 0.16, wood, 0, 0.82, -1.12);        // דופן אחורית
  box(0.16, 0.5, 2.4, wood, 2.6, 0.72, 0);
  box(0.16, 0.5, 2.4, wood, -2.6, 0.72, 0);
  for (const x of [-2.3, 2.3]) for (const z of [-0.9, 0.9]) box(0.22, 0.42, 0.22, dark, x, 0.21, z);
  return shadowed(g);
}

// משבצת מסומנת בקש (פיגום): עיגול בהיר שמהבהב כשהוא הבא בתור
function makeSlotMark() {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

// מספר מעל פריט (אחרי טעות — רואים את הספירה על הגזרים עצמם)
function numberSprite(n) {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.strokeStyle = '#00606B'; x.lineWidth = 8;
  x.beginPath(); x.arc(48, 48, 40, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = '#003B46'; x.font = 'bold 54px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(String(n), 48, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(0.75, 0.75, 1);
  sp.renderOrder = 10;
  return sp;
}

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

const Transfer3D = {
  active: null,

  // אפשר לשחק בעולם רק כשיש סוס חי בסצנה
  canRun(ctx) { return !!(ctx && ctx.horse && ctx.horse.group && ctx.horse.group.parent && World.scene); },

  // בחירה לפי מרכז הגזר הקרוב ביותר במסך (ולא קרן תלת-ממדית): במבט מלמעלה אזורי נגיעה
  // תלת-ממדיים חופפים, ונגיעה בגזר בשורה האחורית נתפסה ע"י הגזר שלפניו
  pickAt(clientX, clientY) {
    const S = this.active;
    if (!S || S.finished) return null;
    const v = new THREE.Vector3();
    let best = null, bestD = Infinity;
    for (const c of S.pile.concat(S.box)) {
      if (c.userData.pre || !c.visible) continue;
      c.getWorldPosition(v).project(World.camera);
      const d = Math.hypot((v.x + 1) / 2 * window.innerWidth - clientX, (1 - v.y) / 2 * window.innerHeight - clientY);
      if (d < bestD) { bestD = d; best = c; }
    }
    const reach = Math.max(44, Math.min(window.innerWidth, window.innerHeight) * 0.11);   // אצבע של ילדה
    return bestD <= reach ? best : null;
  },

  start(task, ctx, onDone) {
    if (this.active) this._cleanup(true);
    const horse = ctx.horse;
    const { target, prefilled, mode } = task;
    const S = this.active = {
      task, horse, onDone, attempts: 0, scaffold: task.scaffold, finished: false,
      pile: [], box: [], labels: [], marks: [], t: 0
    };

    // --- הצבה: לפי כיוון המבט של המצלמה (לא מיקומה — היא עוד זזה), השוקת בין הסוס לילדה והגזרים מולה ---
    const hp = horse.group.position;
    const dir = World.camera.position.clone().sub(World.controls.target); dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const root = new THREE.Group();
    const center = hp.clone().addScaledVector(dir, TROUGH_FROM_HORSE); center.y = 0;
    const R = (World.fenceR || 15) - 7;                   // הגזרים והמצלמה לא נתקעים בגדר
    const d = Math.hypot(center.x, center.z);
    if (d > R) { center.x *= R / d; center.z *= R / d; }
    root.position.copy(center);
    root.rotation.y = Math.atan2(dir.x, dir.z);            // z מקומי = אל המצלמה, x מקומי = ימינה במסך
    World.scene.add(root);
    S.root = root; S.dir = dir;

    S.trough = makeTrough(); root.add(S.trough);
    // נקודת אכילה: הסוס מאחורי השוקת, הראש מעליה
    S.eatLocal = new THREE.Vector3(0, 0, horse.stage === 'adult' ? -2.5 : -2.0);

    // גזרים שכבר בשוקת (מצב "כמה חסר") — לא זזים
    for (let i = 0; i < prefilled; i++) {
      const c = makeCarrot(); c.userData.pre = true;
      root.add(c); S.box.push(c); c.position.copy(this._slot(i)); c.scale.setScalar(0.85);
    }
    // ערימה: מספיק גזרים כדי שלא יהיה אפשר "לנחש" לפי מה שנשאר
    const pileN = Math.min(12, Math.max(6, target - prefilled + 3));
    S.pileHome = [];
    const row1 = Math.ceil(pileN / 2);
    for (let i = 0; i < pileN; i++) {
      const r = i < row1 ? 0 : 1, k = r ? i - row1 : i, n = r ? pileN - row1 : row1;
      S.pileHome.push(new THREE.Vector3((k - (n - 1) / 2) * -1.35, 0.3, PILE_Z[r]));
    }
    for (let i = 0; i < pileN; i++) {
      const c = makeCarrot();
      c.rotation.y = (Math.random() - 0.5) * 0.6;
      c.position.copy(S.pileHome[i]);
      c.userData.home = i; c.userData.phase = i * 0.7;
      root.add(c); S.pile.push(c);
    }
    this._renderMarks();

    // הסוס ניגש לעמוד מאחורי השוקת, מחכה ומסתכל עלייך
    horse.hold = true;
    horse.lookAt(center);
    const wait = root.localToWorld(new THREE.Vector3(0, 0, S.eatLocal.z - 1.3));
    if (hp.distanceTo(wait) > 0.6) {
      // סוס שעומד מול השוקת (קרוב לגדר) עוקף מהצד — לא דורך על הגזרים
      const local = root.worldToLocal(hp.clone());
      if (local.z > -1.2) {
        const sx = local.x >= 0 ? 4.8 : -4.8;   // מחוץ לרוחב הערימה והשוקת
        const side = root.localToWorld(new THREE.Vector3(sx, 0, local.z));
        const back = root.localToWorld(new THREE.Vector3(sx, 0, S.eatLocal.z - 1.3));
        horse.walkTo(side, () => { if (this.active === S && !S.finished) horse.walkTo(back, () => { if (this.active === S && !S.finished) horse.walkTo(wait, () => {}); }); });
      } else horse.walkTo(wait, () => {});
    }

    // מצלמה: קרוב, ממורכזת בין השוקת לגזרים
    S.prevMin = World.controls.minDistance;
    World.controls.minDistance = Math.min(S.prevMin, CAM_DIST - 0.5);
    // מרכז המצלמה מרחף 1.5 מעל הקרקע, ולכן מכוונים רחוק יותר כדי שהשוקת והערימה יישבו באמצע המסך
    const focus = root.localToWorld(new THREE.Vector3(0, 0, 3.7));
    World.travelTo(focus.x, focus.z, CAM_DIST);
    this._clearView(root.localToWorld(new THREE.Vector3(0, 0, PILE_Z[1] + 0.8)), dir);

    this._ui();
  },

  // המצלמה קרובה ולעיתים מאחורי הגדר: פריטים קטנים שעומדים בינה לבין הגזרים (שער, ספסל, שיח)
  // מוסתרים עד סוף המשימה. גדר שלמה/קרקע/סוסים לא נוגעים (גדולים מדי או חיים).
  _clearView(front, dir) {
    const S = this.active;
    S.hidden = [];
    const box = new THREE.Box3(), size = new THREE.Vector3();
    for (const o of World.scene.children) {
      if (o === S.root || o.isLight || o.isCamera || !o.visible) continue;
      const rel = o.position.clone().sub(front); rel.y = 0;
      const along = rel.dot(dir);                     // כמה הפריט קרוב יותר למצלמה מקצה הערימה
      if (along < 0 || along > 14) continue;
      const side = rel.clone().addScaledVector(dir, -along).length();
      if (side > 4.5) continue;
      let horse = null; o.traverse(c => { if (c.userData && c.userData.horse) horse = c.userData.horse; });
      if (horse) {                                    // סוס אחר נשאר, רק שלט השם הגדול שלו מוסתר
        if (horse !== S.horse && horse.label && horse.label.visible) { horse.label.visible = false; S.hidden.push(horse.label); }
        continue;
      }
      box.setFromObject(o).getSize(size);
      if (Math.max(size.x, size.z) > 7) continue;
      o.visible = false; S.hidden.push(o);
    }
  },

  _slot(i) { return new THREE.Vector3(SLOT_X[i % 6], 0.78, SLOT_Z[Math.floor(i / 6)] || 0); },

  // --- ממשק קטן: בועת שאלה למעלה וכפתור "זהו" למטה. השאר — החווה ---
  _ui() {
    const S = this.active, t = S.task;
    const name = t.who.name;
    const ask = t.mode === 'missing'
      ? `ב${t.box} יש כבר ${t.prefilled}. ${name} רוצה ${t.target}. כמה עוד?`
      : `${t.verb} ${t.target} ${t.itemName}`;
    S.say = t.mode === 'missing'
      ? `ב${t.box} יש כבר ${t.prefilled} ${t.itemName}. ${name} רוצה ${t.target}. תוסיפי כמה שחסר`
      : `${t.verb} ${t.target} ${t.itemName}. געי ב${t.itemName} אחד אחד`;
    const ui = el('div', 't3-ui');
    ui.innerHTML = `
      <div class="t3-bubble">
        <button class="t3-close" aria-label="סגירה">✖</button>
        <span class="t3-ask">${ask} <span class="t3-big">${t.item}</span></span>
        <button class="t3-speak" aria-label="שמיעה">🔊</button>
      </div>
      <div class="t3-msg hidden"></div>
      <button class="btn-big btn-play t3-done ${S.scaffold ? 'hidden' : ''}">✔ זהו!</button>`;
    document.getElementById('ui').appendChild(ui);
    document.body.classList.add('t3-on');
    S.ui = ui; S.msg = ui.querySelector('.t3-msg'); S.doneBtn = ui.querySelector('.t3-done');
    ui.querySelector('.t3-close').onclick = () => { Audio.click(); this.cancel(); };
    ui.querySelector('.t3-speak').onclick = () => Audio.speak(S.say);
    S.doneBtn.onclick = () => this._check();
    Audio.speak(S.say);
  },

  inBox() { return this.active.box.length; },

  // נגיעה בגזר: מהערימה לשוקת, או מהשוקת חזרה לערימה
  tap(c) {
    const S = this.active;
    if (!S || S.finished || !c) return;
    this._clearLabels();
    S.msg.classList.add('hidden');
    const iPile = S.pile.indexOf(c);
    if (iPile >= 0) {
      if (S.scaffold && this.inBox() >= S.task.target) { Audio.wrong(); Audio.speak(`ה${S.task.box} מלאה`); return; }
      if (this.inBox() >= 12) { Audio.wrong(); return; }
      S.pile.splice(iPile, 1);
      S.box.push(c);
      this._fly(c, this._slot(S.box.length - 1), 0.85);
      Audio.pop();
      if (S.scaffold) Audio.speak(word(this.inBox()));
      this._renderMarks();
      if (S.scaffold && this.inBox() === S.task.target) setTimeout(() => this._success(), 450);
    } else {
      const iBox = S.box.indexOf(c);
      if (iBox < 0 || c.userData.pre) return;
      S.box.splice(iBox, 1);
      S.pile.push(c);
      this._fly(c, S.pileHome[c.userData.home], 1);
      // שאר הגזרים בשוקת מתיישרים — אין חורים באמצע, קל לספור
      S.box.forEach((b, i) => { if (b !== c) this._fly(b, this._slot(i), 0.85, 0.25, 0.3); });
      Audio.pop();
      this._renderMarks();
    }
  },

  _fly(obj, to, scale, dur = 0.45, arc = 1.6) {
    obj.userData.fly = { from: obj.position.clone(), to: to.clone(), s0: obj.scale.x, s1: scale, t: 0, dur, arc };
  },

  _check() {
    const S = this.active;
    if (!S || S.finished) return;
    Audio.click();
    const n = this.inBox(), target = S.task.target, name = S.task.who.name;
    if (n === target) { this._success(); return; }
    S.attempts++;
    Audio.wrong();
    // הספירה מופיעה על הגזרים עצמם — לומדים מהטעות, לא מקבלים ציון
    S.box.forEach((c, i) => {
      const sp = numberSprite(i + 1);
      sp.position.copy(this._slot(i)).add(new THREE.Vector3(0, 0.75, 0));
      S.root.add(sp); S.labels.push(sp);
    });
    const diff = Math.abs(n - target);
    const fix = n > target ? (diff === 1 ? 'צריך להחזיר אחד' : `צריך להחזיר ${diff}`)
                           : (diff === 1 ? 'חסר עוד אחד' : `חסרים עוד ${diff}`);
    S.msg.innerHTML = `יש כאן <b>${n}</b>. ${name} רוצה <b>${target}</b>. ${fix}`;
    S.msg.classList.remove('hidden');
    Audio.speak(`יש כאן ${n}. ${name} רוצה ${target}. ${fix}`);
    if (S.attempts >= 2 && !S.scaffold) {
      // אחרי שתי טעויות: משבצות מסומנות, והמשימה הופכת להתאמה אחד-לאחד
      S.scaffold = true;
      while (this.inBox() > target) {
        const c = [...S.box].reverse().find(b => !b.userData.pre); if (!c) break;
        S.box.splice(S.box.indexOf(c), 1); S.pile.push(c); this._fly(c, S.pileHome[c.userData.home], 1);
      }
      S.doneBtn.classList.add('hidden');
      this._renderMarks();
      if (this.inBox() === target) setTimeout(() => this._success(), 450);
    }
  },

  _renderMarks() {
    const S = this.active;
    S.marks.forEach(m => { S.root.remove(m); m.geometry.dispose(); m.material.dispose(); });
    S.marks = [];
    if (!S.scaffold) return;
    for (let i = this.inBox(); i < S.task.target; i++) {
      const m = makeSlotMark();
      m.position.copy(this._slot(i)); m.position.y = 0.57;
      m.userData.next = i === this.inBox();
      S.root.add(m); S.marks.push(m);
    }
  },

  _clearLabels() {
    const S = this.active;
    S.labels.forEach(l => { S.root.remove(l); l.material.map.dispose(); l.material.dispose(); });
    S.labels = [];
  },

  // הצלחה: הסוס ניגש לשוקת ואוכל בדיוק את הגזרים ששמת — זה הפרס האמיתי
  _success() {
    const S = this.active;
    if (!S || S.finished) return;
    S.finished = true;
    this._clearLabels();
    Audio.success();
    S.doneBtn.classList.add('hidden');
    S.msg.textContent = '🎉 כל הכבוד!';
    S.msg.classList.remove('hidden');
    // הגזרים שנשארו בערימה נעלמים בעדינות — כל העין על השוקת
    S.pile.forEach(c => { c.userData.fade = 1; });
    const horse = S.horse;
    horse.hold = false;
    const eat = S.root.localToWorld(S.eatLocal.clone());
    const firstTry = S.attempts === 0;
    horse.walkTo(eat, () => {
      horse.lookAt(S.root.position);
      S.eating = 0;                       // מעכשיו הגזרים בשוקת נאכלים אחד אחד
      if (S.ui) { S.ui.remove(); S.ui = null; }
      document.body.classList.remove('t3-on');
      const done = S.onDone; S.onDone = null;
      done && done({ correct: true, firstTry });
    });
  },

  cancel() {
    const S = this.active;
    if (!S) return;
    Audio.stopSpeak();
    const done = S.onDone; S.onDone = null;
    this._cleanup(true);
    done && done({ correct: false, cancelled: true });
  },

  _cleanup(immediate) {
    const S = this.active;
    if (!S) return;
    this.active = null;
    if (S.horse) { S.horse.hold = false; S.horse.lookAt(null); }
    if (S.ui) S.ui.remove();
    document.body.classList.remove('t3-on');
    (S.hidden || []).forEach(o => { o.visible = true; });
    World.controls.minDistance = S.prevMin ?? 12;
    // חוזרים למרחק העבודה הרגיל של החווה
    const tg = World.controls.target;
    World.travelTo(tg.x, tg.z, Math.max(World.controls.minDistance, 14));
    const dispose = () => {
      World.scene.remove(S.root);
      S.root.traverse(o => { if (o.isSprite && o.material) { o.material.map && o.material.map.dispose(); o.material.dispose(); } });
    };
    if (immediate) dispose();
    else { S.fadeOut = 0; this._fading = S; S.dispose = dispose; }
  },

  update(dt) {
    const F = this._fading;
    if (F) {
      F.fadeOut += dt;
      const s = Math.max(0.001, 1 - F.fadeOut / 0.5);
      F.root.scale.set(1, s, 1);
      if (F.fadeOut >= 0.5) { F.dispose(); this._fading = null; }
    }
    const S = this.active;
    if (!S) return;
    S.t += dt;
    const all = S.pile.concat(S.box);
    for (const c of all) {
      const f = c.userData.fly;
      if (f) {
        f.t += dt;
        const k = Math.min(1, f.t / f.dur), e = k * k * (3 - 2 * k);
        c.position.lerpVectors(f.from, f.to, e);
        c.position.y += Math.sin(k * Math.PI) * f.arc;
        c.rotation.x = k < 1 ? k * Math.PI * 2 : 0;
        c.scale.setScalar(f.s0 + (f.s1 - f.s0) * e);
        if (k >= 1) c.userData.fly = null;
      } else if (c.userData.fade) {
        c.userData.fade = Math.max(0, c.userData.fade - dt * 2.5);
        c.scale.setScalar(c.userData.fade + 0.001);
        if (!c.userData.fade) c.visible = false;
      } else if (S.pile.includes(c) && !S.finished) {
        // הערימה "נושמת" בגל עדין — מזמינה לגעת
        const ph = S.t * 2.2 - c.userData.phase;
        c.position.y = 0.3 + Math.max(0, Math.sin(ph)) * 0.12;
      }
    }
    // הסוס אוכל: גזר אחרי גזר מתכווץ ונעלם מהשוקת
    if (S.eating != null) {
      S.eating += dt;
      // לפי זמן המשחק ולא שעון קיר — במכשיר איטי הסוס עדיין מסיים לאכול לפני שהשוקת נעלמת
      if (S.eating > 3.6) { this._cleanup(false); return; }
      const per = 2.8 / Math.max(1, S.box.length);
      S.box.forEach((c, i) => {
        const k = Math.min(1, Math.max(0, (S.eating - i * per) / per));
        c.scale.setScalar(0.85 * (1 - k) + 0.001);
        if (k >= 1) c.visible = false;
      });
    }
    // המשבצת הבאה מהבהבת
    for (const m of S.marks) m.material.opacity = m.userData.next ? 0.45 + 0.4 * Math.abs(Math.sin(S.t * 4)) : 0.35;
  }
};

export { Transfer3D };
