-- 0044: Alerts on the phone / desktop when the app is closed (Web Push).
--
-- A browser that turns on alerts registers a push subscription here. Every new
-- row in `notifications` (work assigned, inspection assigned, vendor handover,
-- outside repair sent / overdue, auto check-out, ...) and every new service
-- request (for Admins) asks the Edge Function `send-push` to deliver it, via
-- pg_net. The function holds no secret from us: it creates its own VAPID key
-- pair on first use and keeps it in `push_config`, which only the service role
-- can read.
--
-- Safe to call the function by hand: it loads the row itself, sends each one at
-- most once (pushed_at / push_sent_at) and only while it is fresh (10 minutes),
-- so a forged call can at most deliver a real, new alert to its real recipient.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Subscriptions: one row per browser (endpoint), owned by the signed-in user.
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Users see and remove only their own devices. Writes go through
-- register_push_subscription() so a browser that changes hands (another user
-- signs in on it) moves to the new user instead of failing.
create policy "Own push subscriptions: read" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Own push subscriptions: delete" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

revoke insert, update on public.push_subscriptions from anon, authenticated;

-- Browsers' push services only: the function posts to this URL, so it must not
-- be an arbitrary address.
create or replace function public.is_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/'
     and length(p_endpoint) <= 1000
$$;

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to turn on alerts';
  end if;
  if not public.is_push_endpoint(p_endpoint) then
    raise exception 'This browser''s push service is not supported';
  end if;
  -- base64url of a 65-byte P-256 point is 87 characters; of the 16-byte auth secret, 22.
  if p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth !~ '^[A-Za-z0-9_-]{22}$' then
    raise exception 'Invalid push subscription keys';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now(),
        failure_count = 0;
end;
$$;

revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The Edge Function's own settings. No policies: only the service role reads it.
-- ---------------------------------------------------------------------------
create table public.push_config (
  id boolean primary key default true check (id),
  vapid_public_key text not null,
  vapid_private_jwk jsonb not null,
  -- Base URL of the Edge Functions (…/functions/v1); written by the function
  -- itself the first time a browser asks for the public key.
  functions_url text,
  -- VAPID contact (mailto: or https:). Defaults to the project URL when empty.
  subject text,
  created_at timestamptz not null default now()
);

alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Send-once markers.
-- ---------------------------------------------------------------------------
alter table public.notifications add column pushed_at timestamptz;

-- Added without a default first so existing requests stay null (never pushed);
-- new ones get the time they were raised.
alter table public.service_requests add column push_queued_at timestamptz;
alter table public.service_requests alter column push_queued_at set default now();
alter table public.service_requests add column push_sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- Queue a push. Never blocks or fails the insert that caused it.
-- ---------------------------------------------------------------------------
create or replace function public.queue_push(p_kind text, p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
begin
  select functions_url into v_url from public.push_config where id;
  if v_url is null then
    return; -- no browser has turned alerts on yet
  end if;
  perform net.http_post(
    url := v_url || '/send-push',
    body := jsonb_build_object('kind', p_kind, 'id', p_id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'push not queued for % %: %', p_kind, p_id, sqlerrm;
end;
$$;

revoke execute on function public.queue_push(text, text) from public, anon, authenticated;

create or replace function public.push_new_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.push_subscriptions s where s.user_id = new.user_id) then
    perform public.queue_push('notification', new.id::text);
  end if;
  return null;
end;
$$;

create trigger notifications_push_after_insert
  after insert on public.notifications
  for each row execute function public.push_new_notification();

-- A new service request alerts the Admins (not the Admin who raised it).
create or replace function public.push_new_service_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.push_subscriptions s
    join public.profiles p on p.id = s.user_id
    where p.role = 'Admin'
      and s.user_id is distinct from new.requested_by_user_id
  ) then
    perform public.queue_push('service_request', new.id);
  end if;
  return null;
end;
$$;

create trigger service_requests_push_after_insert
  after insert on public.service_requests
  for each row execute function public.push_new_service_request();

revoke execute on function public.push_new_notification() from public, anon, authenticated;
revoke execute on function public.push_new_service_request() from public, anon, authenticated;
