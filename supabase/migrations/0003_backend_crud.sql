-- Eskgo backend v1. Depends on 0001_init.sql and 0002_front_alignment.sql.
-- Explicit CRUD grants and RLS, user ownership checks, atomic balance effects,
-- private invoice storage and isolated fictional demo fixture.

begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated, service_role;
grant usage on schema public to authenticated;

alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.cards
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists current_invoice_id uuid;
alter table public.transactions add column if not exists updated_at timestamptz not null default now();
alter table public.budgets
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
alter table public.goals add column if not exists updated_at timestamptz not null default now();
alter table public.invoices
  add column if not exists file_mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists storage_path text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.cards add constraint cards_current_invoice_fk
  foreign key (current_invoice_id) references public.invoices(id) on delete set null;
alter table public.invoices
  add constraint invoices_file_size_check check (file_size_bytes is null or file_size_bytes between 1 and 3145728),
  add constraint invoices_file_mime_check check (file_mime_type is null or file_mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  add constraint invoices_storage_path_check check (storage_path is null or storage_path like user_id::text || '/invoices/%');
alter table public.transactions
  drop constraint if exists transactions_method_check,
  add constraint transactions_method_check check (method in ('card','pix','dinheiro'));
alter table public.budgets
  drop constraint if exists budgets_category_check,
  add constraint budgets_category_check check (category in ('moradia','alimentacao','transporte','lazer','saude','outros'));

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transactions_invoice_id on public.transactions(invoice_id);
create index if not exists cards_owner on public.cards(user_id);
create index if not exists goals_owner on public.goals(user_id);
create index if not exists invoices_owner_created on public.invoices(user_id, created_at desc);
create index goal_contributions_owner_goal_created on public.goal_contributions(user_id, goal_id, created_at desc);

alter table public.goal_contributions enable row level security;

drop policy if exists "own profile" on public.profiles;
drop policy if exists "own cards" on public.cards;
drop policy if exists "own transactions" on public.transactions;
drop policy if exists "own budgets" on public.budgets;
drop policy if exists "own goals" on public.goals;
drop policy if exists "own invoices" on public.invoices;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy cards_select_own on public.cards for select to authenticated using ((select auth.uid()) = user_id);
create policy cards_insert_own on public.cards for insert to authenticated with check ((select auth.uid()) = user_id);
create policy cards_update_own on public.cards for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy cards_delete_own on public.cards for delete to authenticated using ((select auth.uid()) = user_id);

create policy transactions_select_own on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy transactions_insert_own on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy transactions_update_own on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy transactions_delete_own on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

create policy budgets_select_own on public.budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy budgets_insert_own on public.budgets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy budgets_update_own on public.budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy budgets_delete_own on public.budgets for delete to authenticated using ((select auth.uid()) = user_id);

create policy goals_select_own on public.goals for select to authenticated using ((select auth.uid()) = user_id);
create policy goals_insert_own on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_update_own on public.goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_delete_own on public.goals for delete to authenticated using ((select auth.uid()) = user_id);

create policy contributions_select_own on public.goal_contributions for select to authenticated using ((select auth.uid()) = user_id);
create policy contributions_insert_own on public.goal_contributions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy contributions_update_own on public.goal_contributions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy contributions_delete_own on public.goal_contributions for delete to authenticated using ((select auth.uid()) = user_id);

create policy invoices_select_own on public.invoices for select to authenticated using ((select auth.uid()) = user_id);
create policy invoices_insert_own on public.invoices for insert to authenticated with check ((select auth.uid()) = user_id);
create policy invoices_update_own on public.invoices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy invoices_delete_own on public.invoices for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.profiles, public.cards, public.transactions, public.budgets, public.goals, public.goal_contributions, public.invoices from anon;
revoke insert, delete on table public.profiles from authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.cards, public.transactions,
  public.budgets, public.goals, public.goal_contributions, public.invoices to authenticated;

create or replace function app_private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
revoke all on function app_private.set_updated_at() from public, anon, authenticated, service_role;

create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, name) values(new.id, coalesce(new.raw_user_meta_data->>'name',''))
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function app_private.handle_new_user() from public, anon, authenticated, service_role;
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- Give existing Auth accounts an empty profile without replacing any record.
insert into public.profiles(id, name)
select u.id, coalesce(u.raw_user_meta_data->>'name','') from auth.users u
on conflict (id) do nothing;

