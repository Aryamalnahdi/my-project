begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum ('main_admin', 'head', 'normal_user');
create type public.task_status as enum ('Approved', 'Not Approved');
create type public.notification_type as enum ('task_added', 'task_status_updated');

create table public.profiles (
  id uuid primary key references auth.users(id),
  name text not null check (length(btrim(name)) between 1 and 100),
  username text not null unique check (length(username) between 1 and 80),
  role public.app_role not null
);
create unique index one_main_admin on public.profiles (role) where role = 'main_admin';

create table public.heads (
  id smallint primary key check (id between 1 and 3),
  user_id uuid unique references public.profiles(id)
);
insert into public.heads(id) values (1), (2), (3);

-- Deployment configuration, not an editable department or workflow system.
create table private.configuration (
  singleton boolean primary key default true check (singleton),
  lena_user_id uuid references public.profiles(id),
  normal_task_head_id smallint references public.heads(id)
);
insert into private.configuration(singleton) values (true);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_text text not null check (length(btrim(task_text)) between 1 and 2000),
  assigned_user_id uuid not null references public.profiles(id),
  head_id smallint not null references public.heads(id),
  status public.task_status not null,
  creator_id uuid not null references public.profiles(id)
);
create index tasks_assignee on public.tasks(assigned_user_id);
create index tasks_head on public.tasks(head_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id),
  actor_id uuid not null references public.profiles(id),
  actor_name text not null,
  task_id uuid references public.tasks(id) on delete set null,
  type public.notification_type not null,
  created_at timestamptz not null default now()
);
create index notification_recipient on public.notifications(recipient_id, created_at desc);

create function private.current_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid());
$$;
create function private.current_head() returns smallint
language sql stable security definer set search_path = '' as $$
  select id from public.heads where user_id = (select auth.uid());
$$;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_role(), private.current_head() to authenticated;

alter table public.profiles enable row level security;
alter table public.heads enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table private.configuration enable row level security;

create policy profile_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or (select private.current_role()) = 'main_admin'
);
create policy head_read on public.heads for select to authenticated using (true);
create policy task_read on public.tasks for select to authenticated using (
  (select private.current_role()) = 'main_admin'
  or ((select private.current_role()) = 'normal_user' and assigned_user_id = (select auth.uid()))
  or ((select private.current_role()) = 'head' and head_id = (select private.current_head()))
);
create policy notification_read on public.notifications for select to authenticated using (
  recipient_id = (select auth.uid()) or (select private.current_role()) = 'main_admin'
);

-- Reads use RLS. All writes go through narrowly scoped functions below.
revoke all on public.profiles, public.heads, public.tasks, public.notifications from anon, authenticated;
grant select on public.profiles, public.heads, public.tasks, public.notifications to authenticated;
grant all on public.profiles, public.heads, public.tasks, public.notifications to service_role;

create function public.create_admin_task(p_text text, p_assignee uuid, p_head smallint, p_status public.task_status)
returns uuid language plpgsql security definer set search_path = '' as $$
declare task_id uuid;
begin
  if private.current_role() is distinct from 'main_admin' then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_assignee) then
    raise exception 'Invalid assignee';
  end if;
  if not exists (select 1 from public.heads where id = p_head and user_id is not null) then
    raise exception 'Head account is not configured';
  end if;
  insert into public.tasks(task_text, assigned_user_id, head_id, status, creator_id)
    values (btrim(p_text), p_assignee, p_head, p_status, auth.uid()) returning id into task_id;
  return task_id;
end;
$$;

create function public.assign_task(p_task uuid, p_assignee uuid, p_head smallint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.current_role() is distinct from 'main_admin' then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.heads where id = p_head and user_id is not null) then
    raise exception 'Head account is not configured';
  end if;
  update public.tasks set assigned_user_id = p_assignee, head_id = p_head where id = p_task;
  if not found then raise exception 'Task unavailable'; end if;
end;
$$;

create function public.create_own_task(p_text text, p_status public.task_status)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_head smallint; task_id uuid;
begin
  if private.current_role() is distinct from 'normal_user' then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  select normal_task_head_id into target_head from private.configuration where singleton;
  if target_head is null then raise exception 'User task routing has not been configured'; end if;
  if not exists (select 1 from public.heads where id = target_head and user_id is not null) then
    raise exception 'Head account is not configured';
  end if;
  insert into public.tasks(task_text, assigned_user_id, head_id, status, creator_id)
    values (btrim(p_text), auth.uid(), target_head, p_status, auth.uid()) returning id into task_id;
  return task_id;
end;
$$;

create function public.update_task_status(p_task uuid, p_status public.task_status)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_role public.app_role := private.current_role();
begin
  if actor_role is null or actor_role not in ('main_admin', 'normal_user') then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  update public.tasks set status = p_status where id = p_task
    and (actor_role = 'main_admin' or assigned_user_id = auth.uid());
  if not found then raise exception 'Task unavailable' using errcode = '42501'; end if;
end;
$$;

create function private.notify_lena() returns trigger
language plpgsql security definer set search_path = '' as $$
declare recipient uuid; event public.notification_type; actor_name text;
begin
  if private.current_role() is distinct from 'normal_user' then return new; end if;
  if tg_op = 'INSERT' then event := 'task_added';
  elsif old.status is distinct from new.status then event := 'task_status_updated';
  else return new;
  end if;
  select lena_user_id into recipient from private.configuration where singleton;
  if recipient is null then raise exception 'Notification recipient is not configured'; end if;
  select name into actor_name from public.profiles where id = auth.uid();
  insert into public.notifications(recipient_id, actor_id, actor_name, task_id, type)
    values (recipient, auth.uid(), actor_name, new.id, event);
  return new;
end;
$$;
create trigger task_notification after insert or update of status on public.tasks
  for each row execute function private.notify_lena();

-- Used only by the secure setup script, never from user-accessible application code.
create function public.configure_initial_head(p_user uuid, p_head smallint, p_is_lena boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_user and role = 'head') then
    raise exception 'Account must be a Head';
  end if;
  update public.heads set user_id = p_user where id = p_head and (user_id is null or user_id = p_user);
  if not found then raise exception 'Head slot is invalid or already assigned'; end if;
  if p_is_lena then
    update private.configuration set lena_user_id = p_user where singleton;
  end if;
end;
$$;

revoke all on function private.notify_lena() from public, anon, authenticated;
revoke all on function public.create_admin_task(text, uuid, smallint, public.task_status),
  public.assign_task(uuid, uuid, smallint), public.create_own_task(text, public.task_status),
  public.update_task_status(uuid, public.task_status), public.configure_initial_head(uuid, smallint, boolean)
  from public, anon, authenticated;
grant execute on function public.create_admin_task(text, uuid, smallint, public.task_status),
  public.assign_task(uuid, uuid, smallint), public.create_own_task(text, public.task_status),
  public.update_task_status(uuid, public.task_status) to authenticated;
grant execute on function public.configure_initial_head(uuid, smallint, boolean) to service_role;

alter publication supabase_realtime add table public.notifications;
commit;
