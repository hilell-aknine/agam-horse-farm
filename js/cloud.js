// cloud.js — שמירת ענן ב-Supabase (fail-safe).
// אם אין רשת / לא מוגדר — המשחק עובד רגיל מ-localStorage ללא שגיאות.
// המפתח הוא anon ציבורי (בטוח בצד-לקוח, מוגן ב-RLS).
// עולם חברתי: farm_profiles (שם+רמה לכל שחקנית) + צפייה בחוות של חברות (קריאה בלבד).

import { isAllowedEmail } from './allowlist.js';
const SUPABASE_URL = 'https://xgqetnlsesgwiypufodf.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncWV0bmxzZXNnd2l5cHVmb2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mjc5MjQsImV4cCI6MjA5NTIwMzkyNH0.0szenmLzE8nhCr-FdaqnLBCL5TjB1IuTxsWbUND0mU4';
const TABLE = 'game_saves';
const LOGIN_FN = SUPABASE_URL + '/functions/v1/farm-email-login';   // כניסה במייל בלבד (בלי סיסמה, בלי קישור)
const LOCAL_EMAIL_KEY = 'agam_local_email';   // החשבון הפעיל במכשיר (מייל). קובע את המגירה גם כשאין ענן / הפונקציה לא פרוסה
const PROFILES = 'farm_profiles';

