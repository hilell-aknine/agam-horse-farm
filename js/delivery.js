// delivery.js — מיני-משחק "משלוח לשוק": עוזרים לעגלה להגיע לשוק דרך 4 שאלות חשבון
// מודול ES עצמאי. factory: createDelivery(deps) → { start() }

// הזרקת ה-CSS פעם אחת בלבד (מחלקות .deliv-*)
function injectCSS() {
  if (document.getElementById('deliv-style')) return;
  const css = `
  .deliv-bar{
    position:fixed; top:74px; left:50%; transform:translateX(-50%);
    z-index:35; pointer-events:none;
    width:min(560px,92vw); padding:12px 16px 14px;
    background:linear-gradient(180deg,#fff7e6,#ffe9c2);
    border:3px solid #e7a948; border-radius:22px;
    box-shadow:0 10px 28px rgba(120,72,0,.28);
    font-family:inherit; direction:rtl;
  }
  .deliv-title{
    text-align:center; font-weight:800; color:#7a4a00;
    font-size:17px; margin-bottom:8px;
  }
  .deliv-track{
    position:relative; direction:ltr; /* המסלול שמאל→ימין */
    height:54px; margin:4px 6px 2px;
    border-radius:30px;
    background:repeating-linear-gradient(90deg,#caa56b 0 22px,#bd9659 22px 30px);
    border:3px solid #9c7333;
    box-shadow:inset 0 3px 8px rgba(0,0,0,.18);
  }
  .deliv-dot{
    position:absolute; top:50%; transform:translate(-50%,-50%);
    width:13px; height:13px; border-radius:50%;
    background:#fff5db; border:2px solid #9c7333; opacity:.9;
  }
  .deliv-dot.done{ background:#7ad17a; border-color:#3d8f3d; }
  .deliv-cart{
    position:absolute; top:50%; transform:translate(-50%,-50%);
    font-size:34px; line-height:1;
    transition:left .75s cubic-bezier(.34,1.4,.5,1);
    filter:drop-shadow(0 3px 3px rgba(0,0,0,.35));
    will-change:left;
  }
  .deliv-market{
    position:absolute; top:50%; right:-6px; transform:translate(50%,-50%);
    font-size:32px; line-height:1;
    filter:drop-shadow(0 3px 3px rgba(0,0,0,.35));
  }
  .deliv-close{
    pointer-events:auto; cursor:pointer;
    position:absolute; top:-12px; left:-12px;
    width:30px; height:30px; border-radius:50%;
    border:2px solid #c0392b; background:#ff6b5e; color:#fff;
    font-weight:900; font-size:16px; line-height:26px; text-align:center;
    box-shadow:0 3px 8px rgba(0,0,0,.3);
  }
  .deliv-close:active{ transform:scale(.9); }
  `;
  const style = document.createElement('style');
  style.id = 'deliv-style';
  style.textContent = css;
  document.head.appendChild(style);
}

export function createDelivery(deps) {
  const { Game, Audio, UI } = deps;
  injectCSS();

  return {
    start() {
      const TOTAL = 4;            // 4 תחנות / 4 שאלות
      let solved = 0;            // כמה ענינו נכון עד עכשיו
      let alive = true;          // האם הריצה עדיין פעילה

      // --- בניית סרגל הכביש הקבוע ---
      const bar = document.createElement('div');
      bar.className = 'deliv-bar';

      const title = document.createElement('div');
      title.className = 'deliv-title';
      title.textContent = '🚚 משלוח לשוק 🏪';
      bar.appendChild(title);

      const track = document.createElement('div');
      track.className = 'deliv-track';

      // 4 תחנות במרווחים שווים לאורך המסלול
      const dots = [];
      for (let i = 0; i < TOTAL; i++) {
        const d = document.createElement('div');
        d.className = 'deliv-dot';
        d.style.left = stopLeft(i, TOTAL);
        track.appendChild(d);
        dots.push(d);
      }

      const market = document.createElement('div');
      market.className = 'deliv-market';
      market.textContent = '🏪';
      track.appendChild(market);

      const cart = document.createElement('div');
      cart.className = 'deliv-cart';
      cart.textContent = '🚚';
      cart.style.left = '6%'; // מתחילה בצד שמאל
      track.appendChild(cart);

      bar.appendChild(track);

      // כפתור ✖ — האלמנט היחיד עם pointer-events:auto; מבטל את הריצה ומנקה
      const close = document.createElement('div');
      close.className = 'deliv-close';
      close.textContent = '✖';
      close.title = 'ביטול';
      close.addEventListener('click', () => {
        if (!alive) return;
        alive = false;
        Audio.click();
        cleanup();
      });
      bar.appendChild(close);

      deps.root.appendChild(bar);

      function cleanup() {
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      }

      // מיקום אופקי של תחנה i (0..TOTAL-1) לאורך המסלול
      function stopLeft(i, total) {
        const pct = 12 + (i * (76 / (total - 1))); // בין 12% ל-88%
        return pct + '%';
      }

      Audio.speak('משלוח לשוק! עזרי לעגלה להגיע');

      // עידודים קצרים בדרך
      const cheers = ['יופי! ממשיכים', 'איזה כיף, עוד קצת', 'את אלופה!'];

      // שאלה הבאה ברצף
      function nextQuestion() {
        if (!alive) return;
        deps.askProblem('buy', (res) => {
          if (!alive) return;
          solved++;

          // סימון התחנה והזזת העגלה ימינה
          const idx = solved - 1;
          if (dots[idx]) dots[idx].classList.add('done');
          cart.style.left = stopLeft(idx, TOTAL);
          Audio.coin();

          if (solved < TOTAL) {
            // עידוד מדי פעם
            if (solved % 2 === 0) Audio.speak(cheers[(solved / 2 - 1) % cheers.length]);
            nextQuestion();
          } else {
            finish();
          }
        });
      }

      // סיום מוצלח — העגלה הגיעה לשוק
      function finish() {
        alive = false;
        cart.style.left = '94%'; // צמוד לשוק
        const prize = 35 + Game.level * 3;
        Game.coins += prize;
        Audio.fanfare();
        Audio.speak('הגעת לשוק! כל הכבוד');
        UI.toast('🏪 המשלוח הגיע! +' + prize + ' 🪙', true);
        UI.updateHUD(Game);
        deps.saveAll();
        // נותנים לאנימציה רגע להסתיים ואז מסירים את הסרגל
        setTimeout(cleanup, 900);
      }

      // יציאה לדרך
      nextQuestion();
    }
  };
}
