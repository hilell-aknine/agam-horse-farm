// village_area.js — אזור "🏘️ הכפר" בעולם הפתוח של חוות אגם
// נבנה סביב deps.center (בערך (-72, 0)), עם כיכר עיר חיה: מבנים, פנסים, ספסלים,
// שלוש פעילויות מתמטיקה (אופה, ווטרינר, דוכן שוק), חיות מסתובבות ואווירה מונפשת.
// כל הקואורדינטות יחסיות למרכז: center.x+dx, center.z+dz.

export function buildVillage(deps) {
  const { THREE, World, center } = deps;

  // ───────────────────────────────────────────────
  // 1. רחבת הכפר — כתם אדמה חום-בהיר רך + כתמים כהים קטנים לתחושת מרצפות
  // ───────────────────────────────────────────────
  World.floorPatch(center.x, center.z, 26, 22, 0xcaa46a);
  // כמה מרצפות כהות יותר פזורות כדי שהכיכר תיראה מרוצפת ולא שטוחה
  World.floorPatch(center.x - 5, center.z + 3, 6, 5, 0xb8915a);
  World.floorPatch(center.x + 6, center.z - 2, 5, 6, 0xb8915a);
  World.floorPatch(center.x + 2, center.z + 6, 5, 4, 0xbf9a60);

  // ───────────────────────────────────────────────
  // 2. ציון דרך מרכזי — המזרקה בלב הכיכר
  // ───────────────────────────────────────────────
  const fountain = deps.decor('assets/fountain.png', center.x, center.z - 1, 4);

  // ───────────────────────────────────────────────
  // 3. כפר צפוף — מבנים סביב הכיכר
  // ───────────────────────────────────────────────
  // המאפייה (משמאל-מאחור) — כאן עובד האופה
  deps.decor('assets/bakery.png', center.x - 7, center.z - 6, 7);
  // שלוש בקתות מגורים סביב הכיכר
  const roofCottage = deps.decor('assets/cottage.png', center.x + 8, center.z - 7, 6);
  deps.decor('assets/cottage.png', center.x + 10, center.z + 4, 6);
  deps.decor('assets/cottage.png', center.x - 11, center.z + 2, 6);
  // באר מים ליד הבקתות
  deps.decor('assets/well.png', center.x + 7, center.z + 8, 2.4, true);

  // פנסים שמסמנים שביל לאורך הכיכר (~4)
  deps.decor('assets/lamp_post.png', center.x - 10, center.z - 2, 4);
  deps.decor('assets/lamp_post.png', center.x - 3, center.z - 9, 4);
  deps.decor('assets/lamp_post.png', center.x + 4, center.z - 9, 4);
  deps.decor('assets/lamp_post.png', center.x + 11, center.z - 1, 4);

  // ספסלים לשבת (~3)
  deps.decor('assets/bench.png', center.x - 9, center.z + 6, 1.6);
  deps.decor('assets/bench.png', center.x + 3, center.z + 8, 1.6);
  deps.decor('assets/bench.png', center.x - 2, center.z + 6, 1.6);

  // שיחי פרחים צבעוניים (~6)
  deps.decor('assets/flower_bush.png', center.x - 4, center.z + 5, 1.2, true);
  deps.decor('assets/flower_bush.png', center.x + 4, center.z - 4, 1.2, true);
  deps.decor('assets/flower_bush.png', center.x - 8, center.z - 8, 1.2, true);
  deps.decor('assets/flower_bush.png', center.x + 6, center.z + 5, 1.2, true);
  deps.decor('assets/flower_bush.png', center.x - 6, center.z + 9, 1.2, true);
  deps.decor('assets/flower_bush.png', center.x + 9, center.z + 1, 1.2, true);

  // עצים בשולי הכיכר (~5)
  deps.decor('assets/tree.png', center.x - 12, center.z + 9, 6, true);
  deps.decor('assets/tree.png', center.x + 12, center.z + 8, 6, true);
  deps.decor('assets/tree.png', center.x + 13, center.z - 8, 6, true);
  deps.decor('assets/tree.png', center.x - 13, center.z - 6, 6, true);
  deps.decor('assets/tree.png', center.x + 1, center.z - 12, 6, true);

  // סלעים קטנים פזורים
  deps.decor('assets/rock.png', center.x - 6, center.z + 9, 1.3, true);
  deps.decor('assets/rock.png', center.x + 6, center.z + 10, 1.3, true);
  deps.decor('assets/rock.png', center.x + 10, center.z - 4, 1.1, true);
  // קצת עשב לנוי
  deps.decor('assets/grass_tuft.png', center.x - 2, center.z + 8, 0.9);
  deps.decor('assets/grass_tuft.png', center.x + 1, center.z - 7, 0.9);
  // ערמת חציר ליד הבקתה
  deps.decor('assets/hay_bale.png', center.x + 11, center.z + 6, 1.6, true);

  // תמרור הכוונה ושלט הכפר
  deps.decor('assets/signpost.png', center.x - 4, center.z + 11, 2.6, true);
  const sign = World.makeSign('🏘️ הכפר');
  sign.position.set(center.x, 0, center.z + 13);
  World.scene.add(sign);

  // ───────────────────────────────────────────────
  // עוזר קטן: סמן 💬/🛒 מרחף מעל ראש הדמות כדי שילדה תבין שאפשר ללחוץ
  // הריחוף עצמו מנוהל ב-onUpdate למטה (רשימת markers)
  // ───────────────────────────────────────────────
  const bobbers = []; // כל סמן שצריך לרחף עדין מעלה-מטה
  function addMarker(emoji, x, z, y) {
    const marker = World.emojiSprite(emoji, 1.2);
    marker.position.set(x, y, z);
    World.scene.add(marker);
    bobbers.push({ sprite: marker, baseY: y, phase: Math.random() * Math.PI * 2 });
    return marker;
  }

  // ───────────────────────────────────────────────
  // 4א. NPC האופה — בואי נאפה לחם!
  // ───────────────────────────────────────────────
  const baker = deps.decor('assets/npc_baker.png', center.x - 7, center.z - 1, 4);
  function bake() {
    deps.Audio.speak('בואי נאפה לחם!');
    deps.askProblem('buy', res => {
      const g = 14 + deps.Game.level;
      deps.Game.coins += g;
      deps.spawnAt(center.x - 7, center.z - 1, 'star', 14);
      deps.Audio.coin();
      deps.UI.toast('🍞 אפית לחם! +' + g + ' 🪙', true);
      deps.grantReward({ x: center.x - 7, y: 2, z: center.z - 1 }, res);
      deps.saveAll();
    });
  }
  deps.activity(baker, () => bake());
  const bakerMarker = addMarker('💬', center.x - 7, center.z - 1, 4.6);
  deps.activity(bakerMarker, () => bake());

  // ───────────────────────────────────────────────
  // 4ב. NPC הווטרינר — עוזרים לחיה להרגיש טוב!
  // ───────────────────────────────────────────────
  const vet = deps.decor('assets/npc_vet.png', center.x + 5, center.z + 2, 4);
  function heal() {
    deps.Audio.speak('עוזרים לחיה להרגיש טוב!');
    deps.askProblem('brush', res => {
      const g = 12 + deps.Game.level;
      deps.Game.coins += g;
      deps.spawnAt(center.x + 5, center.z + 2, 'heart', 12);
      deps.Audio.coin();
      deps.UI.toast('💊 ריפאת חיה! +' + g + ' 🪙', true);
      deps.grantReward({ x: center.x + 5, y: 2, z: center.z + 2 }, res);
      deps.saveAll();
    });
  }
  deps.activity(vet, () => heal());
  const vetMarker = addMarker('💬', center.x + 5, center.z + 2, 4.6);
  deps.activity(vetMarker, () => heal());

  // ───────────────────────────────────────────────
  // 4ג. דוכן השוק — קונים מצרכים! (פעילות חדשה)
  // ───────────────────────────────────────────────
  const stall = deps.decor('assets/feed_sack.png', center.x - 1, center.z + 3, 2.4);
  function shop() {
    deps.Audio.speak('בואי נקנה בשוק!');
    deps.askProblem('buy', res => {
      const g = 13 + deps.Game.level;
      deps.Game.coins += g;
      deps.spawnAt(center.x - 1, center.z + 3, 'star', 13);
      deps.Audio.coin();
      deps.UI.toast('🛒 קנית בשוק! +' + g + ' 🪙', true);
      deps.grantReward({ x: center.x - 1, y: 2, z: center.z + 3 }, res);
      deps.saveAll();
    });
  }
  deps.activity(stall, () => shop());
  const stallMarker = addMarker('🛒', center.x - 1, center.z + 3, 3.0);
  deps.activity(stallMarker, () => shop());

  // ───────────────────────────────────────────────
  // 5. חיות הכפר — חתול, כלב ושתי תרנגולות שמסתובבות בכיכר
  // ───────────────────────────────────────────────
  const region = { x: center.x, z: center.z, r: 12 };
  deps.Animals.add({ type: 'cat', asset: 'assets/cat.png', scale: 1.0, region });
  deps.Animals.add({ type: 'dog', asset: 'assets/dog.png', scale: 1.2, region });
  deps.Animals.add({ type: 'chicken', asset: 'assets/chicken.png', scale: 0.8, region });
  deps.Animals.add({ type: 'chicken', asset: 'assets/chicken.png', scale: 0.8, region });

  // ───────────────────────────────────────────────
  // 6. אווירה מונפשת — עשן ארובה, ריחוף סמנים ונצנוץ מזרקה
  // ───────────────────────────────────────────────
  // עשן מהארובה: שני עננים אפורים שעולים מעל גג הבקתה ומתאפסים בלולאה
  const smokeBaseX = (roofCottage && roofCottage.position) ? roofCottage.position.x : center.x + 8;
  const smokeBaseZ = (roofCottage && roofCottage.position) ? roofCottage.position.z : center.z - 7;
  const smokeBaseY = 6.5; // מעל גג הבקתה
  const smokes = [];
  for (let i = 0; i < 2; i++) {
    const cloud = World.emojiSprite('☁️', 0.9);
    cloud.position.set(smokeBaseX, smokeBaseY, smokeBaseZ);
    World.scene.add(cloud);
    smokes.push({ sprite: cloud, offset: i * 1.6 }); // התחלה מדורגת בין שני העננים
  }

  // טיפת מים שמרחפת מעל המזרקה ופועמת בעדינות
  const droplet = World.emojiSprite('💧', 0.7);
  const fx = (fountain && fountain.position) ? fountain.position.x : center.x;
  const fz = (fountain && fountain.position) ? fountain.position.z : center.z - 1;
  droplet.position.set(fx, 4.4, fz);
  World.scene.add(droplet);

  deps.onUpdate((t, dt) => {
    // ריחוף עדין של כל סמני הדמויות (💬 / 🛒)
    for (const b of bobbers) {
      b.sprite.position.y = b.baseY + Math.sin(t * 2.5 + b.phase) * 0.18;
    }

    // עשן ארובה — עולה למעלה ודוהה, ואז מתאפס לתחתית (לולאה של ~3.2 שניות)
    for (const s of smokes) {
      const cycle = 3.2;
      const phase = ((t + s.offset) % cycle) / cycle; // 0..1
      s.sprite.position.y = smokeBaseY + phase * 4.5; // עולה
      s.sprite.position.x = smokeBaseX + Math.sin(phase * 4) * 0.4; // נע קלות הצידה
      if (s.sprite.material) s.sprite.material.opacity = 0.7 * (1 - phase); // דוהה
    }

    // נצנוץ/פעימה של טיפת המזרקה
    droplet.position.y = 4.4 + Math.sin(t * 3.5) * 0.25;
    const pulse = 0.6 + Math.sin(t * 3.5) * 0.12;
    droplet.scale.set(pulse, pulse, pulse);
  });
}
