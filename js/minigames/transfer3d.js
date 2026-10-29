// transfer3d.js — משימת ההעברה בתוך העולם: גזרים אמיתיים על הקרקע ושוקת אמיתית ליד הסוס.
// אותו חשבון כמו UI.askTransfer (ספירה / "כמה חסר", פיגום, שתי טעויות → משבצות),
// רק שבמקום חלון שמסתיר את החווה — נוגעים בגזר, הוא עף לשוקת, והסוס ניגש ואוכל בדיוק את מה ששמו.
// אם משהו חסר (אין סוס/עולם) main.js נופל לחלון הרגיל.
import { World, THREE } from '../engine/world.js';
import { Audio } from '../systems/audio.js';

const WORDS = ['אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר', 'אחת עשרה', 'שתים עשרה'];
const word = (n) => WORDS[n - 1] || String(n);

const CAM_DIST = 8.2;          // קרוב מהרגיל (12) כדי שגזר יהיה גדול מספיק לאצבע של ילדה
const TROUGH_FROM_HORSE = 4.2; // הסוס עומד מאחורי השוקת, והגזרים מולה — הכל בתוך המסגרת
// הערוגה עומדת ברצועת הדשא בין גינת הירק (x עד -3.2) למגרש הרכיבה (x מ-1.6), כדי לא לכסות שדות
const BED_X = -0.8;

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

// שתיל: גוש אדמה קטן, גבעול ושני עלים. נקודת האפס בתחתית (עומד על הקרקע)
function makeSeedling() {
  const g = new THREE.Group();
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.2, 8), M('plug', 0x6b4423));
  plug.position.y = 0.1; g.add(plug);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.34, 5), M('stem', 0x5cb85c));
  stem.position.y = 0.36; g.add(stem);
  for (const sgn of [1, -1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), M('sprout', 0x7ccf4f));
    leaf.scale.set(1, 0.32, 0.6);
    leaf.position.set(0.15 * sgn, 0.52, 0);
    leaf.rotation.z = -0.45 * sgn;
    g.add(leaf);
  }
  return shadowed(g);
}

// ערוגה: מסגרת עץ נמוכה מלאה אדמה, 3 שורות של 4 גומות
function makeBed() {
  const g = new THREE.Group();
  const wood = M('wood', 0xa0683a), soil = M('soil', 0x5e3719);
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); };
  box(3.6, 0.36, 2.4, soil, 0, 0.2, 0);
  box(3.9, 0.3, 0.15, wood, 0, 0.3, 1.27);
  box(3.9, 0.42, 0.15, wood, 0, 0.36, -1.27);
  box(0.15, 0.36, 2.4, wood, 1.87, 0.33, 0);
  box(0.15, 0.36, 2.4, wood, -1.87, 0.33, 0);
  const hole = M('hole', 0x3f240f);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 10), hole);
    h.position.set((1.5 - c) * 0.78, 0.385, (1 - r) * 0.62); g.add(h);
  }
  return shadowed(g);
}

