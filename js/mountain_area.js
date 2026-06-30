// mountain_area.js — אזור "🏔️ ההר": סלעים, מערה וכריית אבני חן
// חלק מהעולם הפתוח של חוות הסוסים. נבנה סביב deps.center הרחק מהחווה במרכז.
// נפתח ברמה גבוהה יותר, ולכן הפרס על כרייה גדול יותר.

export function buildMountain(deps) {
  const { THREE, World, center } = deps;
  const cx = center.x, cz = center.z;

  // עוזר קטן: מספר אקראי בטווח
  const rand = (min, max) => min + Math.random() * (max - min);

  // 1) טלאי קרקע סלעי ואפרפר — floorPatch כבר מוסיף את עצמו לסצנה
  World.floorPatch(cx, cz, 26, 22, 0x9a9a8f);

  // עוזר: פיזור קישוט בטבעת סביב בסיס ההר (רדיוס ~8..16)
  function ringDecor(url, height, withShadow) {
    const ang = rand(0, Math.PI * 2);
    const r = rand(8, 16);
    const x = cx + Math.cos(ang) * r;
    const z = cz + Math.sin(ang) * r;
    deps.decor(url, x, z, height, withShadow);
  }

  // 2) מערה גדולה בעומק האזור, ומסביבה סלעים ועצי אורן — מרגיש כמו בסיס הר
  deps.decor('assets/cave.png', cx, cz - 7, 9);

  // ~8 סלעים בגבהים שונים
  for (let i = 0; i < 8; i++) ringDecor('assets/rock.png', rand(1.5, 3.5), true);
  // ~4 עצי אורן
  for (let i = 0; i < 4; i++) ringDecor('assets/pine_tree.png', rand(3.0, 4.2), true);
  // כמה שיחים וצרורות עשב מסביב לקצוות
  for (let i = 0; i < 3; i++) ringDecor('assets/bush.png', rand(1.0, 1.5), true);
  for (let i = 0; i < 3; i++) ringDecor('assets/grass_tuft.png', rand(0.8, 1.3), false);

  // 3) שלט "ההר" בקצה הקדמי של האזור
  const sign = World.makeSign('🏔️ ההר');
  sign.position.set(cx, 0, cz + 14);
  World.scene.add(sign);

  // 5) כרייה — פותחת בעיית חשבון; פתרון נכון = אבן חן + הרבה מטבעות
  function mine(x, z) {
    deps.Audio.speak('כורים אבן חן!');
    deps.askProblem('harvest', res => {
      const gain = 18 + deps.Game.level * 2;
      deps.Game.coins += gain;
      deps.spawnAt(x, z, 'star', 16);
      deps.Audio.coin();
      deps.Audio.fanfare();
      deps.UI.toast('💎 כרית אבן חן! +' + gain + ' 🪙', true);
      deps.grantReward({ x, y: 2, z }, res);
      deps.saveAll();
    });
  }

  // 4) שלוש נקודות אבני חן לחיצות, ליד הסלעים, עם סמן ✨ שמרחף מעליהן
  const gems = [
    { x: cx - 6, z: cz - 2 },
    { x: cx + 5, z: cz + 1 },
    { x: cx + 1, z: cz - 5 },
  ];
  for (const p of gems) {
    // אבן החן עצמה — סְפְרייט לחיץ
    const g = deps.decor('assets/gem.png', p.x, p.z, 1.8, false);

    // סמן ✨ קטן שמרחף ומתנדנד מעל אבן החן
    const marker = World.emojiSprite('✨', 1.0);
    marker.center.set(0.5, 0.0);            // עיגון מרכז-תחתון
    marker.position.set(p.x, 2.4, p.z);
    World.scene.add(marker);
    // תנודה עדינה למעלה-למטה: מתנדנד מול הזמן דרך onBeforeRender (רץ בכל פריים)
    const baseY = marker.position.y;
    const phase = rand(0, Math.PI * 2);
    marker.onBeforeRender = () => {
      marker.position.y = baseY + Math.sin(performance.now() * 0.003 + phase) * 0.25;
    };

    // רישום אבן החן כפעילות לחיצה
    deps.activity(g, () => mine(p.x, p.z));
  }
}
