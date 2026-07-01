// fair_area.js — אזור "🎪 יריד השעשועים": לונה-פארק צבעוני עם גלגל-ענק מסתובב,
// קרוסלת סוסים, ודוכני משחק (בלונים, קליעה, סוכריות). כל פעולה פותחת תרגיל חשבון.
// כל המיקומים יחסיים ל-deps.center, כך שהאזור יושב בכל מקום שבו ממקמים אותו.
// חשוב (ראה hindsight): לא משתמשים ב-sprite.rotation (מקפיא) — הכל תנועת-מיקום/scale.

export function buildFair(deps) {
  const {
    THREE, World, center, decor, activity, onUpdate, Animals,
    askProblem, spawnAt, grantReward, Game, UI, Audio, saveAll,
  } = deps;

  const rand = (min, max) => min + Math.random() * (max - min);
  const C = center;

  // 1) קרקע חגיגית: כתם חול גדול + כמה עיגולי-צבע קטנים (מראה קונפטי על הרצפה)
  World.floorPatch(C.x, C.z, 34, 34, 0xf3d9b0);              // רחבת היריד
  const patchColors = [0xffc0cb, 0xbfe6c9, 0xbcd6f0, 0xffe08a, 0xe6c0f0];
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2), r = rand(4, 15);
    World.floorPatch(C.x + Math.cos(a) * r, C.z + Math.sin(a) * r, rand(3, 5), rand(3, 5),
      patchColors[i % patchColors.length]);
  }

  // 2) שלט האזור בקדמת היריד
  const sign = World.makeSign('🎪 יריד השעשועים');
  sign.position.set(C.x, 0, C.z + 15);
  World.scene.add(sign);

  // 3) הלנדמרק: גלגל-ענק מסתובב — מסגרת 🎡 סטטית + תאים נעים שמקיפים אותה במאונך
  const hubY = 6, wheelR = 4.3;
  const wheel = World.emojiSprite('🎡', 10);                  // מסגרת הגלגל
  wheel.position.set(C.x, hubY, C.z);
  World.scene.add(wheel);
  activity(wheel, () => rideWheel());                         // לחיצה על הגלגל = רכיבה
  const wheelBaseScale = wheel.scale.clone();

  const cabins = [];
  const cabinEmoji = ['🚠', '🚡', '🚠', '🚡', '🚠', '🚡'];
  for (let i = 0; i < 6; i++) {
    const cab = World.emojiSprite(cabinEmoji[i], 1.25);
    cab.position.set(C.x, hubY, C.z + 0.25);                  // מעט לפני המסגרת
    World.scene.add(cab);
    cabins.push({ s: cab, ph: (i / 6) * Math.PI * 2 });
  }

  // 4) קרוסלת סוסים — עמוד מרכזי + 4 סוסים שמסתובבים סביבו אופקית (עם קפיצת-דהירה)
  const carX = C.x + 10, carZ = C.z + 3, carR = 2.6;
  const carousel = World.emojiSprite('🎠', 3.6);
  carousel.position.set(carX, 2.2, carZ);
  World.scene.add(carousel);
  activity(carousel, () => rideCarousel());
  const seats = [];
  for (let i = 0; i < 4; i++) {
    const seat = World.emojiSprite('🐴', 1.3);
    seat.position.set(carX, 1.4, carZ);
    World.scene.add(seat);
    seats.push({ s: seat, ph: (i / 4) * Math.PI * 2 });
  }

  // 5) דוכן בלונים — לחיצה מפוצצת בלון וזוכה במטבעות
  const balX = C.x - 9, balZ = C.z + 2;
  const balloonStand = decor('assets/balloons.png', balX, balZ, 3.4);
  const balMarker = World.emojiSprite('🎈', 1.4);
  if (balMarker.center) balMarker.center.set(0.5, 0.0);
  balMarker.position.set(balX, 3.6, balZ);
  World.scene.add(balMarker);
  activity(balloonStand, () => popBalloons(balX, balZ));

  // 6) דוכן קליעה למטרה — 🎯 על ספסל
  const dartX = C.x - 8, dartZ = C.z - 6;
  decor('assets/bench.png', dartX, dartZ, 1.8);
  const target = World.emojiSprite('🎯', 2.2);
  target.position.set(dartX, 2.3, dartZ);
  World.scene.add(target);
  activity(target, () => playDarts(dartX, dartZ));

  // 7) דוכן סוכריות/צמר-גפן מתוק — 🍭
  const treatX = C.x + 8, treatZ = C.z - 6;
  decor('assets/bakery.png', treatX, treatZ, 3);
  const candy = World.emojiSprite('🍭', 2.2);
  candy.position.set(treatX, 2.4, treatZ);
  World.scene.add(candy);
  activity(candy, () => buyTreat(treatX, treatZ));

  // 8) קישוט: פנסים, ספסלים, מזרקה, ובלונים פזורים
  decor('assets/fountain.png', C.x, C.z - 4, 3.2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    decor('assets/lamp_post.png', C.x + Math.cos(a) * 13, C.z + Math.sin(a) * 13, 3.4);
  }
  decor('assets/bench.png', C.x + 4, C.z + 9, 1.8);
  decor('assets/bench.png', C.x - 4, C.z + 9, 1.8);

  // 9) שרשרת בלונים מרחפת מעל השלט (קשת עדינה שמתנדנדת)
  const bunting = [];
  const buntEmoji = ['🎈', '🎈', '🎈', '🎈', '🎈'];
  for (let i = 0; i < 5; i++) {
    const b = World.emojiSprite(buntEmoji[i], 1.1);
    const bx = C.x - 4 + i * 2;
    const by = 5 + Math.sin((i / 4) * Math.PI) * 1.2;        // קשת
    b.position.set(bx, by, C.z + 13);
    World.scene.add(b);
    bunting.push({ s: b, baseY: by, ph: rand(0, Math.PI * 2) });
  }

  // 10) חיות פסטיבל שמשוטטות ביריד
  if (Animals && Animals.add) {
    const region = { x: C.x, z: C.z, r: 12 };
    Animals.add({ type: 'dog', asset: 'dog.png', scale: 1.0, region });
    Animals.add({ type: 'cat', asset: 'cat.png', scale: 0.9, region });
  }

  // --- פעילויות (כל אחת פותחת תרגיל, ורק תשובה נכונה מתגמלת) ---
  function rideWheel() {
    askProblem('ride', res => {
      const gain = 14 + Game.level;
      Game.coins += gain;
      spawnAt(C.x, C.z, 'star', 14);
      Audio.fanfare();
      UI.toast('🎡 טסת בגלגל הענק! +' + gain + ' 🪙', true);
      grantReward({ x: C.x, y: 3, z: C.z }, res);
      saveAll();
    });
  }
  function rideCarousel() {
    askProblem('ride', res => {
      const gain = 12 + Game.level;
      Game.coins += gain;
      spawnAt(carX, carZ, 'music', 12);
      Audio.coin();
      UI.toast('🎠 רכבת על הקרוסלה! +' + gain + ' 🪙', true);
      grantReward({ x: carX, y: 2, z: carZ }, res);
      saveAll();
    });
  }
  function popBalloons(x, z) {
    askProblem('game', res => {
      const gain = 11 + Game.level;
      Game.coins += gain;
      spawnAt(x, z, 'confetti', 14);
      Audio.pop();
      UI.toast('🎈 פוצצת בלונים! +' + gain + ' 🪙', false);
      grantReward({ x, y: 2, z }, res);
      saveAll();
    });
  }
  function playDarts(x, z) {
    askProblem('game', res => {
      const gain = 13 + Game.level;
      Game.coins += gain;
      spawnAt(x, z, 'star', 12);
      Audio.coin();
      UI.toast('🎯 קלעת בול! +' + gain + ' 🪙', false);
      grantReward({ x, y: 2, z }, res);
      saveAll();
    });
  }
  function buyTreat(x, z) {
    askProblem('treat', res => {
      const gain = 10 + Game.level;
      Game.coins += gain;
      spawnAt(x, z, 'sparkle', 10);
      Audio.coin();
      UI.toast('🍭 קיבלת ממתק מתוק! +' + gain + ' 🪙', false);
      grantReward({ x, y: 2, z }, res);
      saveAll();
    });
  }

  // 11) אנימציה חיה — גלגל מסתובב, קרוסלה מסתובבת, בלונים מתנדנדים
  if (onUpdate) {
    onUpdate((t, dt) => {
      // גלגל-ענק: התאים מקיפים במאונך (שינוי מיקום בלבד — לא rotation)
      const wa = t * 0.5;
      for (const c of cabins) {
        const a = wa + c.ph;
        c.s.position.x = C.x + Math.cos(a) * wheelR;
        c.s.position.y = hubY + Math.sin(a) * wheelR;
      }
      // נשימת-מסגרת עדינה לגלגל
      const breathe = 1 + Math.sin(t * 0.9) * 0.015;
      wheel.scale.set(wheelBaseScale.x * breathe, wheelBaseScale.y * breathe, 1);
      // קרוסלה: הסוסים מסתובבים אופקית עם קפיצת-דהירה
      const ca = t * 0.8;
      for (const s of seats) {
        const a = ca + s.ph;
        s.s.position.x = carX + Math.cos(a) * carR;
        s.s.position.z = carZ + Math.sin(a) * carR;
        s.s.position.y = 1.4 + Math.abs(Math.sin(a * 2)) * 0.35;
      }
      // בלונים מרחפים
      for (const b of bunting) {
        b.s.position.y = b.baseY + Math.sin(t * 1.3 + b.ph) * 0.35;
      }
      balMarker.position.y = 3.6 + Math.sin(t * 1.6) * 0.25;
    });
  }
}
