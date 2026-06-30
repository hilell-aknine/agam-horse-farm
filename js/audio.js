// audio.js — צלילים פרוצדורליים (WebAudio) + הקראה קולית בעברית (Web Speech)
// אין צורך בקבצי שמע חיצוניים. הכל נוצר בזמן אמת.

const Audio = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxOn: true,
  voiceOn: true,
  musicOn: true,
  heVoice: null,
  _musicTimer: null,

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.12;
      this.musicGain.connect(this.master);
    } catch (e) { /* no audio */ }
    this._loadVoice();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => this._loadVoice();
    }
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  _loadVoice() {
    if (!window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    this.heVoice = voices.find(v => /he|iw/i.test(v.lang)) || null;
  },

  _tone(freq, dur, type = 'sine', vol = 0.3, when = 0) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  click() { this._tone(420, 0.08, 'triangle', 0.18); },
  pop()   { this._tone(660, 0.1, 'sine', 0.2); this._tone(990, 0.12, 'sine', 0.12, 0.04); },
  coin()  { this._tone(880, 0.09, 'square', 0.12); this._tone(1320, 0.12, 'square', 0.1, 0.07); },

  success() {
    const notes = [523, 659, 784, 1046]; // do mi sol do
    notes.forEach((f, i) => this._tone(f, 0.18, 'triangle', 0.22, i * 0.09));
  },

  fanfare() {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((f, i) => this._tone(f, 0.22, 'sawtooth', 0.16, i * 0.12));
  },

  wrong() {
    // צליל רך ולא מעניש
    this._tone(330, 0.18, 'sine', 0.16);
    this._tone(247, 0.26, 'sine', 0.14, 0.12);
  },

  // קולות חיות פרוצדורליים (קירוב חמוד) — [תדר, משך, השהיה]
  animalSound(type) {
    if (!this.ctx || !this.sfxOn) return;
    const P = {
      horse:   [['sawtooth', 260, 0.22, 0], ['sawtooth', 300, 0.18, 0.16], ['sawtooth', 230, 0.2, 0.32]],
      cow:     [['sawtooth', 175, 0.35, 0], ['sawtooth', 150, 0.45, 0.22]],
      chicken: [['square', 950, 0.06, 0], ['square', 1150, 0.05, 0.09], ['square', 820, 0.07, 0.18]],
      sheep:   [['sawtooth', 400, 0.28, 0], ['sawtooth', 340, 0.3, 0.2]],
      pig:     [['square', 200, 0.07, 0], ['square', 175, 0.07, 0.09], ['square', 160, 0.09, 0.18]],
      dog:     [['square', 320, 0.1, 0], ['square', 270, 0.12, 0.13]],
      cat:     [['sine', 680, 0.18, 0], ['sine', 820, 0.22, 0.13]],
      duck:    [['square', 520, 0.07, 0], ['square', 470, 0.07, 0.09], ['square', 520, 0.07, 0.18]]
    }[type] || [['triangle', 440, 0.12, 0]];
    P.forEach(([w, f, d, delay]) => this._tone(f, d, w, 0.16, delay));
  },

  speak(text) {
    if (!this.voiceOn || !window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'he-IL';
      if (this.heVoice) u.voice = this.heVoice;
      u.rate = 0.92; u.pitch = 1.05;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  },

  stopSpeak() { if (window.speechSynthesis) window.speechSynthesis.cancel(); },

  praise() {
    const phrases = ['כל הכבוד!', 'מעולה!', 'יפה מאוד!', 'את אלופה!', 'נכון מאוד!', 'וואו, מדהים!'];
    this.speak(phrases[Math.floor(Math.random() * phrases.length)]);
  },

  tryAgain() {
    const phrases = ['כמעט! נסי שוב', 'לא נורא, ננסה עוד פעם', 'קרוב מאוד, נסי שוב'];
    this.speak(phrases[Math.floor(Math.random() * phrases.length)]);
  },

  // מוזיקת רקע עדינה — ארפג'ו רך בלולאה
  startMusic() {
    if (!this.ctx || !this.musicOn || this._musicTimer) return;
    const scale = [392, 440, 523, 587, 659, 784]; // סולם נעים
    let i = 0;
    const step = () => {
      if (!this.musicOn) return;
      const f = scale[i % scale.length];
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      o.connect(g); g.connect(this.musicGain);
      o.start(t); o.stop(t + 1.2);
      i++;
      this._musicTimer = setTimeout(step, 620);
    };
    step();
  },

  stopMusic() {
    this.musicOn = false;
    if (this._musicTimer) { clearTimeout(this._musicTimer); this._musicTimer = null; }
  },

  setMusic(on) {
    this.musicOn = on;
    if (on) this.startMusic(); else this.stopMusic();
  }
};

export { Audio };
