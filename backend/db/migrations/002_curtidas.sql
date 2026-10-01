-- Curtidas das publicações do Instagram.
-- Execute no Supabase (SQL Editor) depois de 001_comentarios.sql.
-- Pode ser executado mais de uma vez.

-- 1) Valor mais recente, na própria publicação (leitura rápida na listagem).
alter table publicacoes
  add column if not exists curtidas integer,                       -- null = nunca lido / oculto
  add column if not exists curtidas_aproximado boolean not null default false,
  add column if not exists curtidas_atualizado_em timestamptz;

-- 2) Histórico: uma linha por coleta, para acompanhar a evolução.
create table if not exists curtidas_historico (
  id            bigint generated always as identity primary key,
  publicacao_id bigint not null references publicacoes(id) on delete cascade,
  conta_id      bigint not null references contas_instagram(id),
  curtidas      integer not null,
  aproximado    boolean not null default false,   -- "1,2 mil" não revela o valor exato
  coletado_em   timestamptz not null default now()
);

create index if not exists curtidas_historico_publicacao_idx
  on curtidas_historico (publicacao_id, coletado_em desc);

alter table curtidas_historico enable row level security;
