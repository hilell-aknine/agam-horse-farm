// quality.js — דרגות איכות גרפית (low / mid / high) + מדידת FPS + כלי דיבוג.
// כל אפקט כבד שואל את Quality.tier, כך שטלפון חלש מקבל משחק חלק וטלפון חזק מקבל משחק יפה.
// פרמטרים ב-URL (לדיבוג ולצילומי לפני/אחרי):
//   ?q=low|mid|high  קיבוע דרגה (מבטל את ההורדה האוטומטית)
//   ?fps=1           מד FPS וספירת ציורים בפינה
//   ?seed=7          פיזור אקראי קבוע (אותם עצים באותו מקום בכל טעינה)

const P = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();

// זרע קבוע: מחליף את Math.random במחולל דטרמיניסטי. רק כשמבקשים במפורש.
(() => {
  const s = parseInt(P.get('seed'), 10);
  if (!s) return;
  let a = s >>> 0;
  Math.random = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

const ORDER = ['low', 'mid', 'high'];
const KEY = 'agam_gfx_tier';

const Quality = {
  tier: 'mid',
  forced: false,           // ?q= קיבע דרגה: בלי הורדה אוטומטית
  fps: 60,
  debug: P.get('fps') === '1',
  _listeners: [],
  _acc: 0, _frames: 0, _lowFor: 0, _warm: 10,

  init() {
    const q = P.get('q');
    if (ORDER.includes(q)) { this.tier = q; this.forced = true; return this; }
    this.tier = this._detect();
    // דרגה שכבר הורדה במכשיר הזה בגלל קצב נמוך נשמרת, כדי שלא נתחיל כל פעם מגבוה ונגמגם
    try { const saved = localStorage.getItem(KEY); if (ORDER.includes(saved) && this.rank(saved) < this.rank(this.tier)) this.tier = saved; } catch (e) {}
    return this;
  },

  _detect() {
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const touch = (typeof matchMedia === 'function') && matchMedia('(pointer: coarse)').matches;
    if (mem <= 2 || cores <= 4 && touch) return 'low';
    if (!touch && cores >= 8 && mem >= 8) return 'high';
    return 'mid';
  },

  rank(t) { return ORDER.indexOf(t || this.tier); },
  atLeast(t) { return this.rank() >= this.rank(t); },
  // בחירת ערך לפי דרגה: Quality.pick(lowVal, midVal, highVal)
  pick(low, mid, high) { return this.tier === 'low' ? low : this.tier === 'mid' ? mid : high; },
  onChange(fn) { this._listeners.push(fn); },

  set(t, persist) {
    if (!ORDER.includes(t) || t === this.tier) return;
    this.tier = t;
    if (persist) { try { localStorage.setItem(KEY, t); } catch (e) {} }
    this._listeners.forEach(fn => { try { fn(t); } catch (e) { console.warn('[quality]', e); } });
  },

  // נקרא פעם בפריים עם dt אמיתי (לא חתוך). מוריד דרגה אחת אם הקצב נמוך 5 שניות ברצף.
  tick(dt, renderer) {
    this._acc += dt; this._frames++;
    if (this._acc < 1) return;
    this.fps = this._frames / this._acc;
    const sec = this._acc;
    this._acc = 0; this._frames = 0;
    if (this.debug) this._hud(renderer);
    if (this.forced || document.hidden) { this._lowFor = 0; return; }
    if (this._warm > 0) { this._warm -= sec; return; }     // טעינת מודלים בהתחלה לא נחשבת
    if (this.fps < 40) this._lowFor += sec; else this._lowFor = 0;
    if (this._lowFor >= 5 && this.rank() > 0) {
      this._lowFor = 0; this._warm = 10;                    // זמן התאוששות לפני מדידה חדשה
      this.set(ORDER[this.rank() - 1], true);
    }
  },

  _hud(renderer) {
    if (!this._el) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;background:rgba(0,0,0,.72);color:#9f9;font:12px/1.35 monospace;padding:5px 8px;border-radius:8px;pointer-events:none;direction:ltr;text-align:left;white-space:pre';
      document.body.appendChild(el);
      this._el = el;
    }
    const r = renderer && renderer.info ? renderer.info.render : null;
    this._el.textContent = `${this.fps.toFixed(0)} fps · ${this.tier}${this.forced ? '*' : ''}` + (r ? `\n${r.calls} calls · ${(r.triangles / 1000).toFixed(0)}k tris` : '');
  }
};

Quality.init();

export { Quality, P as PARAMS };
