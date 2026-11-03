-- Lista salva da aba Prospecção (antes só no localStorage do navegador).
create table public.prospect_shortlist (
  user_login text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.prospect_shortlist enable row level security;
create policy "Allow all for allowed users" on public.prospect_shortlist
  for all using (is_allowed_user()) with check (is_allowed_user());

-- Rollback:
-- drop table public.prospect_shortlist;
