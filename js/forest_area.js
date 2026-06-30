// forest_area.js — אזור "🌲 היער הקסום": יער עבות בשכבות סביב עץ-ענק עתיק במרכז,
// עם שלוש פעילויות קטיף (אוכמניות + פטריות), חיות בר נודדות וניצוצות זוהרים באוויר.
// כל המיקומים יחסיים ל-deps.center, כך שהאזור יושב בכל מקום שבו ממקמים אותו.

export function buildForest(deps) {
  const {
    THREE, World, center, decor, activity, onUpdate, Animals,
    askProblem, spawnAt, grantReward, Game, UI, Audio, saveAll,
  } = deps;

  // עוזר קטן: מספר אקראי בטווח
  const rand = (min, max) => min + Math.random() * (max - min);

  // ממקם פרופ בזווית אקראית ובמרחק אקראי מהמרכז (טבעת minR..maxR)
  function ring(url, height, withShadow, minR, maxR) {
    const ang = rand(0, Math.PI * 2);
    const dist = rand(minR, maxR);
    const x = center.x + Math.cos(ang) * dist;
    const z = center.z + Math.sin(ang) * dist;
    return decor(url, x, z, height, withShadow);
  }

  // 1) הלנדמרק: עץ-ענק עתיק בלב היער — גבוה במיוחד, עם צל גדול
  const giantTree = decor('assets/oak_tree.png', center.x, center.z - 3, 15, true);
  const giantBaseScale = giantTree.scale ? giantTree.scale.clone() : null; // לשמירת קנה-המידה לנשימה

  // 2) יער עבות בשתי שכבות: טבעת פנימית צפופה + טבעת חיצונית גבוהה
  const treeAssets = ['assets/pine_tree.png', 'assets/oak_tree.png', 'assets/tree.png'];
  // טבעת פנימית (רדיוס 5..12) — ~9 עצים
  for (let i = 0; i < 9; i++) {
    const url = treeAssets[Math.floor(Math.random() * treeAssets.length)];
    ring(url, rand(6, 9), true, 5, 12);
  }
  // טבעת חיצונית (רדיוס 13..22) — ~9 עצים, שמסגרים את היער
  for (let i = 0; i < 9; i++) {
    const url = treeAssets[Math.floor(Math.random() * treeAssets.length)];
    ring(url, rand(6, 9), true, 13, 22);
  }
  // ~10 שיחים נמוכים פזורים
  for (let i = 0; i < 10; i++) ring('assets/bush.png', rand(1.6, 2.4), false, 4, 20);
  // ~8 סלעים
  for (let i = 0; i < 8; i++) ring('assets/rock.png', rand(1.2, 1.9), false, 4, 20);
  // ~16 אשכולות פרחי-בר ועשב — שטיח רך על קרקעית היער
  const smallAssets = ['assets/flowers_wild.png', 'assets/grass_tuft.png', 'assets/flower_bush.png'];
  for (let i = 0; i < 16; i++) {
    const url = smallAssets[Math.floor(Math.random() * smallAssets.length)];
    ring(url, rand(1.0, 1.8), false, 3, 21);
  }

  // 3) שלט "🌲 היער הקסום" בקדמת האזור
  const sign = World.makeSign('🌲 היער הקסום');
  sign.position.set(center.x, 0, center.z + 14);
  World.scene.add(sign);

  // 4a) פעילות ראשונה: שלושה שיחי-אוכמניות שאפשר ללחוץ עליהם — סמן 🫐 מעל כל אחד
  const berrySpots = [
    { x: center.x - 5, z: center.z + 2 },
    { x: center.x + 4, z: center.z - 1 },
    { x: center.x + 1, z: center.z + 6 },
  ];
  for (const spot of berrySpots) {
    const bush = decor('assets/bush.png', spot.x, spot.z, 2.6); // שיח הפירות
    const marker = World.emojiSprite('🫐', 1.4); // סמן אוכמניות מעל השיח
    if (marker.center) marker.center.set(0.5, 0.0); // מרכז-תחתון
    marker.position.set(spot.x, 2.7, spot.z);
    World.scene.add(marker);
    activity(bush, () => pickBerries(spot.x, spot.z));
  }

  // 4b) פעילות שנייה: שלוש פטריות שאפשר לקטוף — כל פטרייה היא פעילות לחיצה
  const mushroomSpots = [
    { x: center.x - 7, z: center.z - 4 },
    { x: center.x + 6, z: center.z + 4 },
    { x: center.x - 2, z: center.z - 7 },
  ];
  for (const spot of mushroomSpots) {
    const mush = decor('assets/mushroom.png', spot.x, spot.z, 2.2); // פטרייה גדולה לקטיף
    activity(mush, () => pickMushrooms(spot.x, spot.z));
  }

  // 5) קטיף אוכמניות — פותח בעיית חשבון, ורק בפתרון נכון נותן פרס
  function pickBerries(x, z) {
    askProblem('harvest', res => {
      const gain = 12 + Game.level;
      Game.coins += gain;
      spawnAt(x, z, 'sparkle', 12);
      Audio.coin();
      UI.toast('🫐 קטפת פירות יער! +' + gain + ' 🪙', false);
      grantReward({ x, y: 2, z }, res);
      saveAll();
    });
  }

  // 6) קטיף פטריות — אותה מכניקה, פרס מעט שונה
  function pickMushrooms(x, z) {
    askProblem('harvest', res => {
      const gain = 10 + Game.level;
      Game.coins += gain;
      spawnAt(x, z, 'sparkle', 10);
      Audio.coin();
      UI.toast('🍄 קטפת פטריות! +' + gain + ' 🪙', false);
      grantReward({ x, y: 2, z }, res);
      saveAll();
    });
  }

  // 7) חיות בר נודדות ביער — ארנבים, צבי ושועל
  if (Animals && Animals.add) {
    const region = { x: center.x, z: center.z, r: 14 };
    Animals.add({ type: 'rabbit', asset: 'rabbit.png', scale: 0.9, region });
    Animals.add({ type: 'rabbit', asset: 'rabbit.png', scale: 0.9, region });
    Animals.add({ type: 'deer', asset: 'deer.png', scale: 1.2, region });
    Animals.add({ type: 'fox', asset: 'fox.png', scale: 1.0, region });
  }

  // 8) ניצוצות קסם זוהרים שמרחפים באוויר + נשימה עדינה של עץ-הענק
  const fireflies = [];
  for (let i = 0; i < 5; i++) {
    const spark = World.emojiSprite('✨', 0.8);
    const ang = rand(0, Math.PI * 2);
    const dist = rand(3, 8);
    const baseX = center.x + Math.cos(ang) * dist;
    const baseZ = center.z + Math.sin(ang) * dist;
    const baseY = rand(1.5, 4);
    spark.position.set(baseX, baseY, baseZ);
    World.scene.add(spark);
    // שומרים פאזה אקראית כדי שכל ניצוץ ירחף בקצב משלו
    fireflies.push({ s: spark, baseX, baseY, baseZ, ph: rand(0, Math.PI * 2), sp: rand(0.6, 1.2) });
  }

  if (onUpdate) {
    onUpdate((t, dt) => {
      // ריחוף עדין: כל ניצוץ עולה-יורד וזז קלות בצדדים
      for (const f of fireflies) {
        const a = t * f.sp + f.ph;
        f.s.position.y = f.baseY + Math.sin(a) * 0.5;
        f.s.position.x = f.baseX + Math.cos(a * 0.7) * 0.4;
        f.s.position.z = f.baseZ + Math.sin(a * 0.5) * 0.4;
      }
      // נשימה של עץ-הענק: התנפחות-התכווצות זעירה
      if (giantBaseScale && giantTree.scale) {
        const breathe = 1 + Math.sin(t * 0.8) * 0.02;
        giantTree.scale.set(giantBaseScale.x * breathe, giantBaseScale.y * breathe, giantBaseScale.z);
      }
    });
  }

  // 9) ללא השמעת קול אוטומטית בזמן הבנייה
}
