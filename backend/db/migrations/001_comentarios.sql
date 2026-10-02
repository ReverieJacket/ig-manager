-- Comentários de publicações do Instagram.
-- Execute no Supabase (SQL Editor). Pode ser executado mais de uma vez.

-- 1) Dados extras na publicação -------------------------------------------
alter table publicacoes
  add column if not exists ig_codigo text,                       -- instagram.com/p/<ig_codigo>/
  add column if not exists comentarios_total integer not null default 0,
  add column if not exists comentarios_atualizado_em timestamptz;

-- 2) Comentários ------------------------------------------------------------
create table if not exists comentarios_instagram (
  id                    bigint generated always as identity primary key,
  publicacao_id         bigint not null references publicacoes(id) on delete cascade,
  conta_id              bigint not null references contas_instagram(id),
  ig_comentario_id      text   not null,                  -- id do link /c/<id>/
  autor_username        text   not null,
  texto                 text   not null,
  oculto                boolean not null default false,   -- "Hidden by Instagram"
  publicado_em          timestamptz not null,             -- data do comentário no Instagram
  primeira_vez_visto_em timestamptz not null default now(),
  ultima_vez_visto_em   timestamptz not null default now(),
  removido_em           timestamptz,                      -- quando se detectou que sumiu
  unique (publicacao_id, ig_comentario_id)
);

create index if not exists comentarios_publicacao_data_idx
  on comentarios_instagram (publicacao_id, publicado_em desc);

create index if not exists comentarios_conta_data_idx
  on comentarios_instagram (conta_id, publicado_em desc);

-- Dados de terceiros: sem políticas, só a service role (backend) acessa.
alter table comentarios_instagram enable row level security;