// לכל סוג משימה: הפריט, המכל, סידור המשבצות והערימה
const KINDS = {
  feed:  { make: makeCarrot, container: makeTrough, cols: 6, rowZ: [0.5, -0.5], slotY: 0.78, inScale: 0.85,
           pileScale: 1, pileY: 0.3, pileCols: 6, pileDX: 1.35, pileZ: [2.35, 3.4], labelY: 0.75, markY: 0.57 },
  plant: { make: makeSeedling, container: makeBed, cols: 4, rowZ: [0.62, 0, -0.62], slotY: 0.38, inScale: 1,
           pileScale: 1.3, pileY: 0, pileCols: 4, pileDX: 1.25, pileZ: [2.2, 3.2, 4.2], labelY: 1.05, markY: 0.4 }
};

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

  // אפשר לשחק בעולם רק כשהסוס/השדה באמת בסצנה
  canRun(ctx) {
    if (!ctx || !World.scene) return false;
    if (ctx.horse) return !!(ctx.horse.group && ctx.horse.group.parent);
    if (ctx.plot) return !!(ctx.plot.group && ctx.plot.group.parent);
    return false;
  },

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
    const horse = ctx.horse || null, plot = ctx.plot || null;
    const K = KINDS[horse ? 'feed' : 'plant'];
    const { target, prefilled } = task;
    const S = this.active = {
      task, horse, plot, K, onDone, attempts: 0, scaffold: task.scaffold, finished: false,
      pile: [], box: [], labels: [], marks: [], t: 0
    };

    // --- הצבה: לפי כיוון המבט של המצלמה (לא מיקומה — היא עוד זזה); המכל באמצע והערימה מולו ---
    const dir = World.camera.position.clone().sub(World.controls.target); dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const root = new THREE.Group();
    let center;
    if (horse) {
      center = horse.group.position.clone().addScaledVector(dir, TROUGH_FROM_HORSE); center.y = 0;
      const R = (World.fenceR || 15) - 7;                 // הגזרים והמצלמה לא נתקעים בגדר
      const d = Math.hypot(center.x, center.z);
      if (d > R) { center.x *= R / d; center.z *= R / d; }
    } else {
      center = new THREE.Vector3(BED_X, 0, Math.min(5, Math.max(0.3, plot.pos.z)));
    }
    root.position.copy(center);
    root.rotation.y = Math.atan2(dir.x, dir.z);            // z מקומי = אל המצלמה, x מקומי = ימינה במסך
    World.scene.add(root);
    S.root = root; S.dir = dir;

    root.add(K.container());

    // פריטים שכבר במכל (מצב "כמה חסר") — לא זזים
    for (let i = 0; i < prefilled; i++) {
      const c = K.make(); c.userData.pre = true;
      root.add(c); S.box.push(c); c.position.copy(this._slot(i)); c.scale.setScalar(K.inScale);
    }
    // ערימה: מספיק פריטים כדי שלא יהיה אפשר "לנחש" לפי מה שנשאר. שורות מאוזנות, מימין לשמאל
    const pileN = Math.min(12, Math.max(6, target - prefilled + 3));
    const rows = Math.min(K.pileZ.length, Math.ceil(pileN / K.pileCols));
    S.pileHome = [];
    for (let r = 0, placed = 0; r < rows; r++) {
      const n = Math.ceil((pileN - placed) / (rows - r));
      for (let k = 0; k < n; k++) S.pileHome.push(new THREE.Vector3((k - (n - 1) / 2) * -K.pileDX, K.pileY, K.pileZ[r]));
      placed += n;
    }
    for (let i = 0; i < pileN; i++) {
      const c = K.make();
      c.rotation.y = (Math.random() - 0.5) * 0.6;
      c.position.copy(S.pileHome[i]);
      c.scale.setScalar(K.pileScale);
      c.userData.home = i; c.userData.phase = i * 0.7;
      root.add(c); S.pile.push(c);
    }
    this._renderMarks();
    const pileBack = K.pileZ[rows - 1];

    if (horse) this._horseWaits(S, center);

    // מצלמה: קרוב. המרכז שלה מרחף 1.5 מעל הקרקע, ולכן מכוונים מעבר לאמצע כדי שהמכל והערימה יישבו במרכז המסך
    S.prevMin = World.controls.minDistance;
    World.controls.minDistance = Math.min(S.prevMin, CAM_DIST - 0.5);
    const focus = root.localToWorld(new THREE.Vector3(0, 0, pileBack / 2 + 2.0));
    World.travelTo(focus.x, focus.z, CAM_DIST);
    this._clearView(root.localToWorld(new THREE.Vector3(0, 0, pileBack + 0.8)), dir);

    this._ui();
  },

  _horseWaits(S, center) {
    const horse = S.horse, root = S.root, hp = horse.group.position;
    // נקודת אכילה: הסוס מאחורי השוקת, הראש מעליה
    S.eatLocal = new THREE.Vector3(0, 0, horse.stage === 'adult' ? -2.5 : -2.0);
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
      if (Math.max(size.x, size.z) > 7 || size.y < 1.1) continue;   // גדר שלמה/קרקע לא; עמודים נמוכים לא מסתירים
      o.visible = false; S.hidden.push(o);
    }
  },

  // משבצת i במכל: מימין לשמאל (כמו שקוראים), שורה קדמית קודם
  _slot(i) {
    const K = this.active.K, c = i % K.cols, r = Math.floor(i / K.cols);
    return new THREE.Vector3(((K.cols - 1) / 2 - c) * 0.78, K.slotY, K.rowZ[r] ?? 0);
  },

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
      this._fly(c, this._slot(S.box.length - 1), S.K.inScale);
      Audio.pop();
      if (S.scaffold) Audio.speak(word(this.inBox()));
      this._renderMarks();
      if (S.scaffold && this.inBox() === S.task.target) setTimeout(() => this._success(), 450);
    } else {
      const iBox = S.box.indexOf(c);
      if (iBox < 0 || c.userData.pre) return;
      S.box.splice(iBox, 1);
      S.pile.push(c);
      this._fly(c, S.pileHome[c.userData.home], S.K.pileScale);
      // שאר הפריטים במכל מתיישרים — אין חורים באמצע, קל לספור
      S.box.forEach((b, i) => { if (b !== c) this._fly(b, this._slot(i), S.K.inScale, 0.25, 0.3); });
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
    if (S.checkLock) return;            // בזמן העצירה אחרי טעות — לא בודקים שוב
    S.attempts++;
    Audio.wrong();
    // עצירה קצרה אחרי טעות: לחיצות מהירות על "זהו!" בלי לספור לא עובדות
    S.checkLock = true; S.doneBtn.disabled = true; S.doneBtn.classList.add('wait');
    setTimeout(() => { S.checkLock = false; if (S.doneBtn) { S.doneBtn.disabled = false; S.doneBtn.classList.remove('wait'); } }, 2200);
    // הספירה מופיעה על הגזרים עצמם — לומדים מהטעות, לא מקבלים ציון
    S.box.forEach((c, i) => {
      const sp = numberSprite(i + 1);
      sp.position.copy(this._slot(i)).add(new THREE.Vector3(0, S.K.labelY, 0));
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
        S.box.splice(S.box.indexOf(c), 1); S.pile.push(c); this._fly(c, S.pileHome[c.userData.home], S.K.pileScale);
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
      m.position.copy(this._slot(i)); m.position.y = S.K.markY;
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
    // מה שנשאר בערימה נעלם בעדינות — כל העין על המכל
    S.pile.forEach(c => { c.userData.fade = 1; });
    if (!S.horse) { this._plantSuccess(S); return; }
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

  // שתילה: השתילים קופצים אחד אחד מהערוגה אל השדה שנבחר, ורק אז השדה נשתל
  _plantSuccess(S) {
    const p = S.plot.pos;
    S.hops = S.box.map((c, i) => {
      const w = new THREE.Vector3(p.x + ((i % 4) - 1.5) * 0.42, 0.4, p.z + (Math.floor(i / 4) - 1) * 0.5);
      return { c, at: 0.5 + i * 0.22, to: S.root.worldToLocal(w), done: false };
    });
    S.planting = 0;
    const mid = S.root.localToWorld(new THREE.Vector3(0, 0, 0)).add(p).multiplyScalar(0.5);
    World.travelTo(mid.x, mid.z, 11);          // שהשדה והערוגה ייכנסו יחד למסגרת
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
        c.position.y = S.K.pileY + Math.max(0, Math.sin(ph)) * 0.12;
      }
    }
    // שתילה: כל שתיל קופץ בקשת גבוהה לשדה ונבלע באדמה; כשכולם נחתו — השדה נשתל
    if (S.planting != null) {
      S.planting += dt;
      for (const h of S.hops) {
        if (!h.done && S.planting >= h.at) { h.done = true; this._fly(h.c, h.to, 0.6, 0.75, 3.2); Audio.pop(); }
      }
      const last = S.hops.length ? S.hops[S.hops.length - 1].at : 0;
      if (S.planting > last + 0.9 && S.onDone) {
        S.hops.forEach(h => { h.c.visible = false; });
        if (S.ui) { S.ui.remove(); S.ui = null; }
        document.body.classList.remove('t3-on');
        const done = S.onDone; S.onDone = null;
        done({ correct: true, firstTry: S.attempts === 0 });
        this._cleanup(false);
        return;
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
