// cloud.js — שמירת ענן ב-Supabase (אופציונלי, fail-safe).
// אם אין רשת / לא מוגדר — המשחק עובד רגיל מ-localStorage ללא שגיאות.
// המפתח הוא anon ציבורי (בטוח בצד-לקוח, מוגן ב-RLS + התחברות אנונימית).

const SUPABASE_URL = 'https://xgqetnlsesgwiypufodf.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncWV0bmxzZXNnd2l5cHVmb2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mjc5MjQsImV4cCI6MjA5NTIwMzkyNH0.0szenmLzE8nhCr-FdaqnLBCL5TjB1IuTxsWbUND0mU4';
const TABLE = 'game_saves';

const Cloud = {
  client: null, ready: false, userId: null, _timer: null,

  async init() {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      this.client = createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'agam_sb_auth' }
      });
      let { data: { session } } = await this.client.auth.getSession();
      if (!session) {
        const { data, error } = await this.client.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      this.userId = session && session.user ? session.user.id : null;
      this._email = session && session.user ? (session.user.email || null) : null;
      this.ready = !!this.userId;
    } catch (e) {
      this.ready = false;   // ענן כבוי — נופלים ל-localStorage בלבד
    }
    return this.ready;
  },

  email() { return this._email || null; },
  isGuest() { return this.ready && !this._email; },

  async signUp(email, password) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) { this.userId = data.user.id; this._email = data.user.email; }
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

  // משיכת שמירה מהענן (למכשיר חדש)
  async pull() {
    if (!this.ready) return null;
    try {
      const { data, error } = await this.client.from(TABLE)
        .select('data').eq('user_id', this.userId).maybeSingle();
      if (error) return null;
      return data ? data.data : null;
    } catch (e) { return null; }
  },

  // דחיפת שמירה לענן (משוהה כדי לא להציף)
  push(dataObj) {
    if (!this.ready || !dataObj) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(async () => {
      try {
        await this.client.from(TABLE).upsert({
          user_id: this.userId, data: dataObj, updated_at: new Date().toISOString()
        });
      } catch (e) { /* התעלם — נשמר מקומית בכל מקרה */ }
    }, 1500);
  }
};

export { Cloud };