create or replace function app_private.validate_profile_front_card()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.front_card_id is not null and not exists
    (select 1 from public.cards c where c.id=new.front_card_id and c.user_id=new.id) then
    raise exception 'front_card_id must refer to a card owned by this profile' using errcode='23503';
  end if;
  return new;
end $$;
revoke all on function app_private.validate_profile_front_card() from public, anon, authenticated, service_role;
create trigger profiles_validate_front_card before insert or update of front_card_id,id on public.profiles
  for each row execute function app_private.validate_profile_front_card();

create or replace function app_private.validate_transaction_refs()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.card_id is not null and not exists
    (select 1 from public.cards c where c.id=new.card_id and c.user_id=new.user_id) then
    raise exception 'card_id must refer to a card owned by this user' using errcode='23503';
  end if;
  if new.invoice_id is not null and not exists
    (select 1 from public.invoices i where i.id=new.invoice_id and i.user_id=new.user_id) then
    raise exception 'invoice_id must refer to an invoice owned by this user' using errcode='23503';
  end if;
  if new.source='invoice' and new.invoice_id is null then
    raise exception 'invoice transactions require invoice_id' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function app_private.validate_transaction_refs() from public, anon, authenticated, service_role;
create trigger transactions_validate_refs before insert or update of user_id,card_id,invoice_id,source on public.transactions
  for each row execute function app_private.validate_transaction_refs();

create or replace function app_private.validate_invoice_refs()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.card_id is not null and not exists
    (select 1 from public.cards c where c.id=new.card_id and c.user_id=new.user_id) then
    raise exception 'card_id must refer to a card owned by this user' using errcode='23503';
  end if;
  if new.storage_path is not null and new.storage_path not like new.user_id::text || '/invoices/%' then
    raise exception 'storage_path must be inside the user invoice folder' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function app_private.validate_invoice_refs() from public, anon, authenticated, service_role;
create trigger invoices_validate_refs before insert or update of user_id,card_id,storage_path on public.invoices
  for each row execute function app_private.validate_invoice_refs();

create or replace function app_private.validate_card_current_invoice()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.current_invoice_id is not null and not exists
    (select 1 from public.invoices i where i.id=new.current_invoice_id
      and i.card_id=new.id and i.user_id=new.user_id) then
    raise exception 'current_invoice_id must refer to this card and owner' using errcode='23503';
  end if;
  return new;
end $$;
revoke all on function app_private.validate_card_current_invoice() from public, anon, authenticated, service_role;
create trigger cards_validate_current_invoice before insert or update of current_invoice_id,user_id on public.cards
  for each row execute function app_private.validate_card_current_invoice();

create or replace function app_private.clear_current_invoice_on_manual_edit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.invoice is distinct from old.invoice
    and current_setting('app.importing_invoice',true) is distinct from 'on'
    and current_setting('app.syncing_transaction',true) is distinct from 'on'
    and current_setting('app.deleting_invoice',true) is distinct from 'on' then
    new.current_invoice_id := null;
  end if;
  return new;
end $$;
revoke all on function app_private.clear_current_invoice_on_manual_edit() from public, anon, authenticated, service_role;
create trigger cards_clear_current_invoice before update of invoice on public.cards
  for each row execute function app_private.clear_current_invoice_on_manual_edit();

