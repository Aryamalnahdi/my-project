begin;

-- Credentials stay in Supabase Auth; name and unique username stay in profiles.
create table public.employees (
  id uuid primary key references public.profiles(id),
  status text not null default 'inactive' check (status in ('inactive', 'active')),
  created_at timestamptz not null default now(),
  first_login_at timestamptz,
  check ((status = 'inactive' and first_login_at is null) or (status = 'active' and first_login_at is not null))
);
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  employee_id uuid not null references public.employees(id),
  title text not null check (length(btrim(title)) between 1 and 160),
  description text not null check (length(btrim(description)) between 1 and 10000),
  status text not null default 'open' check (status = 'open'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, employee_id)
);
create index tickets_employee_created on public.tickets(employee_id, created_at desc);
create index tickets_created on public.tickets(created_at desc);
create table public.ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  employee_id uuid not null references public.employees(id),
  note text not null check (length(btrim(note)) between 1 and 5000),
  created_at timestamptz not null default now(),
  foreign key (ticket_id, employee_id) references public.tickets(id, employee_id)
);
create index ticket_notes_ticket_created on public.ticket_notes(ticket_id, created_at);
create index ticket_notes_employee on public.ticket_notes(employee_id);

alter table public.employees enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_notes enable row level security;
create policy employee_read on public.employees for select to authenticated using (
  (select private.current_role()) = 'main_admin'
  or ((select private.current_role()) = 'employee' and id = (select auth.uid()))
);
create policy ticket_read on public.tickets for select to authenticated using (
  (select private.current_role()) = 'main_admin'
  or ((select private.current_role()) = 'employee' and employee_id = (select auth.uid()))
);
create policy ticket_note_read on public.ticket_notes for select to authenticated using (
  (select private.current_role()) = 'main_admin'
  or ((select private.current_role()) = 'employee' and employee_id = (select auth.uid()))
);
-- The legacy Head directory is not part of the employee portal.
alter policy head_read on public.heads using ((select private.current_role()) in ('main_admin', 'head', 'normal_user'));

revoke all on public.employees, public.tickets, public.ticket_notes from public, anon, authenticated;
revoke all on sequence public.tickets_ticket_number_seq from public, anon, authenticated;
grant select on public.employees, public.tickets, public.ticket_notes to authenticated;
grant all on public.employees, public.tickets, public.ticket_notes to service_role;
grant usage, select on sequence public.tickets_ticket_number_seq to service_role;

-- Called by the server only after verifying an admin session. Both rows commit together.
create function public.provision_employee(p_id uuid, p_username text, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_username !~ '^employee-[a-f0-9]{12}$' then raise exception 'Invalid username'; end if;
  insert into public.profiles(id, name, username, role) values (p_id, btrim(p_name), p_username, 'employee');
  insert into public.employees(id) values (p_id);
end;
$$;
create function public.activate_employee()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.current_role() is distinct from 'employee' then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  update public.employees set status = 'active', first_login_at = coalesce(first_login_at, now()) where id = auth.uid();
  if not found then raise exception 'Employee unavailable'; end if;
end;
$$;
create function public.create_ticket(p_title text, p_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if private.current_role() is distinct from 'employee' then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  insert into public.tickets(employee_id, title, description)
    values (auth.uid(), btrim(p_title), btrim(p_description)) returning id into result;
  return result;
end;
$$;
create function public.add_ticket_note(p_ticket_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; result uuid;
begin
  if private.current_role() is distinct from 'main_admin' then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  select employee_id into owner_id from public.tickets where id = p_ticket_id;
  if owner_id is null then raise exception 'Ticket unavailable'; end if;
  insert into public.ticket_notes(ticket_id, employee_id, note)
    values (p_ticket_id, owner_id, btrim(p_note)) returning id into result;
  update public.tickets set updated_at = now() where id = p_ticket_id;
  return result;
end;
$$;

-- Durable, atomic rate limit shared by every login entry point and server instance.
-- The key is a SHA-256 username digest. No PIN/password is stored here.
create table private.ticket_login_attempts (
  key text primary key check (key ~ '^[a-f0-9]{64}$'),
  attempts integer not null,
  window_started_at timestamptz not null
);
alter table private.ticket_login_attempts enable row level security;
revoke all on private.ticket_login_attempts from public, anon, authenticated;
create function public.consume_ticket_login_attempt(p_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare attempt_count integer;
begin
  delete from private.ticket_login_attempts where window_started_at < now() - interval '1 day';
  insert into private.ticket_login_attempts as attempts(key, attempts, window_started_at)
    values (p_key, 1, now())
    on conflict (key) do update set
      attempts = case when attempts.window_started_at <= now() - interval '15 minutes' then 1 else least(attempts.attempts + 1, 6) end,
      window_started_at = case when attempts.window_started_at <= now() - interval '15 minutes' then now() else attempts.window_started_at end
    returning attempts into attempt_count;
  return attempt_count <= 5;
end;
$$;
create function public.clear_ticket_login_attempts(p_key text)
returns void language sql security definer set search_path = '' as $$
  delete from private.ticket_login_attempts where key = p_key;
$$;

revoke all on function public.provision_employee(uuid, text, text), public.activate_employee(),
  public.create_ticket(text, text), public.add_ticket_note(uuid, text),
  public.consume_ticket_login_attempt(text), public.clear_ticket_login_attempts(text)
  from public, anon, authenticated;
grant execute on function public.activate_employee(), public.create_ticket(text, text),
  public.add_ticket_note(uuid, text) to authenticated;
grant execute on function public.provision_employee(uuid, text, text),
  public.consume_ticket_login_attempt(text), public.clear_ticket_login_attempts(text) to service_role;

alter publication supabase_realtime add table public.employees, public.tickets, public.ticket_notes;
commit;
