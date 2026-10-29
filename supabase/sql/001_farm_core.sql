-- 001_farm_core.sql: טבלאות השמירה של החווה + מחיצה בין משתמשים + הגבלת קצב.
--
-- ⚠️ המסד משותף עם מערכות אחרות (פורטל קגן, אגם מציירת ועוד). לכן:
--   * לא מריצים `supabase db push`. מריצים את הקובץ הזה ידנית דרך Management API (database/query).
--   * כל מדיניות דורשת app_metadata.agam_farm = true בטוקן. רק השרתון farm-claim (service role) מסמן את זה,
--     ורק למייל מורשה. משתמש של מערכת אחרת לא רואה ולא כותב כלום כאן.
--   * הקובץ רק מוסיף. לא נוגע בשום טבלה קיימת. אפשר להריץ שוב (idempotent).
begin;

-- ---------- מי משתמשת חווה ----------
create or replace function public.is_farm_user() returns boolean
language sql stable set search_path = public as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'agam_farm')::boolean, false)
$$;

-- ---------- טבלאות ----------
create table if not exists public.game_saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint game_saves_size check (pg_column_size(data) < 262144)   -- 256KB. שמירה רגילה ~10-30KB
);

create table if not exists public.farm_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 20),
  level      int  not null default 1 check (level between 1 and 999),
  updated_at timestamptz not null default now()
);

-- הפונקציה הייתה קיימת ויתומה (הטבלה נמחקה בעבר). security definer: מדיניות שקוראת לאותה טבלה ישירות = רקורסיה
create or replace function public.has_farm() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.farm_profiles where user_id = auth.uid())
$$;

alter table public.game_saves    enable row level security;
alter table public.farm_profiles enable row level security;
revoke all on public.game_saves, public.farm_profiles from anon;

-- ---------- RLS: קריאה לכל משתמשות החווה (ביקור אצל חברה), כתיבה רק לשורה של עצמך ----------
drop policy if exists farm_saves_select on public.game_saves;
drop policy if exists farm_saves_insert on public.game_saves;
drop policy if exists farm_saves_update on public.game_saves;
drop policy if exists farm_saves_delete on public.game_saves;
create policy farm_saves_select on public.game_saves for select to authenticated
  using (public.is_farm_user());
create policy farm_saves_insert on public.game_saves for insert to authenticated
  with check (public.is_farm_user() and user_id = auth.uid());
create policy farm_saves_update on public.game_saves for update to authenticated
  using (public.is_farm_user() and user_id = auth.uid())
  with check (public.is_farm_user() and user_id = auth.uid());
create policy farm_saves_delete on public.game_saves for delete to authenticated
  using (public.is_farm_user() and user_id = auth.uid());

drop policy if exists farm_profiles_select on public.farm_profiles;
drop policy if exists farm_profiles_insert on public.farm_profiles;
drop policy if exists farm_profiles_update on public.farm_profiles;
drop policy if exists farm_profiles_delete on public.farm_profiles;
create policy farm_profiles_select on public.farm_profiles for select to authenticated
  using (public.is_farm_user());
create policy farm_profiles_insert on public.farm_profiles for insert to authenticated
  with check (public.is_farm_user() and user_id = auth.uid());
create policy farm_profiles_update on public.farm_profiles for update to authenticated
  using (public.is_farm_user() and user_id = auth.uid())
  with check (public.is_farm_user() and user_id = auth.uid());
create policy farm_profiles_delete on public.farm_profiles for delete to authenticated
  using (public.is_farm_user() and user_id = auth.uid());

-- ---------- נגד הצפת כתיבה: אותה שמירה לא מתעדכנת יותר מפעם בשנייה. השעה נקבעת בשרת ----------
create or replace function public.farm_save_throttle() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.updated_at > now() - interval '1 second' then
    raise exception 'too_fast' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists farm_save_throttle on public.game_saves;
create trigger farm_save_throttle before insert or update on public.game_saves
  for each row execute function public.farm_save_throttle();

-- ---------- הגבלת קצב לשרתונים (משותפת לכל המופעים, לא בזיכרון) ----------
create table if not exists public.farm_rate_hits (
  key text not null,
  at  timestamptz not null default now()
);
create index if not exists farm_rate_hits_key_at on public.farm_rate_hits (key, at);
alter table public.farm_rate_hits enable row level security;   -- בלי מדיניות: רק service role
revoke all on public.farm_rate_hits from anon, authenticated;

-- true = מותר. false = חרג (השרתון מחזיר 429)
create or replace function public.farm_rate_check(p_key text, p_limit int, p_window_s int) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.farm_rate_hits where at < now() - interval '1 hour';
  select count(*) into n from public.farm_rate_hits
    where key = p_key and at > now() - make_interval(secs => p_window_s);
  if n >= p_limit then return false; end if;
  insert into public.farm_rate_hits (key) values (p_key);
  return true;
end $$;
revoke execute on function public.farm_rate_check(text, int, int) from public, anon, authenticated;
grant execute on function public.farm_rate_check(text, int, int) to service_role;

commit;
