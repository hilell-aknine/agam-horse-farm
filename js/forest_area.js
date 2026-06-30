// forest_area.js — אזור "🌲 היער": אשכול עצים, שיחים, סלעים ופרחים סביב מרכז נתון,
// עם שלושה שיחי-פירות שאפשר ללחוץ עליהם כדי לקטוף פירות יער (פעילות חשבון).
// כל המיקומים יחסיים ל-deps.center, כך שהאזור יושב בכל מקום שבו ממקמים אותו.

export function buildForest(deps) {
  const { THREE, World, center, decor, activity, askProblem, spawnAt, grantReward, Game, UI, Audio, saveAll } = deps;

  // עוזר קטן: מספר אקראי בטווח
  const rand = (min, max) => min + Math.random() * (max - min);

  // ממקם פרופ סביב המרכז לפי זווית ומרחק אקראיים (טבעת רדיוס ~3..16)
  function scatter(url, height, withShadow, minR, maxR) {
    const ang = rand(0, Math.PI * 2);
    const dist = rand(minR, maxR);
    const x = center.x + Math.cos(ang) * dist;
    const z = center.z + Math.sin(ang) * dist;
    return decor(url, x, z, height, withShadow);
  }

  // 1) תחושת יער ירוקה: עצים גדולים, שיחים, סלעים ופרחים פזורים
  // ~10 עצים אורן/אלון (גבוהים, עם צל)
  const treeAssets = ['assets/pine_tree.png', 'assets/oak_tree.png', 'assets/tree.png'];
  for (let i = 0; i < 10; i++) {
    const url = treeAssets[Math.floor(Math.random() * treeAssets.length)];
    scatter(url, rand(7, 8), true, 4, 16);
  }
  // ~6 שיחים (נמוכים, בלי צל)
  for (let i = 0; i < 6; i++) scatter('assets/bush.png', rand(1.6, 2.4), false, 3, 14);
  // ~5 סלעים (נמוכים, בלי צל)
  for (let i = 0; i < 5; i++) scatter('assets/rock.png', rand(1.2, 1.8), false, 3, 14);
  // ~8 אשכולות פרחי-בר / עשב (נמוכים, בלי צל)
  const smallAssets = ['assets/flowers_wild.png', 'assets/grass_tuft.png', 'assets/mushroom.png', 'assets/flower_bush.png'];
  for (let i = 0; i < 8; i++) {
    const url = smallAssets[Math.floor(Math.random() * smallAssets.length)];
    scatter(url, rand(1.2, 1.8), false, 3, 15);
  }

  // 2) שלט "🌲 היער" בקדמת האזור
  const sign = World.makeSign('🌲 היער');
  sign.position.set(center.x, 0, center.z + 14);
  World.scene.add(sign);

  // 3) שלושה שיחי-פירות שאפשר ללחוץ עליהם — כל אחד עם סמן 🫐 מעליו
  const berrySpots = [
    { x: center.x - 5, z: center.z + 2 },
    { x: center.x + 4, z: center.z - 1 },
    { x: center.x + 1, z: center.z + 6 },
  ];
  for (const spot of berrySpots) {
    // שיח הפירות עצמו
    const bush = decor('assets/bush.png', spot.x, spot.z, 2.6);
    // סמן אוכמניות קטן מעל השיח
    const marker = World.emojiSprite('🫐', 1.4);
    if (marker.center) marker.center.set(0.5, 0.0); // מרכז-תחתון
    marker.position.set(spot.x, 2.7, spot.z);
    World.scene.add(marker);
    // הופכים את השיח לפעילות לחיצה
    activity(bush, () => pickBerries(spot.x, spot.z));
  }

  // 4) קטיף פירות יער — פותח בעיית חשבון, ורק בפתרון נכון נותן פרס
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

  // 5) ללא השמעת קול אוטומטית בזמן הבנייה
}
