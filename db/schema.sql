create extension if not exists pgcrypto;

create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  owner_name text,
  owner_phone text,
  pin_hash text not null,
  monthly_price_cents int not null default 0,
  billing_day int not null default 10,
  status text not null default 'teste' check (status in ('ativa','teste','suspensa','cancelada')),
  tolerance_min int not null default 5,
  policy text not null default 'back' check (policy in ('back','out')),
  alert_ahead int not null default 2,
  failed_logins int not null default 0,
  locked_until timestamptz,
  started_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists barbers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  avg_min int not null default 30,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(12), 'hex'),
  shop_id uuid not null references shops(id) on delete cascade,
  barber_id uuid not null references barbers(id) on delete cascade,
  code text not null,
  name text not null,
  phone text,
  status text not null default 'waiting' check (status in ('waiting','called','serving','done','noshow','left')),
  ord double precision not null,
  present boolean not null default false,
  skips int not null default 0,
  alerted boolean not null default false,
  source text not null default 'qr',
  eta_at_join double precision not null default 1,
  created_at timestamptz not null default now(),
  called_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists tickets_barber_status on tickets (barber_id, status, ord);
create index if not exists tickets_shop_created on tickets (shop_id, created_at);

create table if not exists push_subs (
  id bigserial primary key,
  ticket_id uuid not null references tickets(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id bigserial primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  ticket_id uuid references tickets(id) on delete cascade,
  kind text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists notifications_ticket on notifications (ticket_id, id);
create index if not exists notifications_shop on notifications (shop_id, id);

create table if not exists payments (
  id bigserial primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  ref_month date not null,
  amount_cents int not null,
  paid_at date not null default current_date,
  method text not null default 'pix',
  note text,
  created_at timestamptz not null default now(),
  unique (shop_id, ref_month)
);
