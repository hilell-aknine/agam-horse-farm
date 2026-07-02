// cloud.js — שמירת ענן ב-Supabase (fail-safe).
// אם אין רשת / לא מוגדר — המשחק עובד רגיל מ-localStorage ללא שגיאות.
// המפתח הוא anon ציבורי (בטוח בצד-לקוח, מוגן ב-RLS).
// עולם חברתי: farm_profiles (שם+רמה לכל שחקנית) + צפייה בחוות של חברות (קריאה בלבד).

const SUPABASE_URL = 'https://xgqetnlsesgwiypufodf.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncWV0bmxzZXNnd2l5cHVmb2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mjc5MjQsImV4cCI6MjA5NTIwMzkyNH0.0szenmLzE8nhCr-FdaqnLBCL5TjB1IuTxsWbUND0mU4';
const TABLE = 'game_saves';
const PROFILES = 'farm_profiles';

const Cloud = {
  client: null, ready: false, userId: null, _timer: null, _profileName: null,

  async init() {
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
  isGuest() { return !!this.userId && !this._email; },
  loggedIn() { return !!this._email; },

  async signUp(email, password, name) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) { this.userId = data.user.id; this._email = data.user.email; }
    if (name) await this.saveProfile(name, 1);
    return data;
  },
  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.userId = data.user.id; this._email = data.user.email;
    return data;
  },
  async signOut() {
    try { await this.client.auth.signOut(); } catch (e) {}
  },

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
  push(dataObj) {
    if (!this.userId || !dataObj) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(async () => {
      try {
        await this.client.from(TABLE).upsert({
          user_id: this.userId, data: dataObj, updated_at: new Date().toISOString()
        });
        if (this._profileName && dataObj.level) {
          await this.client.from(PROFILES).upsert({
            user_id: this.userId, name: this._profileName, level: dataObj.level,
            updated_at: new Date().toISOString()
          });
        }
      } catch (e) { /* התעלם — נשמר מקומית בכל מקרה */ }
    }, 1500);
  }
};

export { Cloud };
