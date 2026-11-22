-- Eskgo — schema inicial (ainda NÃO aplicado).
-- Rode no SQL Editor do Supabase ou com `supabase db push`.
-- Cada linha pertence a um usuário (auth.users) e o RLS garante
-- que cada pessoa só lê e escreve os próprios dados.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  balance numeric(12,2) not null default 0,
  hide_balance boolean not null default false,
  month_cap numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  last4 char(4) not null check (last4 ~ '^[0-9]{4}$'),
  color text not null default 'gradient' check (color in ('offwhite','lilac','gradient')),
  credit_limit numeric(12,2) not null check (credit_limit > 0),
  invoice numeric(12,2) not null default 0,
  due_day smallint check (due_day between 1 and 31),
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  category text not null check (category in ('moradia','alimentacao','transporte','lazer','saude','outros')),
  card_id uuid references public.cards on delete set null,
  method text not null default 'card' check (method in ('card','pix','dinheiro')),
  value numeric(12,2) not null check (value > 0),
  spent_on date not null default current_date,
  source text not null default 'manual' check (source in ('manual','invoice')),
  created_at timestamptz not null default now()
);
create index transactions_user_date on public.transactions (user_id, spent_on desc);

create table public.budgets (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  category text not null,
  cap numeric(12,2) not null check (cap >= 0),
  primary key (user_id, category)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  target numeric(12,2) not null check (target > 0),
  saved numeric(12,2) not null default 0,
  target_label text,
  icon text not null default 'star',
  created_at timestamptz not null default now()
);

-- RLS: dono = auth.uid()
alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own cards" on public.cards for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own transactions" on public.transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own budgets" on public.budgets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own goals" on public.goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