create or replace function app_private.sync_transaction_totals()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='INSERT' then
    update public.profiles set balance=balance-new.value where id=new.user_id;
    if new.source='manual' and new.card_id is not null then
      perform set_config('app.syncing_transaction','on',true);
      update public.cards set invoice=invoice+new.value where id=new.card_id and user_id=new.user_id;
      perform set_config('app.syncing_transaction','off',true);
    end if;
    return new;
  elsif tg_op='UPDATE' then
    if old.user_id=new.user_id then
      update public.profiles set balance=balance+old.value-new.value where id=new.user_id;
    else
      update public.profiles set balance=balance+old.value where id=old.user_id;
      update public.profiles set balance=balance-new.value where id=new.user_id;
    end if;
    if old.source='manual' and old.card_id is not null then
      perform set_config('app.syncing_transaction','on',true);
      update public.cards set invoice=greatest(0,invoice-old.value) where id=old.card_id and user_id=old.user_id;
      perform set_config('app.syncing_transaction','off',true);
    elsif old.source='invoice' and old.card_id is not null
       and current_setting('app.importing_invoice',true) is distinct from 'on'
       and current_setting('app.deleting_invoice',true) is distinct from 'on'
       and exists(select 1 from public.cards c where c.id=old.card_id and c.current_invoice_id=old.invoice_id) then
      perform set_config('app.syncing_transaction','on',true);
      update public.cards set invoice=greatest(0,invoice-old.value) where id=old.card_id and user_id=old.user_id;
      perform set_config('app.syncing_transaction','off',true);
    end if;
    if new.source='manual' and new.card_id is not null then
      perform set_config('app.syncing_transaction','on',true);
      update public.cards set invoice=invoice+new.value where id=new.card_id and user_id=new.user_id;
      perform set_config('app.syncing_transaction','off',true);
    elsif new.source='invoice' and new.card_id is not null
       and current_setting('app.importing_invoice',true) is distinct from 'on'
       and current_setting('app.deleting_invoice',true) is distinct from 'on'
       and exists(select 1 from public.cards c where c.id=new.card_id and c.current_invoice_id=new.invoice_id) then
      perform set_config('app.syncing_transaction','on',true);
      update public.cards set invoice=invoice+new.value where id=new.card_id and user_id=new.user_id;
      perform set_config('app.syncing_transaction','off',true);
    end if;
    return new;
  else
    update public.profiles set balance=balance+old.value where id=old.user_id;
    if old.source='manual' and old.card_id is not null then
      perform set_config('app.syncing_transaction','on',true);
      update public.cards set invoice=greatest(0,invoice-old.value) where id=old.card_id and user_id=old.user_id;
      perform set_config('app.syncing_transaction','off',true);
    elsif old.source='invoice' and old.card_id is not null
       and current_setting('app.importing_invoice',true) is distinct from 'on'
       and current_setting('app.deleting_invoice',true) is distinct from 'on'
       and exists(select 1 from public.cards c where c.id=old.card_id and c.current_invoice_id=old.invoice_id) then
      perform set_config('app.syncing_transaction','on',true);
      update public.cards set invoice=greatest(0,invoice-old.value) where id=old.card_id and user_id=old.user_id;
      perform set_config('app.syncing_transaction','off',true);
    end if;
    return old;
  end if;
end $$;
revoke all on function app_private.sync_transaction_totals() from public, anon, authenticated, service_role;
create trigger transactions_sync_totals after insert or update or delete on public.transactions
  for each row execute function app_private.sync_transaction_totals();

create or replace function app_private.guard_goal_saved()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.saved is distinct from old.saved and current_setting('app.goal_contribution_sync',true) is distinct from 'on' then
    raise exception 'saved is derived from goal_contributions' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function app_private.guard_goal_saved() from public, anon, authenticated, service_role;
create trigger goals_guard_saved before update of saved on public.goals
  for each row execute function app_private.guard_goal_saved();

create or replace function app_private.sync_goal_contribution()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' or tg_op='DELETE' then
    perform set_config('app.goal_contribution_sync','on',true);
    update public.goals set saved=greatest(0,saved-old.amount) where id=old.goal_id and user_id=old.user_id;
    perform set_config('app.goal_contribution_sync','off',true);
    update public.profiles set balance=balance+old.amount where id=old.user_id;
  end if;
  if tg_op='INSERT' or tg_op='UPDATE' then
    if not exists (select 1 from public.goals g where g.id=new.goal_id and g.user_id=new.user_id) then
      raise exception 'goal must belong to the same user as the contribution' using errcode='23503';
    end if;
    update public.profiles set balance=balance-new.amount where id=new.user_id and balance>=new.amount;
    if not found then raise exception 'insufficient available balance' using errcode='23514'; end if;
    perform set_config('app.goal_contribution_sync','on',true);
    update public.goals set saved=saved+new.amount where id=new.goal_id and user_id=new.user_id;
    perform set_config('app.goal_contribution_sync','off',true);
    return new;
  end if;
  return old;
