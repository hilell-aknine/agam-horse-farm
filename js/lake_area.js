// lake_area.js — אזור "🏖️ האגם": מים כחולים, מזח עץ, סירה, קנים, ברווזים ופעילויות
// חלק מהעולם הפתוח של חוות הסוסים. נבנה סביב deps.center הרחק מהחווה במרכז.

export function buildLake(deps) {
  const { THREE, World, center } = deps;
  const cx = center.x, cz = center.z;

  // עוזר קטן: מספר אקראי בטווח
  const rand = (min, max) => min + Math.random() * (max - min);

  // 1) טלאי מים גדול וכחול — שומרים הפניה כדי שנוכל לאדווה אותו בהמשך
  const water = World.floorPatch(cx, cz, 28, 22, 0x4aa3e0);

  // ===== 2) ציון דרך: מזח עץ קטן יוצא אל תוך המים + סירה ששטה =====
  // קרשי המזח חומים. המזח יוצא מהחוף הקדמי (z גדול) פנימה אל המים.
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.95 });

  // לוח המזח הראשי — ארוך וצר, מונח מעט מעל המים
  const dockZ = cz + 7; // נקודת ההתחלה בקצה החוף
  const deckGeo = new THREE.BoxGeometry(2, 0.3, 8);
  const deck = new THREE.Mesh(deckGeo, plankMat);
  deck.position.set(cx, 0.45, dockZ - 3); // נמתח פנימה אל מרכז המים
  World.scene.add(deck);

  // עמודי תמיכה קטנים מתחת למזח (4 רגליים)
  const postGeo = new THREE.BoxGeometry(0.3, 1.0, 0.3);
  const postOffsets = [
    { x: cx - 0.8, z: dockZ },
    { x: cx + 0.8, z: dockZ },
    { x: cx - 0.8, z: dockZ - 6 },
    { x: cx + 0.8, z: dockZ - 6 },
  ];
  for (const p of postOffsets) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(p.x, 0.0, p.z);
    World.scene.add(post);
  }

  // סירה קטנה ⛵ ששטה על המים ליד קצה המזח
  const boat = World.emojiSprite('⛵', 2.2);
  boat.center.set(0.5, 0.0); // עיגון מרכז-תחתון
  const boatBaseY = 0.7;
  const boatX = cx + 4, boatZ = cz - 2;
  boat.position.set(boatX, boatBaseY, boatZ);
  World.scene.add(boat);

  // עוזר: פיזור קישוט בטבעת סביב המים (רדיוס ~11..17, לא על המים)
  function ringDecor(url, height, withShadow) {
    const ang = rand(0, Math.PI * 2);
    const r = rand(11, 17);
    const x = cx + Math.cos(ang) * r;
    // האגם רחב יותר מאשר עמוק, אז מצמצמים מעט בציר z כדי לעטוף את האליפסה
    const z = cz + Math.sin(ang) * r * 0.85;
    deps.decor(url, x, z, height, withShadow);
  }

  // ===== 3) חוף צפוף: צמחייה, פרחים, סלעים ועצים מסביב למים =====
  // ~10 צרורות עשב/קנים
  for (let i = 0; i < 10; i++) ringDecor('assets/grass_tuft.png', rand(0.9, 1.4), false);
  // ~8 פרחים (פראיים + שיח פרחים)
  for (let i = 0; i < 8; i++) {
    const url = Math.random() < 0.5 ? 'assets/flowers_wild.png' : 'assets/flower_bush.png';
    ringDecor(url, rand(1.0, 1.5), true);
  }
  // ~5 סלעים
  for (let i = 0; i < 5; i++) ringDecor('assets/rock.png', rand(0.8, 1.3), true);
  // ~5 עצים
  for (let i = 0; i < 5; i++) ringDecor('assets/tree.png', rand(3.0, 4.2), true);

  // 4) שלט "האגם" בקצה הקדמי של המים
  const sign = World.makeSign('🏖️ האגם');
  sign.position.set(cx, 0, cz + 16);
  World.scene.add(sign);

  // ===== 5) חיות בר: שלושה ברווזים ששוטטים ליד המים ועליהם =====
  deps.Animals.add({ type: 'duck', asset: 'assets/duck.png', scale: 1.1, region: { x: cx, z: cz, r: 9 } });
  deps.Animals.add({ type: 'duck', asset: 'assets/duck.png', scale: 1.0, region: { x: cx, z: cz, r: 9 } });
  deps.Animals.add({ type: 'duck', asset: 'assets/duck.png', scale: 1.2, region: { x: cx, z: cz, r: 9 } });

  // ===== 6a) פעילות דיג — פותחת בעיית חשבון; פתרון נכון = דג + מטבעות =====
  function fish(x, z) {
    deps.askProblem('harvest', res => {
      const gain = 14 + deps.Game.level;
      deps.Game.coins += gain;
      deps.spawnAt(x, z, 'water', 12);
      deps.Audio.coin();
      deps.UI.toast('🐟 תפסת דג! +' + gain + ' 🪙', true);
      deps.grantReward({ x, y: 1.5, z }, res);
      deps.saveAll();
    });
  }

  // שלוש נקודות דיג לחיצות 🎣 על פני המים — שומרים הפניות כדי לנענע אותן
  const fishMarkers = [];
  const spots = [
    { x: cx - 6, z: cz - 3 },
    { x: cx + 5, z: cz + 2 },
    { x: cx + 1, z: cz - 5 },
  ];
  for (const s of spots) {
    const marker = World.emojiSprite('🎣', 1.6);
    marker.center.set(0.5, 0.0);           // עיגון מרכז-תחתון
    const baseY = 0.6;
    marker.position.set(s.x, baseY, s.z);
    World.scene.add(marker);
    deps.activity(marker, () => fish(s.x, s.z));
    fishMarkers.push({ marker, baseY, phase: rand(0, Math.PI * 2) });
  }

  // ===== 6b) האכלת הברווזים — מרקר 🦆 ליד החוף; פתרון נכון = מטבעות =====
  const duckX = cx - 5, duckZ = cz + 6;
  const duckMarker = World.emojiSprite('🦆', 1.8);
  duckMarker.center.set(0.5, 0.0);
  duckMarker.position.set(duckX, 0.6, duckZ);
  World.scene.add(duckMarker);
  deps.activity(duckMarker, () => {
    deps.askProblem('feed', res => {
      const gain = 10 + deps.Game.level;
      deps.Game.coins += gain;
      deps.spawnAt(duckX, duckZ, 'water', 8);
      deps.Audio.coin();
      deps.UI.toast('🦆 האכלת את הברווזים! +' + gain + ' 🪙', true);
      deps.grantReward({ x: duckX, y: 1.5, z: duckZ }, res);
      deps.saveAll();
    });
  });

  // ===== 7) אנימציית רקע עדינה: אדוות מים, נדנוד סירה ומרקרי דיג =====
  deps.onUpdate((t, dt) => {
    // אדווה עדינה: פעימת קנה-מידה קלה של טלאי המים
    if (water && water.scale) {
      const ripple = 1 + Math.sin(t * 1.2) * 0.012;
      water.scale.x = ripple;
      water.scale.z = 1 + Math.cos(t * 1.0) * 0.012;
    }
    // הסירה עולה ויורדת בעדינות עם הגלים
    if (boat) boat.position.y = boatBaseY + Math.sin(t * 1.5) * 0.12;
    // מרקרי הדיג מתנדנדים מעט כל אחד בקצב שלו
    for (const fm of fishMarkers) {
      fm.marker.position.y = fm.baseY + Math.sin(t * 2.0 + fm.phase) * 0.08;
    }
  });
}
