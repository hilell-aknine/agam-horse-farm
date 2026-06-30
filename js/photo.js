// מצב צילום - מצלם את החווה התלת-ממדית ומאפשר להורדה (מודול עצמאי, ES module)
// בנוי לילדה בת 6: עברית, RTL, כפתורים גדולים, מסגרת תמונה חמודה

let cssInjected = false;

// מזריקים את ה-CSS פעם אחת בלבד
function injectCss() {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .photo-frame {
      background: #fff;
      padding: 14px 14px 40px 14px;
      border-radius: 10px;
      box-shadow: 0 14px 40px rgba(0,0,0,0.35);
      transform: rotate(-2deg);
      border: 3px solid #fff;
      display: inline-block;
      max-width: 100%;
    }
    .photo-frame img {
      display: block;
      width: 100%;
      max-width: 460px;
      height: auto;
      border-radius: 6px;
      border: 1px solid #eee;
    }
    .photo-caption {
      margin-top: 12px;
      font-size: 22px;
      color: #444;
      text-align: center;
    }
    .photo-actions {
      display: flex;
      gap: 14px;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .photo-save {
      background: #34c759;
      color: #fff;
    }
  `;
  document.head.appendChild(style);
}

export function createPhoto(deps) {
  injectCss();
  const { root, World, Audio, UI } = deps;

  function take() {
    let dataUrl = null;
    try {
      // א. מסתירים את ממשק המשחק כדי שלא ייכנס לתמונה
      root.style.visibility = 'hidden';
      // ב. רינדור פריים טרי
      World.render();
      // ג. צילום הקנבס לתמונת PNG
      dataUrl = World.renderer.domElement.toDataURL('image/png');
    } catch (err) {
      // ב. כישלון - מחזירים את הממשק ומודיעים בעדינות
      root.style.visibility = 'visible';
      UI.toast('לא הצלחתי לצלם, נסי שוב', true);
      return;
    } finally {
      // ד. תמיד מחזירים את הממשק
      root.style.visibility = 'visible';
    }

    // ה. מציגים את התמונה במסך עם מסגרת חמודה
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.dir = 'rtl';

    const card = document.createElement('div');
    card.className = 'card';
    card.dir = 'rtl';

    const title = document.createElement('h2');
    title.textContent = '📸 התמונה שלך!';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.textContent = '✖';

    const frame = document.createElement('div');
    frame.className = 'photo-frame';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'התמונה של החווה';
    frame.appendChild(img);

    const caption = document.createElement('div');
    caption.className = 'photo-caption';
    caption.textContent = 'החווה היפה של אגם 🐴';

    const actions = document.createElement('div');
    actions.className = 'photo-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-big photo-save';
    saveBtn.textContent = '💾 שמרי תמונה';

    actions.appendChild(saveBtn);

    card.appendChild(closeBtn);
    card.appendChild(title);
    card.appendChild(frame);
    card.appendChild(caption);
    card.appendChild(actions);
    overlay.appendChild(card);
    root.appendChild(overlay);

    function closeOverlay() {
      Audio.click();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    // לחיצה על הרקע סוגרת
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });
    closeBtn.addEventListener('click', closeOverlay);

    // ו. כפתור ההורדה: יוצרים <a> זמני ומורידים
    saveBtn.addEventListener('click', () => {
      Audio.click();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'החווה-של-אגם.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      Audio.fanfare();
      UI.toast('📸 התמונה נשמרה!', true);
    });

    // ז. מדברים עם פתיחת התמונה
    Audio.speak('צילמתי את החווה היפה שלך!');
  }

  return { take };
}