end $$;
revoke all on function app_private.sync_goal_contribution() from public, anon, authenticated, service_role;
create trigger goal_contributions_sync_totals after insert or update or delete on public.goal_contributions
  for each row execute function app_private.sync_goal_contribution();

create or replace function app_private.prepare_invoice_delete()
returns trigger language plpgsql set search_path = '' as $$
declare v_previous public.invoices%rowtype;
begin
  if old.card_id is not null and exists
    (select 1 from public.cards c where c.id=old.card_id and c.current_invoice_id=old.id) then
    select * into v_previous from public.invoices i where i.card_id=old.card_id and i.id<>old.id
      order by i.created_at desc limit 1;
    perform set_config('app.deleting_invoice','on',true);
    update public.cards set invoice=coalesce(v_previous.total,0),current_invoice_id=v_previous.id
      where id=old.card_id and user_id=old.user_id;
  end if;
  return old;
end $$;
revoke all on function app_private.prepare_invoice_delete() from public, anon, authenticated, service_role;
create trigger invoices_prepare_delete before delete on public.invoices
  for each row execute function app_private.prepare_invoice_delete();

create or replace function app_private.finish_invoice_delete()
returns trigger language plpgsql set search_path = '' as $$
begin perform set_config('app.deleting_invoice','off',true); return old; end $$;
revoke all on function app_private.finish_invoice_delete() from public, anon, authenticated, service_role;
create trigger invoices_finish_delete after delete on public.invoices
  for each row execute function app_private.finish_invoice_delete();

create trigger profiles_set_updated_at before update on public.profiles for each row execute function app_private.set_updated_at();
create trigger cards_set_updated_at before update on public.cards for each row execute function app_private.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions for each row execute function app_private.set_updated_at();
create trigger budgets_set_updated_at before update on public.budgets for each row execute function app_private.set_updated_at();
create trigger goals_set_updated_at before update on public.goals for each row execute function app_private.set_updated_at();
create trigger goal_contributions_set_updated_at before update on public.goal_contributions for each row execute function app_private.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices for each row execute function app_private.set_updated_at();

