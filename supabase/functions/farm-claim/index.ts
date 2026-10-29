// farm-claim — אחרי "המשך עם גוגל": מאשר שהמייל מורשה ומסמן את המשתמש כמשתמשת חווה.
// הדפדפן שולח את ה-access token שקיבל מגוגל דרך Supabase. הפונקציה:
//   1. הגבלת קצב (farm_rate_check במסד, 10 לדקה לכל IP)
//   2. מאמתת את הטוקן מול Supabase Auth (לא סומכים על שום דבר שהדפדפן כותב)
//   3. דורשת זהות גוגל עם מייל מאומת
//   4. המייל חייב להיות ב-FARM_ALLOWED_EMAILS. לא מורשה → 403, ושום סימון לא נעשה
//   5. מסמנת app_metadata.agam_farm = true. רק עם הסימון הזה ה-RLS של game_saves/farm_profiles נפתח.
// אחרי תשובה 200 הדפדפן עושה refreshSession כדי לקבל טוקן עם הסימון.
//
// ⚠️ ה-Auth משותף עם מערכות אחרות. משתמש של מערכת אחרת שמתחבר כאן עם גוגל בלי מייל מורשה מקבל 403
// ואין לו גישה לשום נתון של החווה.
//   npx supabase secrets set FARM_ALLOWED_EMAILS="a@x.com,b@y.com"
//   npx supabase functions deploy farm-claim --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const allowRaw = Deno.env.get('FARM_ALLOWED_EMAILS');
    if (!url || !service || !allowRaw) return json({ error: 'not_configured' }, 500);   // נכשלים סגור
    const allowed = new Set(allowRaw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const { data: okRate, error: rateErr } = await admin.rpc('farm_rate_check', { p_key: 'claim:' + ip, p_limit: 10, p_window_s: 60 });
    if (rateErr) return json({ error: 'server_error' }, 500);
    if (!okRate) return json({ error: 'rate_limited' }, 429);

    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'no_token' }, 401);
    const { data: got, error: userErr } = await admin.auth.getUser(jwt);
    const user = got?.user;
    if (userErr || !user) return json({ error: 'bad_token' }, 401);

    const google = (user.identities || []).some((i) => i.provider === 'google');
    const email = String(user.email || '').trim().toLowerCase();
    if (!google || !email || !user.email_confirmed_at) return json({ error: 'google_required' }, 403);
    if (!allowed.has(email)) return json({ error: 'not_allowed' }, 403);

    if (!user.app_metadata?.agam_farm) {
      const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, agam_farm: true },
      });
      if (updErr) return json({ error: 'server_error' }, 500);
    }
    return json({ ok: true, name: (user.user_metadata as Record<string, string> | undefined)?.given_name || '' });
  } catch (_e) {
    return json({ error: 'server_error' }, 500);   // בלי פרטי שגיאה החוצה
  }
});
