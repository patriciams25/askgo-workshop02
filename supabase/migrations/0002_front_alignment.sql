-- Eskgo — alinha o schema com o que o front já usa (ainda NÃO aplicado).
-- Depende de 0001_init.sql.

-- Perfil: estágio 2 ligado e cartão da frente na carteira
alter table public.profiles
  add column if not exists plus boolean not null default false,
  add column if not exists front_card_id uuid references public.cards on delete set null,
  add column if not exists last_month_total numeric(12,2) not null default 0,
  add constraint profiles_month_cap_nonneg check (month_cap >= 0);

-- Faturas importadas (estágio 2): evita importar a mesma fatura duas vezes
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  card_id uuid references public.cards on delete set null,
  fingerprint text not null,            -- SHA-256 do arquivo
  file_name text,
  total numeric(12,2) not null check (total >= 0),
  items_count int not null default 0,
  subscriptions_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);
alter table public.invoices enable row level security;
create policy "own invoices" on public.invoices for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Transações: origem na fatura e marca de assinatura (usada pelos insights)
alter table public.transactions
  add column if not exists invoice_id uuid references public.invoices on delete cascade,
  add column if not exists subscription boolean not null default false;

-- Categoria válida também nos tetos
alter table public.budgets
  add constraint budgets_category_check check (category in ('moradia','alimentacao','transporte','lazer','saude','outros'));

-- Perfil criado automaticamente no cadastro (Supabase Auth)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