-- User-scoped, idempotent invoice import. It validates card ownership, data,
-- size and file path; the transaction and card total commit atomically.
create or replace function public.import_invoice(
  p_fingerprint text, p_card_id uuid, p_file_name text, p_file_mime_type text,
  p_file_size_bytes bigint, p_storage_path text, p_total numeric, p_items jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid:=auth.uid(); v_invoice_id uuid; v_item jsonb; v_count integer; v_subscriptions integer;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_fingerprint is null or length(p_fingerprint) not between 1 and 128 then raise exception 'invalid fingerprint' using errcode='22023'; end if;
  if p_total is null or p_total<0 then raise exception 'invalid total' using errcode='22023'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>300 then raise exception 'invalid invoice items' using errcode='22023'; end if;
  if not exists(select 1 from public.cards c where c.id=p_card_id and c.user_id=v_user_id) then raise exception 'card ownership mismatch' using errcode='23503'; end if;
  if p_file_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') or p_file_size_bytes is null or p_file_size_bytes not between 1 and 3145728 then raise exception 'invalid file type or size' using errcode='22023'; end if;
  if p_storage_path is not null and p_storage_path not like v_user_id::text||'/invoices/%' then raise exception 'invalid storage path' using errcode='42501'; end if;

  select count(*)::int,count(*) filter(where coalesce((value->>'subscription')::boolean,false))::int
    into v_count,v_subscriptions from jsonb_array_elements(p_items);
  insert into public.invoices(user_id,card_id,fingerprint,file_name,file_mime_type,file_size_bytes,storage_path,total,items_count,subscriptions_count)
    values(v_user_id,p_card_id,p_fingerprint,left(coalesce(p_file_name,'fatura'),180),p_file_mime_type,p_file_size_bytes,p_storage_path,p_total,v_count,v_subscriptions)
    on conflict (user_id,fingerprint) do nothing returning id into v_invoice_id;
  if v_invoice_id is null then
    select id into v_invoice_id from public.invoices where user_id=v_user_id and fingerprint=p_fingerprint;
    return v_invoice_id;
  end if;

  perform set_config('app.importing_invoice','on',true);
  for v_item in select value from jsonb_array_elements(p_items) loop
    if nullif(btrim(v_item->>'name'),'') is null or (v_item->>'value') is null or (v_item->>'value')::numeric<=0
       or (v_item->>'category') not in ('moradia','alimentacao','transporte','lazer','saude','outros') then
      raise exception 'invalid invoice item' using errcode='22023';
    end if;
    insert into public.transactions(user_id,name,category,card_id,method,value,spent_on,source,invoice_id,subscription)
    values(v_user_id,left(btrim(v_item->>'name'),120),v_item->>'category',p_card_id,'card',
      (v_item->>'value')::numeric,(v_item->>'date')::date,'invoice',v_invoice_id,coalesce((v_item->>'subscription')::boolean,false));
  end loop;
  update public.cards set invoice=p_total,current_invoice_id=v_invoice_id where id=p_card_id and user_id=v_user_id;
  perform set_config('app.importing_invoice','off',true);
  return v_invoice_id;
end $$;
revoke all on function public.import_invoice(text,uuid,text,text,bigint,text,numeric,jsonb) from public,anon;
grant execute on function public.import_invoice(text,uuid,text,text,bigint,text,numeric,jsonb) to authenticated;

-- Private fixture copy. It is not inserted into any of the 10 existing Auth
-- accounts; loading mock records requires an explicit, empty-account RPC in a
-- later application flow.
create table app_private.demo_seed_templates(id text primary key,payload jsonb not null,created_at timestamptz not null default now());
revoke all on table app_private.demo_seed_templates from public,anon,authenticated,service_role;
alter table app_private.demo_seed_templates enable row level security;
insert into app_private.demo_seed_templates(id,payload) values('eskgo-finances-v1',$fixture$
{
  "balance":14500,"monthCap":3200,"lastMonthTotal":2660,"hideBalance":false,"plus":true,
  "budgets":{"moradia":1200,"alimentacao":1200,"transporte":1000,"lazer":400,"saude":300,"outros":300},
  "cards":[
    {"key":"viagem","name":"Viagem","last4":"1180","color":"offwhite","limit":2000,"invoice":98,"dueDays":27},
    {"key":"salario","name":"Salário","last4":"6917","color":"lilac","limit":2500,"invoice":640,"dueDays":12},
    {"key":"principal","name":"Principal","last4":"4552","color":"gradient","limit":3000,"invoice":1284,"dueDays":8}
  ],
  "transactions":[
    {"name":"Mercado","category":"alimentacao","method":"principal","dateRule":"today","value":260},
    {"name":"Restaurante","category":"alimentacao","method":"principal","dateRule":"yesterday","value":480},
    {"name":"Uber","category":"transporte","method":"salario","dateRule":"day-8","value":400},
    {"name":"Aluguel","category":"moradia","method":"pix","dateRule":"day-1","value":1200}
  ],
  "goals":[
    {"key":"g1","name":"Viagem ao Japão","saved":13600,"target":20000,"date":"Dez 2027","icon":"plane"},
    {"key":"g2","name":"Reserva","saved":7200,"target":10000,"icon":"shield"},
    {"key":"g3","name":"Curso","saved":2700,"target":3000,"icon":"book"},
    {"key":"g4","name":"Carro novo","saved":9600,"target":40000,"icon":"car"}
  ]
}
$fixture$::jsonb) on conflict(id) do nothing;

-- The demo can be copied only by an explicit call from a signed-in user, and
-- only into an account with no financial records. It never seeds existing users.
create or replace function public.seed_my_demo_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_data jsonb;
  v_item jsonb;
  v_card_ids jsonb := '{}'::jsonb;
  v_card_id uuid;
  v_goal_id uuid;
  v_method text;
  v_date date;
  v_card_spend numeric;
  v_tx_total numeric;
  v_goal_total numeric;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.cards where user_id = v_user)
     or exists (select 1 from public.transactions where user_id = v_user)
     or exists (select 1 from public.goals where user_id = v_user)
     or exists (select 1 from public.invoices where user_id = v_user)
     or exists (select 1 from public.budgets where user_id = v_user) then
    raise exception 'demo data is only available for an empty account' using errcode = '23505';
  end if;
  select payload into v_data from app_private.demo_seed_templates where id = 'eskgo-finances-v1';
  if v_data is null then raise exception 'demo fixture is unavailable'; end if;
  select coalesce(sum((item->>'value')::numeric),0) into v_tx_total
    from jsonb_array_elements(v_data->'transactions') as rows(item);
  select coalesce(sum((item->>'saved')::numeric),0) into v_goal_total
    from jsonb_array_elements(v_data->'goals') as rows(item);

  update public.profiles set balance=(v_data->>'balance')::numeric+v_tx_total+v_goal_total,
    month_cap=(v_data->>'monthCap')::numeric, last_month_total=(v_data->>'lastMonthTotal')::numeric,
    hide_balance=coalesce((v_data->>'hideBalance')::boolean,false), plus=coalesce((v_data->>'plus')::boolean,false)
    where id=v_user;
  if not found then raise exception 'profile is not initialized'; end if;

  for v_item in select jsonb_build_object('key',key,'value',value) from jsonb_each(v_data->'budgets') loop
    insert into public.budgets(user_id,category,cap) values(v_user,v_item->>'key',(v_item->>'value')::numeric);
  end loop;
  for v_item in select value from jsonb_array_elements(v_data->'cards') loop
    v_card_id := gen_random_uuid();
    v_card_ids := v_card_ids || jsonb_build_object(v_item->>'key',v_card_id::text);
    select coalesce(sum((item->>'value')::numeric),0) into v_card_spend
      from jsonb_array_elements(v_data->'transactions') as rows(item) where item->>'method'=v_item->>'key';
    insert into public.cards(id,user_id,name,last4,color,credit_limit,invoice,due_day)
      values(v_card_id,v_user,v_item->>'name',v_item->>'last4',v_item->>'color',
        (v_item->>'limit')::numeric,greatest(0,(v_item->>'invoice')::numeric-v_card_spend),(v_item->>'dueDays')::smallint);
  end loop;
  for v_item in select value from jsonb_array_elements(v_data->'goals') loop
    v_goal_id := gen_random_uuid();
    insert into public.goals(id,user_id,name,target,saved,target_label,icon)
      values(v_goal_id,v_user,v_item->>'name',(v_item->>'target')::numeric,0,v_item->>'date',v_item->>'icon');
    insert into public.goal_contributions(user_id,goal_id,amount)
      values(v_user,v_goal_id,(v_item->>'saved')::numeric);
  end loop;
  for v_item in select value from jsonb_array_elements(v_data->'transactions') loop
    v_method := v_item->>'method'; v_card_id := null;
    if v_method not in ('pix','dinheiro') then v_card_id := (v_card_ids->>v_method)::uuid; v_method := 'card'; end if;
    v_date := case v_item->>'dateRule'
      when 'today' then current_date when 'yesterday' then current_date-1
      when 'day-1' then date_trunc('month',current_date)::date
      when 'day-8' then date_trunc('month',current_date)::date+7 else current_date end;
    insert into public.transactions(user_id,name,category,card_id,method,value,spent_on,source)
      values(v_user,v_item->>'name',v_item->>'category',v_card_id,v_method,(v_item->>'value')::numeric,v_date,'manual');
  end loop;
  update public.profiles set front_card_id=(v_card_ids->>'principal')::uuid where id=v_user;
  return jsonb_build_object('cards',3,'transactions',4,'goals',4,'budgets',6);
end;
$$;
revoke all on function public.seed_my_demo_data() from public,anon,service_role;
grant execute on function public.seed_my_demo_data() to authenticated;

-- Invoice documents are private, limited to the types and size accepted by the UI.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('invoice-files','invoice-files',false,3145728,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy invoice_files_select_own on storage.objects for select to authenticated
  using(bucket_id='invoice-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy invoice_files_insert_own on storage.objects for insert to authenticated
  with check(bucket_id='invoice-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy invoice_files_update_own on storage.objects for update to authenticated
  using(bucket_id='invoice-files' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check(bucket_id='invoice-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy invoice_files_delete_own on storage.objects for delete to authenticated
  using(bucket_id='invoice-files' and (storage.foldername(name))[1]=(select auth.uid())::text);

commit;
