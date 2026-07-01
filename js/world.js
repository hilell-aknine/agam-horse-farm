// world.js — עולם תלת-ממד: רנדרר, מצלמה, אור, שמיים, קרקע, גדר, תפאורה, חלקיקים, בחירה
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const World = {
  renderer: null, scene: null, camera: null, controls: null,
  clock: null, raycaster: null, pointer: null,
  pickables: [],        // אובייקטים שאפשר ללחוץ עליהם (סוסים)
  clouds: [],
  particles: [],
  texLoader: null,
  _emojiTex: {},

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // אניזוטרופיה מקסימלית — מחדד טקסטורות בזווית המצלמה הנטויה (במקום 4 קבוע)
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
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
    this.controls.minDistance = 10;
    this.controls.maxDistance = 40;
    this.controls.minPolarAngle = 0.5;
    this.controls.maxPolarAngle = 1.45;   // לא לרדת מתחת לקרקע
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.update();

    this._sky();
    this._lights();
    this._ground();
    this._fence();
    this._sun();
    this._environment();
    this._initWeather();

    window.addEventListener('resize', () => this.resize());
    return this;
  },

  _sky() {
    // כיפת שמיים עם מעבר צבע רך
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#6db9ff');
    grad.addColorStop(0.5, '#a7d8ff');
    grad.addColorStop(1, '#e9f6ff');
    g.fillStyle = grad; g.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(200, 32, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
    );
    this.scene.add(sky);
    this.skyMesh = sky;
    this.scene.fog = new THREE.Fog(0xcfeaff, 75, 185);
    this.dayNight = true;
    this.tod = 0.35;          // התחלה בבוקר
  },

  _lights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x88aa66, 0.85);
    this.scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.05);
    sun.position.set(14, 24, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
    const s = 28;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.sunLight = sun;
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
    const mat = new THREE.MeshStandardMaterial({ color: 0x7ec850, roughness: 0.95, metalness: 0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

    // רצפות האזורים מתווספות ב-floorPatch (גינה/מגרש רכיבה) — המרכז נשאר דשא
  },

  _fence() {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xa9743b, roughness: 0.8 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xc79a5b, roughness: 0.8 });
    const R = 15, N = 28;
    const group = new THREE.Group();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 0.35), woodMat);
      post.position.set(x, 1.0, z);
      post.castShadow = true; post.receiveShadow = true;
      group.add(post);
      // קורה אופקית לעמוד הבא
      const a2 = ((i + 1) / N) * Math.PI * 2;
      const x2 = Math.cos(a2) * R, z2 = Math.sin(a2) * R;
      const mx = (x + x2) / 2, mz = (z + z2) / 2;
      const len = Math.hypot(x2 - x, z2 - z) + 0.1;
      const ang = Math.atan2(-(z2 - z), (x2 - x)); // יישור ציר ה-X של הקורה לאורך הכיוון לעמוד הבא
      for (const yy of [0.7, 1.5]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, 0.16), railMat);
        rail.position.set(mx, yy, mz);
        rail.rotation.y = ang;
        rail.castShadow = true;
        group.add(rail);
      }
    }
    this.scene.add(group);
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
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * 0.5 + 0.1;
      sp.push(Math.cos(a) * 80 * Math.cos(b), 30 + Math.random() * 45, Math.sin(a) * 80 * Math.cos(b));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0, fog: false }));
    this.scene.add(this.stars);
  },

  _environment() {
    // גבעות מתגלגלות מסביב (מעבר לגדר) — נותנות עומק לעולם
    const greens = [0x86d15a, 0x77c44c, 0x6fbf48];
    const hills = [
      [-36, -30, 16, 7], [32, -36, 19, 9], [44, 8, 15, 7], [-46, 12, 18, 9],
      [2, -48, 23, 11], [-22, 44, 16, 8], [26, 42, 17, 8], [50, -20, 16, 8], [-50, -18, 17, 9]
    ];
    hills.forEach(([x, z, r, h], i) => {
      const mat = new THREE.MeshStandardMaterial({ color: greens[i % 3], roughness: 1 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 14), mat);
      const sy = (h + 2) / (2 * r);
      dome.scale.set(1, sy, 1);
      dome.position.set(x, (h - 2) / 2, z);
      this.scene.add(dome);
    });
    // הרים רחוקים (צלליות כחלחלות שנמוגות בערפל)
    const mtMat = new THREE.MeshStandardMaterial({ color: 0xa9cfe6, roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const mt = new THREE.Mesh(new THREE.ConeGeometry(13 + (i % 3) * 4, 20 + (i % 4) * 6, 5), mtMat);
      mt.position.set(Math.cos(a) * 100, 6, Math.sin(a) * 100);
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
    return sp;
  },

  makeGroundShadow(radius = 1.6) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0,0,0,0.38)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius * 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
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
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.scale.set(w / 2, d / 2, 1);
    m.position.set(x, 0.1, z);
    this.scene.add(m);
    return m;
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
    const t = this.tod;
    const light = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 - Math.PI / 2);  // 0=חצות, 1=צהריים
    this.hemi.intensity = 0.22 + 0.7 * light;
    this.sunLight.intensity = 0.1 + 0.95 * light;
    // צבע שמיים: לילה כהה → יום בהיר, עם נגיעת זריחה/שקיעה
    const c = new THREE.Color(0x24305c).lerp(new THREE.Color(0xffffff), Math.min(1, light * 1.3));
    const duskAmt = Math.max(0, 1 - Math.abs(light - 0.4) * 4) * 0.45;
    c.lerp(new THREE.Color(0xff9d6e), duskAmt);
    this.skyMesh.material.color.copy(c);
    this.scene.fog.color.setHex(0x2b3a63).lerp(new THREE.Color(0xcfeaff), Math.min(1, light * 1.3));
    // מסלול שמש/ירח
    const a = t * Math.PI * 2 - Math.PI / 2;
    this.sunMesh.position.set(Math.cos(a) * 42, Math.sin(a) * 38, -30);
    this.sunHalo.position.copy(this.sunMesh.position);
    this.moonMesh.position.set(Math.cos(a + Math.PI) * 42, Math.sin(a + Math.PI) * 38, -30);
    const nightF = 1 - Math.min(1, light * 1.5);
    this.moonMesh.material.opacity = nightF;
    this.stars.material.opacity = nightF * 0.9;
    const sunUp = this.sunMesh.position.y > -2;
    this.sunMesh.visible = sunUp; this.sunHalo.visible = sunUp;
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

  // נסיעה חלקה למרכז אזור (עולם פתוח)
  travelTo(cx, cz) {
    this._travel = { x: cx, z: cz };
    this.controls.autoRotate = false;
  },
  _updateTravel(dt) {
    if (!this._travel) return;
    const T = this._travel, k = Math.min(1, dt * 2.0);
    const tgt = this.controls.target;
    tgt.x += (T.x - tgt.x) * k;
    tgt.z += (T.z - tgt.z) * k;
    if (Math.hypot(tgt.x - T.x, tgt.z - T.z) < 0.5) { this._travel = null; this.controls.autoRotate = true; }
  },

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this._updateTravel(dt);
    this.controls.update();
    this._updateDayNight(dt);
    this._updateWeather(dt);

    // עננים נעים
    for (const cl of this.clouds) {
      cl.position.x += dt * 0.5;
      if (cl.position.x > 60) cl.position.x = -60;
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
    return dt;
  },

  render() { this.renderer.render(this.scene, this.camera); },

  setDayNight(on) {
    this.dayNight = on;
    if (!on) {     // קיבוע ליום בהיר
      this.tod = 0.35;
      this.skyMesh.material.color.setHex(0xffffff);
      this.scene.fog.color.setHex(0xcfeaff);
      this.hemi.intensity = 0.85; this.sunLight.intensity = 1.05;
      this.moonMesh.material.opacity = 0; this.stars.material.opacity = 0;
      this.sunMesh.position.set(-22, 30, -30); this.sunHalo.position.copy(this.sunMesh.position);
      this.sunMesh.visible = true; this.sunHalo.visible = true;
    }
  },

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
};

export { World, THREE };