const Cloud = {
  client: null, ready: false, userId: null, _timer: null, _profileName: null,
  _saveTo: null,   // לאיזה חשבון מותר לדחוף שמירות. נקבע ב-boot אחרי שהוחלט של מי החווה, ומתאפס ביציאה

  // אותה הבטחה לכל הקוראים — אפשר להמשיך לחכות לה אחרי ש-boot ויתר עליה בזמן קצוב
  init() { if (!this._initP) this._initP = this._init(); return this._initP; },
  async _init() {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      this.client = createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'agam_sb_auth' }
      });
      // בלי כניסה אנונימית אוטומטית — דף הבית הוא הרשמה/כניסה.
      // session קיים (כולל אנונימי ותיק) ממשיך לעבוד עד שנרשמים.
      const { data: { session } } = await this.client.auth.getSession();
      this.userId = session && session.user ? session.user.id : null;
      this._email = session && session.user ? (session.user.email || null) : null;
      this.ready = !!this.client;
    } catch (e) {
      this.ready = false;   // ענן כבוי — נופלים ל-localStorage בלבד
    }
    return this.ready;
  },

  email() { return this._email || null; },
  // המייל של החשבון הפעיל: session בענן, ואם אין — חשבון-מייל מקומי במכשיר
  accountEmail() {
    if (this._email) return this._email.toLowerCase();
    return this.localEmail() || this.storedSessionEmail();
  },
  localEmail() { try { return localStorage.getItem(LOCAL_EMAIL_KEY) || null; } catch (e) { return null; } },
  // המייל מתוך ה-session השמור במכשיר — זמין מיד, גם כשהספרייה עוד נטענת (רשת איטית/מסוננת)
  storedSessionEmail() {
    try {
      const raw = localStorage.getItem('agam_sb_auth');
      if (!raw) return null;
      const j = JSON.parse(raw);
      const u = j && (j.user || (j.currentSession && j.currentSession.user));
      return (u && u.email) ? String(u.email).toLowerCase() : null;
    } catch (e) { return null; }
  },

  // ---------- כניסה במייל של הורה בלבד (בלי סיסמה, רק מייל מורשה) ----------
  // שער 1 (דפדפן): המייל חייב להיות ברשימת המורשים (allowlist.js). לא מורשה → not_allowed.
  // שער 2 (שרת): הפונקציה farm-email-login בודקת שוב מול FARM_ALLOWED_EMAILS ומנפיקה session בלי לשלוח מייל.
  // אם הפונקציה לא זמינה (לא פרוסה / אין רשת) — נכנסים כחשבון מקומי לפי המייל, והחווה נשמרת במכשיר בלבד.
  // מחזיר { mode:'cloud'|'local', created }.
  async loginEmail(email) {
    email = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('bad_email');
    if (!(await isAllowedEmail(email))) throw new Error('not_allowed');
    let res = null;
    if (this.client) {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
        res = await fetch(LOGIN_FN, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON },
          body: JSON.stringify({ email })
        });
        clearTimeout(t);
      } catch (e) { res = null; }
    }
    if (res && res.ok) {
      const j = await res.json();
      const { data, error } = await this.client.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
      if (!error && data && data.session) {
        this.userId = data.session.user.id; this._email = data.session.user.email;
        try { localStorage.setItem(LOCAL_EMAIL_KEY, this._email.toLowerCase()); } catch (e) {}   // החשבון הפעיל במכשיר
        return { mode: 'cloud', created: !!j.created };
      }
    }
    if (res && res.status === 403) {
      let code = 'not_farm_account';
      try { code = (await res.json()).error || code; } catch (e) {}
      throw new Error(code === 'not_allowed' ? 'not_allowed' : 'not_farm_account');
    }
    if (res && res.status === 400) throw new Error('bad_email');
    try { localStorage.setItem(LOCAL_EMAIL_KEY, email); } catch (e) {}
    return { mode: 'local', created: null };
  },
  isGuest() { return !!this.userId && !this._email; },
  loggedIn() { return !!this._email; },

  async signOut() {
    clearTimeout(this._timer); this._timer = null;
    this._saveTo = null;
    try { await this.client.auth.signOut(); } catch (e) {}
    // גם אם הרשת נפלה — מנקים את ה-session המקומי כדי שהטעינה הבאה לא תחזור לאותו חשבון
    try { localStorage.removeItem('agam_sb_auth'); localStorage.removeItem(LOCAL_EMAIL_KEY); } catch (e) {}
    this.userId = null; this._email = null; this._profileName = null;
  },
  // מאיזה רגע מותר לדחוף לענן, ולאיזה חשבון בלבד
  bindSaves(userId) { this._saveTo = userId || null; clearTimeout(this._timer); this._timer = null; },

  // ---------- פרופיל שחקנית (שם + רמה, גלוי לחברות) ----------
  async saveProfile(name, level) {
    if (!this.userId) return;
    try {
      this._profileName = name;
      await this.client.from(PROFILES).upsert({
        user_id: this.userId, name, level: level || 1, updated_at: new Date().toISOString()
      });
    } catch (e) { /* לא חוסם משחק */ }
  },
  async fetchProfile() {
    if (!this.userId) return null;
    try {
      const { data, error } = await this.client.from(PROFILES)
        .select('name, level').eq('user_id', this.userId).maybeSingle();
      if (error) return null;
      if (data) this._profileName = data.name;
      return data;
    } catch (e) { return null; }
  },
  profileName() { return this._profileName || null; },

  // ---------- עולם חברתי: רשימת חוות + צפייה ----------
  async listFarms() {
    if (!this.loggedIn()) return [];
    try {
      const { data, error } = await this.client.from(PROFILES)
        .select('user_id, name, level, updated_at')
        .order('updated_at', { ascending: false }).limit(100);
      if (error) return [];
      return (data || []).filter(p => p.user_id !== this.userId);
    } catch (e) { return []; }
  },
  async pullUser(userId) {
    if (!this.loggedIn()) return null;
    try {
      const { data, error } = await this.client.from(TABLE)
        .select('data').eq('user_id', userId).maybeSingle();
      if (error) return null;
      return data ? data.data : null;
    } catch (e) { return null; }
  },

  // משיכת שמירה מהענן (למכשיר חדש)
  async pull() {
    if (!this.userId) return null;
    try {
      const { data, error } = await this.client.from(TABLE)
        .select('data').eq('user_id', this.userId).maybeSingle();
      if (error) return null;
      return data ? data.data : null;
    } catch (e) { return null; }
  },

  // דחיפת שמירה לענן (משוהה כדי לא להציף) + עדכון רמה בפרופיל
  // דוחפים רק לחשבון שה-boot קשר (_saveTo) ורק אם הוא עדיין המחובר — כך חוות אורחת
  // או חשבון קודם לא נכתבות לענן של חשבון אחר באמצע החלפה.
  push(dataObj) {
    if (!dataObj || !this._saveTo || this._saveTo !== this.userId) return;
    const uid = this._saveTo;
    this._pending = dataObj;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => { this._send(uid, dataObj); }, 1500);
  },
  async _send(uid, dataObj) {
    this._timer = null; this._pending = null;
    if (!uid || uid !== this._saveTo || !this.client) return;
    try {
      await this.client.from(TABLE).upsert({
        user_id: uid, data: dataObj, updated_at: new Date().toISOString()
      });
      if (this._profileName && dataObj.level) {
        await this.client.from(PROFILES).upsert({
          user_id: uid, name: this._profileName, level: dataObj.level,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) { /* התעלם — נשמר מקומית בכל מקרה */ }
  },
  // שליחה מיידית של מה שממתין (לפני יציאה מחשבון)
  async flush() {
    if (!this._timer || !this._pending) return;
    clearTimeout(this._timer);
    await this._send(this._saveTo, this._pending);
  }
};

export { Cloud };
