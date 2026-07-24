// admin-users — פאנל אדמין: רשימת משתמשות + איפוס סיסמה.
// אבטחה: המפתח service_role נשאר בצד-שרת בלבד (מוזרק ע"י Supabase).
// גישה נחסמת מאחורי טוקן-אדמין (ADMIN_PANEL_TOKEN) בהשוואת זמן-קבוע.
// לעולם לא מחזיר סיסמאות — הן מוצפנות חד-כיווני ולא ניתנות לשחזור.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// השוואת זמן-קבוע כדי למנוע דליפת-זמן על הטוקן
function safeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const adminToken = Deno.env.get('ADMIN_PANEL_TOKEN');
    const provided = req.headers.get('x-admin-token') || '';
    // fail loudly: בלי טוקן מוגדר בשרת — אין גישה בכלל (לא ברירת-מחדל פתוחה)
    if (!adminToken || !safeEqual(provided, adminToken)) {
      return json({ error: 'unauthorized' }, 401);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = body.action;

    if (action === 'list') {
      // כל המשתמשות (עם עימוד)
      const authUsers: any[] = [];
      let page = 1;
      for (;;) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        authUsers.push(...data.users);
        if (data.users.length < 200) break;
        page++;
      }
      const { data: profiles } = await admin.from('farm_profiles').select('user_id,name,level,updated_at');
      const pmap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { pmap[p.user_id] = p; });
      const { data: saves } = await admin.from('game_saves').select('user_id,updated_at');
      const smap: Record<string, string> = {};
      (saves || []).forEach((s: any) => { smap[s.user_id] = s.updated_at; });

      const users = authUsers.map((u: any) => ({
        id: u.id,
        email: u.email || (u.is_anonymous ? '(אורח)' : ''),
        name: (pmap[u.id] && pmap[u.id].name) || '',
        level: pmap[u.id] ? pmap[u.id].level : '',
        created_at: u.created_at || null,
        last_sign_in_at: u.last_sign_in_at || null,
        saved_at: smap[u.id] || null,
      }));
      users.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return json({ users });
    }

    if (action === 'reset') {
      const userId = String((body as any).userId || '');
      const newPassword = String((body as any).newPassword || '');
      if (!userId || newPassword.length < 6) return json({ error: 'bad-input' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'unknown-action' }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
