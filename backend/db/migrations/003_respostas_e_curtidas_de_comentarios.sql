-- Respostas a comentários e curtidas de cada comentário.
-- Execute no Supabase (SQL Editor) depois de 001 e 002. Pode ser executado mais de uma vez
-- (inclusive se uma versão anterior deste arquivo já foi executada).

alter table comentarios_instagram
  -- null = comentário principal; preenchido = resposta (id do comentário pai no Instagram).
  add column if not exists ig_comentario_pai_id text,
  -- Nome (sem @) de quem foi respondido, para ler o registro sem procurar o pai.
  add column if not exists resposta_a_username text,
  add column if not exists curtidas integer not null default 0,           -- o Instagram não mostra o contador quando é 0
  add column if not exists curtidas_aproximado boolean not null default false;  -- "1,2 mil" não revela o valor exato

-- Indicador explícito: true quando o registro é uma resposta. É uma coluna
-- calculada pelo banco a partir do pai, então nunca fica fora de sincronia.
alter table comentarios_instagram
  add column if not exists eh_resposta boolean
  generated always as (ig_comentario_pai_id is not null) stored;

-- Busca das respostas de um comentário.
create index if not exists comentarios_pai_idx
  on comentarios_instagram (publicacao_id, ig_comentario_pai_id);
