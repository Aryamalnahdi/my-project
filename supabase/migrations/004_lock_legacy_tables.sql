begin;

-- Empty legacy tables found in the connected project are not used by this app.
-- Preserve them, but remove public/API access. Service-role maintenance remains possible.
do $$
declare legacy_table text;
begin
  foreach legacy_table in array array['users', 'issues'] loop
    if to_regclass('public.' || legacy_table) is not null then
      execute format('alter table public.%I enable row level security', legacy_table);
      execute format('revoke all on public.%I from public, anon, authenticated', legacy_table);
    end if;
  end loop;
end;
$$;

commit;
