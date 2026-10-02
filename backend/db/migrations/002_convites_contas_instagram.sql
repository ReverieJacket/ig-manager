-- Convites de uso único para cadastro de contas do Instagram.
-- Execute no SQL Editor do Supabase antes de usar a funcionalidade.
create table if not exists public.convites_contas_instagram (
  id bigint generated always as identity primary key,
  cliente text not null check (char_length(trim(cliente)) between 1 and 120),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists convites_contas_instagram_expiracao_idx
  on public.convites_contas_instagram (expires_at);

alter table public.convites_contas_instagram enable row level security;
-- A tabela deve ser acessada somente pelo backend usando a service role.
