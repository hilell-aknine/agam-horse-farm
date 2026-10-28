// farm-email-login — כניסה לחווה עם מייל של הורה בלבד: בלי סיסמה, בלי מייל לאישור.
// אותו מייל → אותו משתמש → אותה חווה. מייל חדש → משתמש חדש (created: true).
// מנפיק session בצד-שרת: admin.generateLink(magiclink) → verifyOtp(token_hash). שום מייל לא נשלח.
//
// ⚠️ ה-Auth של הפרויקט הזה (xgqetnlsesgwiypufodf) משותף למערכות אחרות (פורטל קגן ועוד).
// לכן הפונקציה מנפיקה session רק למשתמשות של החווה: app_metadata.agam_farm = true.
// מייל שקיים כבר בלי הסימון (משתמש של מערכת אחרת, או חשבון חווה ישן מתקופת הסיסמאות) → 403.
// חשבונות חווה ישנים: לסמן אותם פעם אחת ב-SQL, ידנית ורק למיילים שהלל מאשר:
//   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"agam_farm":true}'
//   where email in ('...');
//
// פריסה: npx supabase functions deploy farm-email-login --no-verify-jwt
// סודות: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY מוזרקים אוטומטית ע"י Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// הגבלת קצב בסיסית בזיכרון (לכל מופע): 12 כניסות לדקה לכל IP
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 12;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (limited(ip)) return json({ error: 'rate_limited' }, 429);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !service || !anon) return json({ error: 'not_configured' }, 500);   // fail loudly

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim().slice(0, 20);
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: 'bad_email' }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

    // 1. מייל חדש → יוצרים משתמשת חווה מאושרת (בלי סיסמה). קיים → בודקים שהוא של החווה.
    let created = false;
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { agam_farm: true },
      user_metadata: name ? { name } : {},
    });
    if (!createErr) created = true;
    else if (!/already|registered|exists/i.test(createErr.message)) return json({ error: 'create_failed' }, 500);

    // 2. קישור קסם בצד-שרת (לא נשלח מייל) — מחזיר token_hash + את המשתמש
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (linkErr || !link?.properties?.hashed_token || !link.user) return json({ error: 'link_failed' }, 500);
    if (!link.user.app_metadata?.agam_farm) return json({ error: 'not_farm_account' }, 403);

    // 3. מימוש הקישור → session אמיתי של המשתמשת
    const pub = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: ver, error: verErr } = await pub.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
    if (verErr || !ver?.session) return json({ error: 'verify_failed' }, 500);

    return json({
      access_token: ver.session.access_token,
      refresh_token: ver.session.refresh_token,
      created,
      name: (link.user.user_metadata as Record<string, string> | undefined)?.name || name || '',
    });
  } catch (_e) {
    return json({ error: 'server_error' }, 500);   // בלי פרטי שגיאה החוצה
  }
});
