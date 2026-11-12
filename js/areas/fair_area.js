// fair_area.js — אזור "🎪 יריד השעשועים": לונה-פארק צבעוני עם גלגל-ענק מסתובב,
// קרוסלת סוסים, ודוכני משחק (בלונים, קליעה, סוכריות). כל פעולה פותחת תרגיל חשבון.
// כל המיקומים יחסיים ל-deps.center, כך שהאזור יושב בכל מקום שבו ממקמים אותו.
// חשוב (ראה hindsight): לא משתמשים ב-sprite.rotation (מקפיא) — הכל תנועת-מיקום/scale.

export function buildFair(deps) {
  const {
    THREE, World, center, decor, activity, onUpdate, Animals, Props,
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

  // 3) הלנדמרק: גלגל ענק תלת-ממדי שמסתובב באמת (props3d.js), התאים נשארים זקופים
  const wheel = Props.ferrisWheel({ r: 4.3, hubY: 6, cabins: 8 });
  wheel.position.set(C.x, 0, C.z - 8);
  World.scene.add(wheel);
  Props.onTap(World, wheel, () => rideWheel());               // לחיצה על הגלגל = רכיבה

  // 4) קרוסלת סוסים תלת-ממדית: גג פסים, שישה סוסים שעולים ויורדים
  const carX = C.x + 10, carZ = C.z + 3;
  const carousel = Props.carousel({ r: 2.2, horses: 6 });
  carousel.position.set(carX, 0, carZ);
  World.scene.add(carousel);
  Props.onTap(World, carousel, () => rideCarousel());

  // 5) דוכן בלונים — לחיצה מפוצצת בלון וזוכה במטבעות
  const balX = C.x - 9, balZ = C.z + 2;
  const balloonStand = decor('assets/balloons.png', balX, balZ, 3.4);
  const balMarker = Props.balloon(0xff5d73, 1.2);
  balMarker.position.set(balX, 3.9, balZ);
  World.scene.add(balMarker);
  activity(balloonStand, () => popBalloons(balX, balZ));

  // 6) דוכן קליעה למטרה — 🎯 על ספסל
  const dartX = C.x - 8, dartZ = C.z - 6;
  decor('assets/bench.png', dartX, dartZ, 1.8);
  const target = Props.dartboard();
  target.position.set(dartX, 2.5, dartZ + 0.6);
  World.scene.add(target);
  Props.onTap(World, target, () => playDarts(dartX, dartZ));

  // 7) דוכן סוכריות/צמר-גפן מתוק — 🍭
  const treatX = C.x + 8, treatZ = C.z - 6;
  decor('assets/bakery.png', treatX, treatZ, 3);
  const candy = Props.lollipop();
  candy.position.set(treatX + 2.4, 2.1, treatZ + 1.2);
  World.scene.add(candy);
  Props.onTap(World, candy, () => buyTreat(treatX, treatZ));

  // 8) קישוט: פנסים, ספסלים, מזרקה, ובלונים פזורים
  decor('assets/fountain.png', C.x, C.z + 3, 3.2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    decor('assets/lamp_post.png', C.x + Math.cos(a) * 13, C.z + Math.sin(a) * 13, 3.4);
  }
  decor('assets/bench.png', C.x + 4, C.z + 9, 1.8);
  decor('assets/bench.png', C.x - 4, C.z + 9, 1.8);

  // 9) שרשרת בלונים מרחפת מעל השלט (קשת עדינה שמתנדנדת)
  const bunting = [];
  for (let i = 0; i < 5; i++) {
    const b = Props.balloon(Props.BRIGHT[i], 0.95);
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
      const gain = deps.payout(14, res);
      spawnAt(C.x, C.z, 'star', 14);
      Audio.fanfare();
      UI.toast('🎡 טסת בגלגל הענק! +' + gain + ' 🪙', true);
      grantReward({ x: C.x, y: 3, z: C.z }, res);
      saveAll();
    });
  }
  function rideCarousel() {
    askProblem('ride', res => {
      const gain = deps.payout(12, res);
      spawnAt(carX, carZ, 'music', 12);
      Audio.coin();
      UI.toast('🎠 רכבת על הקרוסלה! +' + gain + ' 🪙', true);
      grantReward({ x: carX, y: 2, z: carZ }, res);
      saveAll();
    });
  }
  function popBalloons(x, z) {
    askProblem('game', res => {
      const gain = deps.payout(11, res);
      spawnAt(x, z, 'confetti', 14);
      Audio.pop();
      UI.toast('🎈 פוצצת בלונים! +' + gain + ' 🪙', false);
      grantReward({ x, y: 2, z }, res);
      saveAll();
    });
  }
  function playDarts(x, z) {
    askProblem('game', res => {
      const gain = deps.payout(13, res);
      spawnAt(x, z, 'star', 12);
      Audio.coin();
      UI.toast('🎯 קלעת בול! +' + gain + ' 🪙', false);
      grantReward({ x, y: 2, z }, res);
      saveAll();
    });
  }
  function buyTreat(x, z) {
    askProblem('treat', res => {
      const gain = deps.payout(10, res);
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
      wheel.userData.update(t);
      carousel.userData.update(t);
      // בלונים מרחפים
      for (const b of bunting) {
        b.s.position.y = b.baseY + Math.sin(t * 1.3 + b.ph) * 0.35;
      }
      balMarker.position.y = 3.9 + Math.sin(t * 1.6) * 0.25;
    });
  }
}
