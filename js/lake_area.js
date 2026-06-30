// lake_area.js — אזור "🏖️ האגם": מים כחולים, קנים, ברווזים ופעילויות דיג
// חלק מהעולם הפתוח של חוות הסוסים. נבנה סביב deps.center הרחק מהחווה במרכז.

export function buildLake(deps) {
  const { THREE, World, center } = deps;
  const cx = center.x, cz = center.z;

  // עוזר קטן: מספר אקראי בטווח
  const rand = (min, max) => min + Math.random() * (max - min);

  // 1) טלאי מים גדול וכחול — floorPatch כבר מוסיף את עצמו לסצנה
  World.floorPatch(cx, cz, 26, 20, 0x4aa3e0);

  // עוזר: פיזור קישוט בטבעת סביב המים (רדיוס ~10..16, לא על המים)
  function ringDecor(url, height, withShadow) {
    const ang = rand(0, Math.PI * 2);
    const r = rand(10, 16);
    const x = cx + Math.cos(ang) * r;
    // האגם רחב יותר מאשר עמוק, אז מצמצמים מעט בציר z כדי לעטוף את האליפסה
    const z = cz + Math.sin(ang) * r * 0.85;
    deps.decor(url, x, z, height, withShadow);
  }

  // 2) טבעת צמחייה מסביב למים
  // ~8 צרורות עשב/קנים
  for (let i = 0; i < 8; i++) ringDecor('assets/grass_tuft.png', rand(0.9, 1.4), false);
  // ~6 פרחים (פראיים + שיח פרחים)
  for (let i = 0; i < 6; i++) {
    const url = Math.random() < 0.5 ? 'assets/flowers_wild.png' : 'assets/flower_bush.png';
    ringDecor(url, rand(1.0, 1.5), true);
  }
  // ~4 סלעים
  for (let i = 0; i < 4; i++) ringDecor('assets/rock.png', rand(0.8, 1.3), true);
  // ~4 עצים
  for (let i = 0; i < 4; i++) ringDecor('assets/tree.png', rand(3.0, 4.2), true);

  // 3) שלט "האגם" בקצה הקדמי של המים
  const sign = World.makeSign('🏖️ האגם');
  sign.position.set(cx, 0, cz + 14);
  World.scene.add(sign);

  // 4) שני ברווזים דקורטיביים ששטים במים (סטטיים)
  deps.decor('assets/duck.png', cx - 3, cz, 1.1, false);
  deps.decor('assets/duck.png', cx + 2.5, cz - 1.5, 1.1, false);

  // 6) פעולת הדיג — פותחת בעיית חשבון; פתרון נכון = דג + מטבעות
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

  // 5) שלוש נקודות דיג לחיצות 🎣 על פני המים
  const spots = [
    { x: cx - 6, z: cz - 3 },
    { x: cx + 5, z: cz + 2 },
    { x: cx + 1, z: cz - 5 },
  ];
  for (const s of spots) {
    const marker = World.emojiSprite('🎣', 1.6);
    marker.center.set(0.5, 0.0);           // עיגון מרכז-תחתון
    marker.position.set(s.x, 0.6, s.z);
    World.scene.add(marker);
    deps.activity(marker, () => fish(s.x, s.z));
  }
}
