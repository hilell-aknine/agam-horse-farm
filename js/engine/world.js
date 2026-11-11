// world.js — עולם תלת-ממד: רנדרר, מצלמה, אור, שמיים, קרקע, גדר, תפאורה, חלקיקים, בחירה
import { Quality, PARAMS } from './quality.js';   // ראשון: זרע אקראי קבוע (?seed=) חל לפני כל השאר
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Models3D } from './models3d.js';
import { makeWater, WaterShared } from './water.js';
import { buildGrass, GrassTime } from './grass.js';

const World = {
  renderer: null, scene: null, camera: null, controls: null,
  clock: null, raycaster: null, pointer: null,
  pickables: [],        // אובייקטים שאפשר ללחוץ עליהם (סוסים)
  clouds: [],
  particles: [],
  effects: [],          // אפקטי-פעולה גדולים (אמוji מומחש: תפוח/מברשת/כדור)
  texLoader: null,
  _emojiTex: {},

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, Quality.pick(1.5, 2, 2)));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // tone mapping — צבעים עשירים ופחות "שטופים" (קולנועי-רך)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    // אניזוטרופיה מקסימלית — מחדד טקסטורות בזווית המצלמה הנטויה (במקום 4 קבוע)
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    Models3D.scene = this.scene;
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.texLoader = new THREE.TextureLoader();

    // מצלמה
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camera.position.set(0, 12, 22);

    // בקרת מצלמה ידידותית לילד
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.5, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 30;          // לא מתרחקים עד שהחווה נעשית זעירה
    this.controls.minPolarAngle = 0.82;      // לא מסתכלים מלמעלה
    this.controls.maxPolarAngle = 1.28;      // לא רואים שמיים/דשא ריק — החווה תמיד במסגרת
    this.controls.rotateSpeed = 0.55;
    // סיבוב מוגבל לצדדים (±40°): אפשר להציץ, אי אפשר ללכת לאיבוד מאחורי הרפת
    this.controls.minAzimuthAngle = -0.7;
    this.controls.maxAzimuthAngle = 0.7;        // סיבוב עדין — פחות רגיש ללחיצות/גרירות זעירות לא מכוונות
    // בלי סיבוב אוטומטי: ילדה בת 6 צריכה עולם יציב, שהסוס יהיה איפה שהיה לפני רגע
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.update();

    this._sky();
    this._lights();
    this._ground();
    this._fence();
    this._sun();
    this._environment();
    this._ambientCreatures();
    this._initWeather();
    this._applyTime(this.tod);

    window.addEventListener('resize', () => this.resize());
    Quality.onChange(() => this._applyQuality());
    // כלי דיבוג וצילום (scripts/shots.py): גישה לעולם מהקונסול רק כשמבקשים במפורש
    if (PARAMS.get('dbg') === '1') window.__World = this;
    return this;
  },

  _sky() {
    // כיפת שמיים בשיידר קטן: שלושה צבעים (למעלה / אופק / מתחת לאופק) + זוהר סביב השמש.
    // הצבעים מוחלפים לפי השעה ב-_applyTime, כך שלילה ושקיעה הם פלטות משלהן ולא "יום מוחשך".
    const uni = {
      top: { value: new THREE.Color(0x4f9fea) },
      horizon: { value: new THREE.Color(0xcfeaff) },
      bottom: { value: new THREE.Color(0xa9d6a0) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunCol: { value: new THREE.Color(0xfff1c2) },
      glow: { value: 0.5 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: uni, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      vertexShader: `varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float glow;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55));
          col = mix(col, bottom, smoothstep(0.0, -0.18, h));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunCol * (pow(s, 6.0) * 0.28 + pow(s, 48.0) * 0.55) * glow;
          col += sunCol * pow(1.0 - abs(h), 10.0) * 0.10 * glow;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), mat);
    sky.renderOrder = -10;
    this.scene.add(sky);
    this.skyMesh = sky;
    this.skyUni = uni;
    this.scene.fog = new THREE.Fog(0xcfeaff, 45, 190);
    this.dayNight = true;
    this.tod = 0.35;          // התחלה בבוקר
  },

  _lights() {
    // חלק מהמילוי עבר לאור הסביבה (_envLight), לכן ההמיספרה חלשה יותר מבעבר
    const hemi = new THREE.HemisphereLight(0xdfefff, 0x8aa86a, 0.7);
    this.scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight(0xfff2cc, 2.0);
    sun.position.set(14, 24, 10);
    sun.castShadow = true;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 150;
    const s = this.SHADOW_R = 30;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sunLight = sun;
    this._sunDir = new THREE.Vector3(0.4, 0.8, -0.45).normalize();
    this._blobs = [];
    this._shadowQuality();
    this._envLight();
  },

  // צללים לפי דרגת איכות: high = מפה 2048 רכה, mid = 1024 שמתעדכנת כל פריים שני, low = בלי מפה (רק כתמי צל)
  _shadowQuality() {
    const on = Quality.atLeast('mid');
    const r = this.renderer;
    const changed = r.shadowMap.enabled !== on;
    r.shadowMap.enabled = on;
    r.shadowMap.type = Quality.tier === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.sunLight.castShadow = on;
    const size = Quality.pick(512, 1024, 2048);
    if (this.sunLight.shadow.mapSize.x !== size) {
      this.sunLight.shadow.mapSize.set(size, size);
      if (this.sunLight.shadow.map) { this.sunLight.shadow.map.dispose(); this.sunLight.shadow.map = null; }
    }
    r.shadowMap.autoUpdate = Quality.tier === 'high';
    r.shadowMap.needsUpdate = true;
    // כתם הצל מתחת לכל דמות: כשיש צל אמיתי הוא נשאר כצל-מגע עדין, בלי צל אמיתי הוא הצל כולו
    this.BLOB_OP = on ? 0.45 : 1;
    for (const m of this._blobs) m.opacity = this.BLOB_OP;
    if (changed && this.scene) this.scene.traverse(o => {
      const m = o.material; if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach(mm => { mm.needsUpdate = true; });
    });
  },

  // האור האמיתי הולך עם השמש שרואים בשמיים (ובלילה עם הירח), ותיבת הצל הולכת עם המצלמה,
  // כך שיש צל אמיתי גם ביער, באגם ובכפר ולא רק במרכז החווה.
  _updateSunLight() {
    const sun = this.sunLight, tgt = this.controls.target;
    const step = 1;                                           // קפיצות של מטר: הצל לא "רוחש" כשהמצלמה זזה
    const cx = Math.round(tgt.x / step) * step, cz = Math.round(tgt.z / step) * step;
    sun.target.position.set(cx, 0, cz);
    sun.position.set(cx + this._sunDir.x * 70, this._sunDir.y * 70, cz + this._sunDir.z * 70);
    sun.target.updateMatrixWorld();
    if (!this.renderer.shadowMap.autoUpdate && this.renderer.shadowMap.enabled) {
      this._shF = (this._shF || 0) + 1;
      if (this._shF % 2 === 0) this.renderer.shadowMap.needsUpdate = true;
    }
  },

  // אור סביבה מהשמיים (PMREM): המודלים מקבלים מילוי רך וברק עדין מכל הכיוונים, לא רק מהשמש.
  // נבנה פעם אחת בעלייה. בלילה מנמיכים את העוצמה דרך envMapIntensity (ראו _setEnvIntensity).
  _envLight() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#8fc8ff');
    grad.addColorStop(0.47, '#fff1d6');   // אופק חם
    grad.addColorStop(0.53, '#9cc874');
    grad.addColorStop(1, '#5d8a3c');      // דשא מתחת
    g.fillStyle = grad; g.fillRect(0, 0, 16, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose(); tex.dispose();
    this.ENV_DAY = 0.3;      // יותר מזה והצללים נשטפים (0.6 שטף אותם)
    this._envI = this.ENV_DAY;
    this._envT = 0;
  },

  _setEnvIntensity(v) { this._envI = v; },

  // r160 בלי scene.environmentIntensity — מעדכנים את החומרים עצמם, פעם בשנייה וחצי.
  // הסריקה התקופתית תופסת גם מודלים שנטענו אחרי השינוי האחרון (חיה שנקנתה, גידול חדש)
  _applyEnvIntensity(dt) {
    this._envT -= dt;
    if (this._envT > 0) return;
    this._envT = 1.5;
    const v = this._envI;
    this.scene.traverse(o => {
      const m = o.material;
      if (!m) return;
      if (Array.isArray(m)) m.forEach(mm => { if ('envMapIntensity' in mm) mm.envMapIntensity = v; });
      else if ('envMapIntensity' in m) m.envMapIntensity = v;
    });
  },

  _ground() {
    // קרקע עגולה ירוקה ענקית (עולם פתוח) עם גבעות עדינות
    const geo = new THREE.CircleGeometry(120, 200);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const r = Math.sqrt(x * x + z * z);
      // מרכז המגרש שטוח (r<16); גבעות רק בטבעת החיצונית, מחוץ לגדר
      const ring = Math.max(0, Math.min(1, (r - 16) / 6));
      const h = Math.sin(x * 0.18) * Math.cos(z * 0.18) * 0.45 * ring;
      pos.setY(i, h);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x7ec850, map: this._grassTexture(), roughness: 0.95, metalness: 0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

    // רצפות האזורים מתווספות ב-floorPatch (גינה/מגרש רכיבה) — המרכז נשאר דשא
  },

  // כתמי דשא בהירים וכהים (טקסטורה קטנה שחוזרת על עצמה) — במקום ירוק אחיד ושטוח.
  // הטקסטורה בהירה-כמעט-לבנה ומוכפלת בצבע הקרקע, כך שהגוון הכללי לא משתנה.
  _grassTexture() {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, S, S);
    // ציור כל כתם 9 פעמים (מוזז ב-±S) כדי שהשוליים יתחברו בלי תפר
    const blot = (x, y, r, col) => {
      for (let dx = -S; dx <= S; dx += S) for (let dy = -S; dy <= S; dy += S) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(240,240,240,0)');
        g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    };
    for (let i = 0; i < 26; i++) blot(Math.random() * S, Math.random() * S, 24 + Math.random() * 46, 'rgba(255,255,232,0.35)');
    for (let i = 0; i < 22; i++) blot(Math.random() * S, Math.random() * S, 20 + Math.random() * 40, 'rgba(160,185,145,0.5)');
    // קווקווים זעירים של עלי דשא
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,240,0.35)' : 'rgba(150,175,140,0.35)';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 3); g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(26, 26);
    tex.anisotropy = this.maxAniso || 4;
    return tex;
  },

  _fence() { this.fenceR = 15; this._buildFenceAt(15); },

  // בונה גדר בטבעת ברדיוס נתון. נשמר ב-this.fenceGroup כדי לאפשר הרחבת-חווה (בנייה מחדש)
  _buildFenceAt(R) {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xa9743b, roughness: 0.8 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xc79a5b, roughness: 0.8 });
    const N = Math.round(28 * R / 15);   // צפיפות עמודים קבועה כשהחווה גדלה
    const group = new THREE.Group();
    const seg = 2 * R * Math.sin(Math.PI / N) + 0.1;
    // InstancedMesh: כל העמודים בציור אחד וכל הקורות בציור אחד (היו ~84 ציורים נפרדים)
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.19, 0.23, 2.2, 7), woodMat, N);
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(seg, 0.22, 0.16), railMat, N * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      q.identity();
      m.compose(p.set(x, 1.0, z), q, one); posts.setMatrixAt(i, m);
      // קורה אופקית לעמוד הבא
      const a2 = ((i + 1) / N) * Math.PI * 2;
      const x2 = Math.cos(a2) * R, z2 = Math.sin(a2) * R;
      q.setFromAxisAngle(up, Math.atan2(-(z2 - z), (x2 - x)));   // יישור ציר ה-X של הקורה לאורך הכיוון לעמוד הבא
      [0.7, 1.5].forEach((yy, k) => { m.compose(p.set((x + x2) / 2, yy, (z + z2) / 2), q, one); rails.setMatrixAt(i * 2 + k, m); });
    }
    posts.castShadow = true; posts.receiveShadow = true; rails.castShadow = true;
    posts.frustumCulled = false; rails.frustumCulled = false;   // טבעת סביב כל החווה: תמיד במסגרת
    group.add(posts, rails);
    this.fenceGroup = group;
    this.fenceR = R;
    this.scene.add(group);
  },

  // הרחבת-חווה: בונה מחדש את הגדר ברדיוס גדול יותר (השטח גדל באופן נראה לעין)
  rebuildFence(R) {
    if (this.fenceGroup) {
      this.scene.remove(this.fenceGroup);
      this.fenceGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    this._buildFenceAt(R);
  },

  _sun() {
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(3, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff3a0, fog: false })
    );
    sun.position.set(-22, 30, -30);
    this.scene.add(sun);
    this.sunMesh = sun;
    // הילה
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(4.4, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff7c8, transparent: true, opacity: 0.35, fog: false })
    );
    halo.position.copy(sun.position);
    this.scene.add(halo);
    this.sunHalo = halo;

    // ירח + כוכבים (מופיעים בלילה)
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfdf6d0, fog: false, transparent: true, opacity: 0 })
    );
    moon.position.set(22, 30, -30);
    this.scene.add(moon);
    this.moonMesh = moon;

    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * 0.5 + 0.1;
      sp.push(Math.cos(a) * 80 * Math.cos(b), 30 + Math.random() * 45, Math.sin(a) * 80 * Math.cos(b));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0, fog: false }));
    this.scene.add(this.stars);
    // שכבת כוכבים גדולים ובהירים שמנצנצים בקצב אחר: שמי הלילה נראים עמוקים ולא "נקודות באותו גודל"
    const bg = new THREE.BufferGeometry(), bp = [];
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * 0.55 + 0.12;
      bp.push(Math.cos(a) * 80 * Math.cos(b), 32 + Math.random() * 45, Math.sin(a) * 80 * Math.cos(b));
    }
    bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    this.bigStars = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xfff6d8, size: 1.7, transparent: true, opacity: 0, fog: false }));
    this.scene.add(this.bigStars);
  },

  // חרקים מרחפים לאווירה: פרפרים ביום, גחליליות בלילה (שימוש-חוזר ב-emojiSprite)
  _ambientCreatures() {
    this.ambients = [];
    const mk = (emoji, size, baseY, yVar, night, op) => {
      const s = this.emojiSprite(emoji, size);
      s.center.set(0.5, 0.5);
      s.position.set((Math.random() - 0.5) * 34, baseY + Math.random() * yVar, (Math.random() - 0.5) * 22 - 2);
      s.material.opacity = 0;
      s.userData = { ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.5, night: !!night, baseY: s.position.y, maxOp: op };
      this.scene.add(s);
      this.ambients.push(s);
    };
    for (let i = 0; i < 4; i++) mk('🦋', 0.95, 2.0, 2.6, false, 1);
    for (let i = 0; i < 9; i++) mk('✨', 0.55, 1.1, 1.8, true, 0.95);
  },

  // רישום תפאורה שתנדנד ברוח (על material.rotation — לא על ה-Sprite עצמו)
  addSway(sp) {
    if (!this.swayables) this.swayables = [];
    this.swayables.push({ sp, phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 0.6, amp: 0.025 + Math.random() * 0.022 });
  },

  _environment() {
    // גבעות מתגלגלות מסביב (מעבר לגדר) — נותנות עומק לעולם.
    // כל גבעה צבועה לפי גובה (כהה למטה, בהירה ומוארת למעלה), מעט לא סימטרית, ומקבלת צל.
    const hills = [
      [-36, -30, 16, 7], [32, -36, 19, 9], [44, 8, 15, 7], [-46, 12, 18, 9],
      [2, -46, 20, 6],   /* הונמכה: הסתירה את היער מהמצלמה */ [-22, 44, 16, 8], [26, 42, 17, 8], [50, -20, 16, 8], [-50, -18, 17, 9]
    ];
    // טביעת הרגל של כל גבעה על הקרקע (כמו בגרסה הקודמת: כיפה שרק ראשה מעל האדמה, אז היא צרה מהרדיוס)
    const foot = (r, h) => r * Math.sqrt(1 - Math.pow((h - 2) / (h + 2), 2));
    this.hills = hills.map(([x, z, r, h]) => [x, z, foot(r, h)]);
    const hillTex = this._grassTexture(); hillTex.repeat.set(7, 5);
    const hillMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: hillTex, roughness: 1, metalness: 0 });
    const low = new THREE.Color(0x5fae3e), high = new THREE.Color(0x9bdc66), tmp = new THREE.Color();
    hills.forEach(([x, z, r, h], i) => {
      const R0 = r; r = foot(R0, h);
      const geo = new THREE.SphereGeometry(r, 30, 16, 0, Math.PI * 2, 0, Math.PI / 2);   // חצי כדור עליון בלבד
      const pos = geo.attributes.position, col = [];
      for (let v = 0; v < pos.count; v++) {
        const px = pos.getX(v), py = pos.getY(v), pz = pos.getZ(v);
        // בליטות עדינות: הגבעה לא כיפה מושלמת
        const n = 1 + 0.07 * Math.sin(px * 0.45 + i) * Math.cos(pz * 0.5 + i * 2) + 0.04 * Math.sin((px + pz) * 0.9);
        pos.setXYZ(v, px * n, py * n, pz * n);
        const t = Math.min(1, py / r);
        tmp.copy(low).lerp(high, Math.pow(t, 0.8)).offsetHSL((i % 3 - 1) * 0.012, 0, 0);
        col.push(tmp.r, tmp.g, tmp.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const dome = new THREE.Mesh(geo, hillMat);
      dome.scale.set(1, h / r, 1);
      dome.position.set(x, -0.05, z);
      dome.receiveShadow = true;
      this.scene.add(dome);
    });
    // הרים רחוקים: שתי שכבות (קרובה כחלחלה, רחוקה בהירה) עם פסגות מושלגות, נמוגות בערפל
    const mtMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    const mkMountain = (radius, height, rock, seed) => {
      const geo = new THREE.ConeGeometry(radius, height, 9, 5);
      const pos = geo.attributes.position, col = [];
      const rockC = new THREE.Color(rock), snow = new THREE.Color(0xffffff);
      for (let v = 0; v < pos.count; v++) {
        const y = pos.getY(v), t = (y + height / 2) / height;           // 0 בסיס, 1 פסגה
        if (t < 0.98) {                                                    // סלע מחוספס (הפסגה נשארת חדה)
          const k = 1 + 0.16 * Math.sin(pos.getX(v) * 0.7 + seed) * Math.cos(pos.getZ(v) * 0.6 + seed * 1.7);
          pos.setX(v, pos.getX(v) * k); pos.setZ(v, pos.getZ(v) * k);
        }
        tmp.copy(rockC).lerp(snow, t > 0.62 ? 1 : 0).offsetHSL(0, 0, (t - 0.3) * 0.06);
        col.push(tmp.r, tmp.g, tmp.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, mtMat);
    };
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const height = 20 + (i % 4) * 6;
      const mt = mkMountain(13 + (i % 3) * 4, height, 0xa3c2da, i * 1.3);
      // הר שנופל על מסלול הרכיבה (-42,-62) נדחק אחורה — אחרת המצלמה הרודפת נכנסת לתוכו
      const r = Math.hypot(Math.cos(a) * 100 + 42, Math.sin(a) * 100 + 62) < 50 ? 150 : 100;
      mt.position.set(Math.cos(a) * r, height / 2 - 4, Math.sin(a) * r);
      this.scene.add(mt);
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.05;
      const height = 34 + (i % 3) * 9;
      const mt = mkMountain(22 + (i % 4) * 5, height, 0xb9d3e8, 10 + i * 2.1);
      mt.position.set(Math.cos(a) * 158, height / 2 - 6, Math.sin(a) * 158);
      this.scene.add(mt);
    }
    // ציפורים שמרחפות (נסחפות כמו עננים)
    for (let i = 0; i < 4; i++) {
      const b = this.emojiSprite('🐦', 1.4);
      b.center.set(0.5, 0.5);
      b.position.set(-50 + Math.random() * 100, 20 + Math.random() * 12, -45 + Math.random() * 25);
      this.addCloud(b);
    }
  },

  // --- עזרי טקסטורה / sprites ---
  // shared=true → טקסטורה משותפת במטמון (לעצמים רבים שאינם משוחררים: תפאורה, פיזור)
  loadTexture(url, shared) {
    if (shared) {
      if (!this._texCache) this._texCache = {};
      if (this._texCache[url]) return this._texCache[url];
    }
    const t = this.texLoader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.maxAniso || 4;
    if (shared) this._texCache[url] = t;
    return t;
  },

  // sprite שעומד על הקרקע (מרכז תחתון)
  makeBillboard(url, height = 4, shared = false) {
    const tex = this.loadTexture(url, shared);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.center.set(0.5, 0.0);
    sp.scale.set(height, height, 1);
    Models3D.attach(sp, url, height);   // יש מודל תלת-ממדי לציור הזה? הוא יחליף אותו
    return sp;
  },

  makeGroundShadow(radius = 1.6) {
    if (!this._blobTex) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 4, 64, 64, 60);
      grad.addColorStop(0, 'rgba(0,0,0,0.38)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      this._blobTex = new THREE.CanvasTexture(c);
      this._blobTex.dispose = () => {};        // משותפת לכולם: מי שמשחרר את הצל שלו לא מוחק אותה לאחרים
    }
    const mat = new THREE.MeshBasicMaterial({ map: this._blobTex, transparent: true, depthWrite: false, opacity: this.BLOB_OP ?? 1 });
    this._blobs.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.05;
    return m;
  },

  // רצפת אזור — כתם אליפטי רך בצבע נתון (גינה=חום, מגרש רכיבה=חול)
  floorPatch(x, z, w, d, colorHex) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const r = (colorHex >> 16) & 255, gg = (colorHex >> 8) & 255, b = colorHex & 255;
    const grad = g.createRadialGradient(128, 128, 26, 128, 128, 126);
    grad.addColorStop(0, `rgba(${r},${gg},${b},0.96)`);
    grad.addColorStop(0.72, `rgba(${r},${gg},${b},0.92)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(1, 56),
      // חומר מואר: הרצפה מחשיכה בלילה ומקבלת צל, כמו הדשא שסביבה (היה MeshBasic שזהר בחושך)
      new THREE.MeshStandardMaterial({
        map: tex, transparent: true, depthWrite: false, roughness: 1, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4
      })
    );
    m.receiveShadow = true;
    m.rotation.x = -Math.PI / 2;
    m.scale.set(w / 2, d / 2, 1);
    m.position.set(x, 0.1, z);
    this.scene.add(m);
    return m;
  },

  // שבילי עפר מהחווה לכל אזור: רצועה רציפה אחת לכל השבילים (ציור אחד), מתפתלת מעט, מקבלת צל.
  // targets: [[x, z], ...]. כל שביל יוצא ממרכז החווה ונעצר לפני רצפת האזור.
  buildPaths(targets) {
    const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, S, 0);           // רוחב השביל: שוליים רכים שנמוגים לדשא
    grad.addColorStop(0, 'rgba(206,174,124,0)'); grad.addColorStop(0.24, 'rgba(206,174,124,0.95)');
    grad.addColorStop(0.76, 'rgba(206,174,124,0.95)'); grad.addColorStop(1, 'rgba(206,174,124,0)');
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {                              // חצץ: נקודות בהירות וכהות
      g.fillStyle = Math.random() < 0.5 ? 'rgba(236,214,170,0.55)' : 'rgba(160,126,84,0.45)';
      const x = S * 0.26 + Math.random() * S * 0.48, y = Math.random() * S, r = 0.8 + Math.random() * 1.6;
      g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = this.maxAniso || 4;
    const pos = [], uv = [], idx = [], nor = [];
    const N = 26, HALF = 2.7;
    targets.forEach(([tx, tz], pi) => {
      const len = Math.hypot(tx, tz), dx = tx / len, dz = tz / len, nx = -dz, nz = dx;
      const base = pos.length / 3;
      for (let i = 0; i <= N; i++) {
        const t = i / N, k = 0.17 + t * 0.75;                    // מקטע השביל: מהגדר ועד לפני רצפת האזור
        const ends = Math.sin(t * Math.PI);                       // 0 בקצוות: השביל מתחדד ולא נחתך
        const wig = Math.sin(t * Math.PI * 2.5 + pi * 1.7) * 1.1 * ends;
        const half = HALF * (0.35 + 0.65 * Math.min(1, ends * 3));
        const cx = tx * k + nx * wig, cz = tz * k + nz * wig;
        pos.push(cx - nx * half, 0, cz - nz * half, cx + nx * half, 0, cz + nz * half);
        uv.push(0, k * len / 5, 1, k * len / 5);
        nor.push(0, 1, 0, 0, 1, 0);
        if (i < N) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: tex, transparent: true, depthWrite: false, roughness: 1, metalness: 0, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4
    }));
    mesh.position.y = 0.09;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.pathTargets = targets;
    return mesh;
  },

  // משטח מים (אגם): חוף חול מתחת + מים בשיידר מעל. מחזיר את המים (אפשר לשנות להם scale כמו ל-floorPatch)
  waterPatch(x, z, w, d) {
    this.floorPatch(x, z, w + 4.5, d + 4.5, 0xe6d6a4);          // חוף חול
    const m = makeWater(w, d, { animated: Quality.atLeast('mid') });
    m.position.set(x, 0.12, z);
    this.scene.add(m);
    return m;
  },

  // ציצות דשא מתנדנדות סביב החווה וסביב כל אזור. zones: [{x, z, r0, r1, n}] = טבעת סביב מרכז.
  // לא שותלים על שבילים, על גבעות או בתוך רצפות האזורים. הכמות לפי דרגת האיכות.
  plantGrass(zones) {
    const scale = Quality.pick(0, 0.4, 1);
    if (!scale) return;
    const paths = this.pathTargets || [], hills = this.hills || [];
    const onPath = (x, z) => paths.some(([tx, tz]) => {
      const len2 = tx * tx + tz * tz, t = Math.max(0.12, Math.min(0.95, (x * tx + z * tz) / len2));
      return Math.hypot(x - tx * t, z - tz * t) < 4.2;
    });
    const onHill = (x, z) => hills.some(([hx, hz, r]) => Math.hypot(x - hx, z - hz) < r * 1.06);
    const inZone = (x, z, self) => zones.some(o => o !== self && Math.hypot(x - o.x, z - o.z) < o.r0);
    const pts = [];
    for (const zn of zones) {
      const want = Math.round(zn.n * scale);
      for (let i = 0, tries = 0; i < want && tries < want * 6; tries++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(zn.r0 * zn.r0 + Math.random() * (zn.r1 * zn.r1 - zn.r0 * zn.r0));
        const x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r * (zn.squash ?? 1);
        if (onPath(x, z) || onHill(x, z) || inZone(x, z, zn)) continue;
        pts.push([x, z]); i++;
      }
    }
    if (this.grassMesh) { this.scene.remove(this.grassMesh); this.grassMesh.geometry.dispose(); this.grassMesh.material.dispose(); }
    this.grassMesh = buildGrass(pts);
    this.scene.add(this.grassMesh);
    this._grassZones = zones;
  },

  // שלט עץ עם טקסט עברי על עמוד
  makeSign(text) {
    const grp = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.7, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.85 })
    );
    post.position.y = 0.85; post.castShadow = true;
    grp.add(post);
    const c = document.createElement('canvas'); c.width = 256; c.height = 100;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b3793a';
    ctx.beginPath(); ctx.roundRect(6, 6, 244, 88, 16); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#7a4f23';
    ctx.beginPath(); ctx.roundRect(6, 6, 244, 88, 16); ctx.stroke();
    ctx.fillStyle = '#fff7e6'; ctx.font = 'bold 42px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.fillText(text, 128, 52);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.center.set(0.5, 0.0); sp.scale.set(3.0, 1.17, 1); sp.position.y = 1.7;
    grp.add(sp);
    return grp;
  },

  registerPickable(obj) { this.pickables.push(obj); },
  unregisterPickable(obj) {
    const i = this.pickables.indexOf(obj);
    if (i >= 0) this.pickables.splice(i, 1);
  },

  pickAt(clientX, clientY) {
    this.pointer.x = (clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, true).filter(h => h.object.visible);
    return hits.length ? hits[0] : null;
  },

  // בחירה מתוך רשימת אובייקטים ספציפית (לגרירה במצב עיצוב)
  pickAmong(clientX, clientY, list) {
    if (!list || !list.length) return null;
    this.pointer.x = (clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(list, true).filter(h => h.object.visible);
    return hits.length ? hits[0] : null;
  },

  // נקודת-קרקע (מישור y=0) מתחת לנקודת המסך — יעד הגרירה
  pickGround(clientX, clientY) {
    this.pointer.x = (clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this._groundPlane) this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this._groundPlane, pt) ? pt : null;
  },

  // --- חלקיקים (לבבות / כוכבים / קונפטי) ---
  _emoji(emoji) {
    if (this._emojiTex[emoji]) return this._emojiTex[emoji];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.font = '52px serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(emoji, 32, 36);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this._emojiTex[emoji] = t;
    return t;
  },

  spawnParticles(worldPos, kind = 'heart', count = 12) {
    const map = {
      heart: '❤️', star: '⭐', confetti: '🎉', sparkle: '✨', coin: '🪙',
      apple: '🍎', bubble: '🫧', ball: '🎾', water: '💧', grass: '🌿', music: '🎵', leaf: '🍂'
    };
    const emoji = map[kind] || '⭐';
    const tex = this._emoji(emoji);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      const sz = 0.6 + Math.random() * 0.5;
      sp.scale.set(sz, sz, 1);
      sp.position.copy(worldPos);
      sp.position.y += 1;
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 2.5;
      sp.userData.vel = new THREE.Vector3(Math.cos(ang) * spd, 3 + Math.random() * 3, Math.sin(ang) * spd);
      sp.userData.life = 1.2 + Math.random() * 0.6;
      sp.userData.age = 0;
      this.scene.add(sp);
      this.particles.push(sp);
    }
  },

  // אפקט-פעולה מומחש: אמוji ענק שקופץ ליד הסוס, מתנדנד, ואז מתעופף ונמוג
  // (פידבק ויזואלי ברור: 🍎 להאכיל · 🧼 לנקות · 🎾 לשחק). big=true → גדול במיוחד
  showAction(worldPos, emoji, big = false) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._emoji(emoji), transparent: true, depthWrite: false }));
    sp.center.set(0.5, 0.5);
    sp.position.set(worldPos.x, (worldPos.y || 0) + 2.4, worldPos.z);
    sp.scale.set(0.1, 0.1, 1);
    this.scene.add(sp);
    this.effects.push({ sprite: sp, age: 0, life: 1.4, size: big ? 4.2 : 3.0, baseY: sp.position.y });
    return sp;
  },

  _updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += dt;
      const k = e.age / e.life;               // 0→1
      const sp = e.sprite;
      // קפיצה פנימה (0-0.28): גדילה עם overshoot אלסטי; החזקה; יציאה (0.6-1): עלייה ודעיכה
      let s;
      if (k < 0.28) { const t = k / 0.28; s = e.size * (1.15 - 0.15 * Math.cos(t * Math.PI)) * (t < 1 ? (1 + 0.12 * Math.sin(t * Math.PI)) : 1); }
      else s = e.size;
      sp.scale.set(s, s, 1);
      sp.material.rotation = Math.sin(e.age * 9) * 0.18;      // נדנוד עליז
      if (k > 0.6) { const t = (k - 0.6) / 0.4; sp.position.y = e.baseY + t * 1.8; sp.material.opacity = Math.max(0, 1 - t); }
      else { sp.position.y = e.baseY + Math.sin(e.age * 6) * 0.12; sp.material.opacity = 1; }
      if (e.age >= e.life) { this.scene.remove(sp); sp.material.dispose(); this.effects.splice(i, 1); }
    }
  },

  // sprite מאימוג'י (לשלבי גדילה וכו')
  emojiSprite(emoji, size = 1) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._emoji(emoji), transparent: true, depthWrite: false }));
    sp.scale.set(size, size, 1);
    return sp;
  },

  addCloud(sprite) { this.clouds.push(sprite); this.scene.add(sprite); },

  _updateDayNight(dt) {
    if (!this.dayNight) return;
    this.tod = (this.tod + dt / 240) % 1;                 // מחזור מלא ~4 דקות
    this._applyTime(this.tod);
  },

  // כל מה שתלוי בשעה: אור, צבעים, שמיים, ערפל, שמש וירח. t = 0..1 (0 חצות, 0.5 צהריים)
  _applyTime(t) {
    if (!this._tc) this._tc = {
      nTop: new THREE.Color(0x0f1b47), dTop: new THREE.Color(0x3f93ea), kTop: new THREE.Color(0x5b78c9),
      nHor: new THREE.Color(0x3b4a86), dHor: new THREE.Color(0xcdeaff), kHor: new THREE.Color(0xffb27a),
      nBot: new THREE.Color(0x26375a), dBot: new THREE.Color(0xb7dca8), kBot: new THREE.Color(0xd9a37c),
      nSun: new THREE.Color(0x5a70c0), dSun: new THREE.Color(0xfff0cf), kSun: new THREE.Color(0xff9a55),
      nGnd: new THREE.Color(0x2e3d55), dGnd: new THREE.Color(0x8aa86a),
      moonGlow: new THREE.Color(0x9fb4ff), sunGlow: new THREE.Color(0xfff1c2), duskGlow: new THREE.Color(0xffb070)
    };
    const C = this._tc;
    const a = t * Math.PI * 2 - Math.PI / 2;
    const e = Math.sin(a);                                 // גובה השמש: -1 חצות, 0 אופק, 1 צהריים
    const light = 0.5 + 0.5 * e;                           // 0=חצות, 1=צהריים
    const day = Math.min(1, light * 1.3);
    const dusk = Math.max(0, 1 - Math.abs(e) * 2.6);       // 1 בדיוק בזריחה/שקיעה, 0 רחוק מהן
    const mix3 = (out, n, d, k, kAmt) => out.copy(n).lerp(d, day).lerp(k, dusk * kAmt);

    // אור: שמש חזקה ביום (המודלים כבר לא מאירים את עצמם), רצפת לילה גבוהה כדי שהשדות יישארו קריאים
    this.hemi.intensity = 0.62 + 0.38 * light;
    mix3(this.hemi.color, C.nHor, C.dHor, C.kHor, 0.5);
    this.hemi.groundColor.copy(C.nGnd).lerp(C.dGnd, day);
    this._setEnvIntensity(this.ENV_DAY * (0.35 + 0.65 * light));
    this.sunLight.intensity = 0.5 + 1.0 * light;
    mix3(this.sunLight.color, C.nSun, C.dSun, C.kSun, 0.8);

    // שמיים וערפל
    const U = this.skyUni;
    mix3(U.top.value, C.nTop, C.dTop, C.kTop, 0.55);
    mix3(U.horizon.value, C.nHor, C.dHor, C.kHor, 0.9);
    mix3(U.bottom.value, C.nBot, C.dBot, C.kBot, 0.6);
    this.scene.fog.color.copy(U.horizon.value);
    WaterShared.day.value = day;
    WaterShared.tint.value.setRGB(0.34 + 0.66 * day, 0.4 + 0.6 * day, 0.58 + 0.42 * day).lerp(C.kHor, dusk * 0.25);

    // מסלול שמש/ירח
    this.sunMesh.position.set(Math.cos(a) * 42, e * 38, -30);
    this.sunHalo.position.copy(this.sunMesh.position);
    this.moonMesh.position.set(-Math.cos(a) * 42, -e * 38, -30);
    const nightF = 1 - Math.min(1, light * 1.5);
    this.moonMesh.material.opacity = nightF;
    this.stars.material.opacity = nightF * (0.78 + 0.16 * Math.sin((this._t || 0) * 2.5));
    if (this.bigStars) this.bigStars.material.opacity = nightF * (0.7 + 0.3 * Math.sin((this._t || 0) * 1.7 + 1));
    const sunUp = e > -0.05;
    this.sunMesh.visible = sunUp; this.sunHalo.visible = sunUp;

    // זוהר בשמיים סביב השמש (או הירח)
    const body = sunUp ? this.sunMesh : this.moonMesh;
    U.sunDir.value.copy(body.position).normalize();
    U.sunCol.value.copy(sunUp ? C.sunGlow : C.moonGlow).lerp(C.duskGlow, sunUp ? dusk : 0);
    U.glow.value = sunUp ? 0.55 + 0.45 * dusk : 0.25;

    // כיוון האור האמיתי: מהשמש ביום, מהירח בלילה. קרוב לאופק הכיוון הצידי נחלש והאור בא מאחור,
    // כך שהמעבר שמש→ירח רציף והצללים אף פעם לא נמתחים לאינסוף.
    const w = Math.min(1, Math.abs(e) / 0.35), ws = w * w * (3 - 2 * w);
    this._sunDir.set(Math.cos(a) * 42 * ws * Math.sign(e || 1), Math.max(Math.abs(e), 0.5) * 38, -30).normalize();
  },

  _initWeather() {
    // גשם — נקודות נופלות
    const N = 350, arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 44;
      arr[i * 3 + 1] = Math.random() * 34 + 1;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    this.rain = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbcd6f0, size: 0.28, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.rain.visible = false;
    this.scene.add(this.rain);
    // קשת בענן בשמיים
    this.rainbow = this.makeBillboard('assets/rainbow.png', 34, true);
    this.rainbow.center.set(0.5, 0.5);
    this.rainbow.position.set(-6, 24, -34);
    this.rainbow.material.opacity = 0;
    this.rainbow.visible = false;
    this.scene.add(this.rainbow);
    this._wState = 'clear'; this._wt = 0; this._wNext = 30 + Math.random() * 40;
  },

  _updateWeather(dt) {
    this._wt += dt;
    if (this._wt > this._wNext) {
      this._wt = 0;
      if (this._wState === 'clear') { this._wState = 'rain'; this._wNext = 12 + Math.random() * 8; }
      else if (this._wState === 'rain') { this._wState = 'rainbow'; this._wNext = 10; }
      else { this._wState = 'clear'; this._wNext = 45 + Math.random() * 50; }
    }
    const rainTarget = this._wState === 'rain' ? 0.55 : 0;
    const m = this.rain.material;
    m.opacity += (rainTarget - m.opacity) * Math.min(1, dt * 2);
    if (m.opacity > 0.01) {
      this.rain.visible = true;
      const p = this.rain.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { let y = p.getY(i) - 24 * dt; if (y < 0.5) y = 34; p.setY(i, y); }
      p.needsUpdate = true;
    } else this.rain.visible = false;
    const rbTarget = this._wState === 'rainbow' ? 0.92 : 0;
    const rm = this.rainbow.material;
    rm.opacity += (rbTarget - rm.opacity) * Math.min(1, dt * 1.4);
    this.rainbow.visible = rm.opacity > 0.01;
  },

  // נסיעה חלקה למרכז אזור (עולם פתוח) — כולל נרמול מרחק לטווח עבודה נוח וקבוע
  // reset:true (כפתור 🏠) — גם מחזיר את זווית המצלמה למבט הפתיחה, לא רק את המרכז
  travelTo(cx, cz, dist = 22, reset = false) {
    this._travel = { x: cx, z: cz, dist, dir: reset ? new THREE.Vector3(0, 12, 22).normalize() : null };
    this.controls.autoRotate = false;
  },
  _updateTravel(dt) {
    if (!this._travel) return;
    const T = this._travel, k = Math.min(1, dt * 2.0);
    const tgt = this.controls.target;
    tgt.x += (T.x - tgt.x) * k;
    tgt.z += (T.z - tgt.z) * k;
    // נרמול מרחק המצלמה → כל חזרה ל"חווה"/אזור מגיעה לאותו מרחק עבודה נוח
    const off = this.camera.position.clone().sub(tgt);
    const len = T.dist ? off.length() + (T.dist - off.length()) * k : off.length();
    if (T.dir) off.normalize().lerp(T.dir, k);
    off.setLength(len);
    this.camera.position.copy(tgt).add(off);
    // מסיימים רק כשהגענו גם למקום, גם למרחק וגם לזווית (קודם: נעצר מיד אם כבר היינו קרובים למרכז)
    const near = Math.hypot(tgt.x - T.x, tgt.z - T.z) < 0.3
      && (!T.dist || Math.abs(off.length() - T.dist) < 0.3)
      && (!T.dir || off.clone().normalize().distanceTo(T.dir) < 0.02);
    if (near) { this._travel = null; this.controls.update(); }
  },

  update() {
    const raw = this.clock.getDelta();
    this._rawDt = raw;
    const dt = Math.min(raw, 0.05);
    this._t = (this._t || 0) + dt;
    this._updateTravel(dt);
    WaterShared.time.value = GrassTime.value = this._t;
    this.controls.update();
    this._updateDayNight(dt);
    this._updateSunLight();
    this._applyEnvIntensity(dt);
    this._updateWeather(dt);
    Models3D.sync(dt);

    // עננים נעים
    for (const cl of this.clouds) {
      cl.position.x += dt * 0.5;
      if (cl.position.x > 60) cl.position.x = -60;
    }

    // נדנוד תפאורה ברוח
    if (this.swayables) {
      for (const s of this.swayables) s.sp.material.rotation = Math.sin(this._t * s.speed + s.phase) * s.amp;
    }

    // חרקים מרחפים (פרפרים ביום, גחליליות בלילה)
    if (this.ambients) {
      const lt = 0.5 + 0.5 * Math.sin(this.tod * Math.PI * 2 - Math.PI / 2);
      const isNight = lt < 0.34;
      for (const a of this.ambients) {
        const u = a.userData;
        u.ph += dt * u.sp;
        a.position.x += Math.cos(u.ph * 0.7) * dt * 1.3;
        a.position.z += Math.sin(u.ph) * dt * 1.0;
        a.position.y = u.baseY + Math.sin(u.ph * 2.2) * 0.45;
        if (a.position.x > 20) a.position.x = -20; else if (a.position.x < -20) a.position.x = 20;
        if (a.position.z > 12) a.position.z = -16; else if (a.position.z < -16) a.position.z = 12;
        const want = (u.night ? isNight : !isNight) ? u.maxOp : 0;
        a.material.opacity += (want - a.material.opacity) * Math.min(1, dt * 2);
        a.visible = a.material.opacity > 0.02;
      }
    }

    // חלקיקים
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.age += dt;
      const v = p.userData.vel;
      v.y -= 6 * dt; // כבידה
      p.position.addScaledVector(v, dt);
      const k = p.userData.age / p.userData.life;
      p.material.opacity = Math.max(0, 1 - k);
      p.material.rotation += dt * 2; // סיבוב החלקיק (על החומר, לא על ה-Sprite)
      if (p.userData.age >= p.userData.life) {
        this.scene.remove(p);
        p.material.dispose();
        this.particles.splice(i, 1);
      }
    }
    this._updateEffects(dt);
    return dt;
  },

  // activeScene: כשנכנסים למבנה מרנדרים את החדר במקום העולם (העולם ממשיך להתעדכן)
  render() {
    this.renderer.render(this.activeScene || this.scene, this.camera);
    Quality.tick(this._rawDt || 0.016, this.renderer);
  },

  setDayNight(on) {
    this.dayNight = on;
    if (!on) {     // קיבוע ליום בהיר (בוקר מאוחר: שמש גבוהה, צללים קצרים)
      this.tod = 0.42;
      this._applyTime(this.tod);
    }
  },

  // דרגת האיכות השתנתה (ירידה אוטומטית בקצב נמוך): מעדכנים מה שתלוי בה
  _applyQuality() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, Quality.pick(1.5, 2, 2)));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this._shadowQuality();
    if (this._grassZones) this.plantGrass(this._grassZones);
  },

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
};

export { World, THREE, Quality };
