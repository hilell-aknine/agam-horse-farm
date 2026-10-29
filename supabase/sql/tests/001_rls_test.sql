-- בדיקת המחיצה של 001. רץ בתוך DO ונגמר תמיד ב-exception, אז הכל מתבטל ושום שורה לא נשארת.
-- התוצאה מגיעה בהודעת השגיאה: "TEST RESULT: ...". כל ערך עם "!" = כשל.
do $$
declare u1 uuid; u2 uuid; n int; ok boolean; r text := '';
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users order by created_at offset 1 limit 1;

  -- משתמשת חווה
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated',
    'app_metadata', json_build_object('agam_farm', true))::text, true);
  insert into public.game_saves (user_id, data) values (u1, '{"coins":1}');
  insert into public.farm_profiles (user_id, name) values (u1, 'בדיקה');
  r := r || 'farm_own_insert=ok ';
  select count(*) into n from public.game_saves; r := r || 'farm_sees=' || n || ' ';
  begin insert into public.game_saves (user_id, data) values (u2, '{}'); r := r || 'farm_write_other=ALLOWED! ';
  exception when others then r := r || 'farm_write_other=blocked '; end;
  begin update public.game_saves set data = '{"coins":2}' where user_id = u1; r := r || 'fast_update=ALLOWED! ';
  exception when others then r := r || 'fast_update=blocked '; end;
  begin insert into public.game_saves (user_id, data) values (u1, to_jsonb(repeat('x', 400000)))
    on conflict (user_id) do nothing; r := r || 'huge_save=ALLOWED! ';
  exception when others then r := r || 'huge_save=blocked '; end;
  begin ok := public.farm_rate_check('t', 1, 60); r := r || 'user_rate_fn=ALLOWED! ';
  exception when others then r := r || 'user_rate_fn=blocked '; end;

  -- משתמש של מערכת אחרת (בלי סימון חווה)
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated',
    'app_metadata', json_build_object())::text, true);
  select count(*) into n from public.game_saves; r := r || 'other_sees_saves=' || n || ' ';
  select count(*) into n from public.farm_profiles; r := r || 'other_sees_profiles=' || n || ' ';
  begin insert into public.game_saves (user_id, data) values (u2, '{}'); r := r || 'other_insert=ALLOWED! ';
  exception when others then r := r || 'other_insert=blocked '; end;
  update public.game_saves set data = '{}' where user_id = u1;
  get diagnostics n = row_count; r := r || 'other_update_rows=' || n || ' ';

  -- אנונימי
  perform set_config('role', 'anon', true);
  begin select count(*) into n from public.game_saves; r := r || 'anon_sees=' || n || '! ';
  exception when others then r := r || 'anon=blocked '; end;

  -- הגבלת קצב בצד השרת
  perform set_config('role', 'service_role', true);
  n := 0;
  for i in 1..11 loop
    if public.farm_rate_check('test-ip', 10, 60) then n := n + 1; end if;
  end loop;
  r := r || 'rate_allowed=' || n || '/11';

  raise exception 'TEST RESULT: %', r;
end $$;
