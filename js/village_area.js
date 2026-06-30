// village_area.js — אזור "🏘️ הכפר" בעולם הפתוח של חוות אגם
// נבנה סביב deps.center (בערך (-72, 0)), עם מבנים ושתי דמויות NPC שנותנות פעילויות מתמטיקה.
// כל הקואורדינטות יחסיות למרכז: center.x+dx, center.z+dz.

export function buildVillage(deps) {
  const { THREE, World, center } = deps;

  // 1. רחבת הכפר — כתם אדמה חום-בהיר רך
  World.floorPatch(center.x, center.z, 24, 20, 0xcaa46a);

  // 2. מבנים
  // המאפייה (משמאל-מאחור)
  deps.decor('assets/bakery.png', center.x - 6, center.z - 6, 7);
  // שני בקתות מגורים
  deps.decor('assets/cottage.png', center.x + 7, center.z - 7, 6);
  deps.decor('assets/cottage.png', center.x + 9, center.z + 4, 6);
  // מזרקה במרכז הכיכר
  deps.decor('assets/fountain.png', center.x, center.z - 1, 3.6);

  // קישוטים מסביב לשוליים — ספסלים, פנסים, שיחי פרחים, עצים וסלעים
  deps.decor('assets/bench.png', center.x - 9, center.z + 6, 1.6);
  deps.decor('assets/bench.png', center.x + 3, center.z + 7, 1.6);
  deps.decor('assets/lamp_post.png', center.x - 10, center.z - 2, 4);
  deps.decor('assets/lamp_post.png', center.x + 10, center.z - 1, 4);
  deps.decor('assets/lamp_post.png', center.x + 2, center.z + 9, 4);
  deps.decor('assets/flower_bush.png', center.x - 4, center.z + 5, 1.2, true);
  deps.decor('assets/flower_bush.png', center.x + 4, center.z - 4, 1.2, true);
  deps.decor('assets/flower_bush.png', center.x - 8, center.z - 8, 1.2, true);
  deps.decor('assets/tree.png', center.x - 11, center.z + 9, 6, true);
  deps.decor('assets/tree.png', center.x + 11, center.z + 8, 6, true);
  deps.decor('assets/tree.png', center.x + 12, center.z - 8, 6, true);
  deps.decor('assets/rock.png', center.x - 6, center.z + 9, 1.3, true);
  deps.decor('assets/rock.png', center.x + 6, center.z + 9, 1.3, true);
  deps.decor('assets/grass_tuft.png', center.x - 2, center.z + 8, 0.9);
  deps.decor('assets/grass_tuft.png', center.x + 1, center.z - 7, 0.9);

  // 3. שלט הכפר
  const sign = World.makeSign('🏘️ הכפר');
  sign.position.set(center.x, 0, center.z + 13);
  World.scene.add(sign);

  // עוזר קטן: סמן 💬 מרחף מעל ראש הדמות כדי שילדה תבין שאפשר ללחוץ
  function addChatMarker(x, z, y) {
    const marker = World.emojiSprite('💬', 1.2);
    marker.position.set(x, y, z);
    World.scene.add(marker);
    // ריחוף עדין מעלה-מטה
    const baseY = y;
    const start = Date.now() + Math.random() * 1000;
    function bob() {
      marker.position.y = baseY + Math.sin((Date.now() - start) / 400) * 0.18;
      requestAnimationFrame(bob);
    }
    bob();
    return marker;
  }

  // 4. NPC האופה — בואי נאפה לחם!
  const baker = deps.decor('assets/npc_baker.png', center.x - 6, center.z - 1, 4);
  function bake() {
    deps.Audio.speak('בואי נאפה לחם!');
    deps.askProblem('buy', res => {
      const g = 14 + deps.Game.level;
      deps.Game.coins += g;
      deps.spawnAt(center.x - 6, center.z - 1, 'star', 14);
      deps.Audio.coin();
      deps.UI.toast('🍞 אפית לחם! +' + g + ' 🪙', true);
      deps.grantReward({ x: center.x - 6, y: 2, z: center.z - 1 }, res);
      deps.saveAll();
    });
  }
  deps.activity(baker, () => bake());
  // סמן צ'אט מעל ראש האופה (גם הוא ניתן ללחיצה)
  const bakerMarker = addChatMarker(center.x - 6, center.z - 1, 4.6);
  deps.activity(bakerMarker, () => bake());

  // 5. NPC הווטרינר — עוזרים לחיה להרגיש טוב!
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
  // סמן צ'אט מעל ראש הווטרינר
  const vetMarker = addChatMarker(center.x + 5, center.z + 2, 4.6);
  deps.activity(vetMarker, () => heal());
}
