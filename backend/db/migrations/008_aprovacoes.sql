-- Etapa 3: aprovação das publicações agendadas pelo cliente.
--
-- Regras:
-- - Publicação AGENDADA nasce com aprovacao = 'pendente'.
-- - Publicar agora não passa por aprovação (aprovacao fica nula).
-- - Sem resposta até o horário, publica.
-- - Indeferida não é publicada: status vira 'recusada'.
-- - O cliente (ou a equipe, em nome dele) pode mudar a resposta até o
--   horário da publicação.
--
-- Execute no SQL Editor do Supabase. Pode ser executada mais de uma vez.

alter table publicacoes
  add column if not exists aprovacao text,
  add column if not exists aprovacao_por bigint references usuarios(id) on delete set null,
  add column if not exists aprovacao_pela_equipe boolean not null default false,
  add column if not exists aprovacao_em timestamptz,
  add column if not exists aprovacao_categoria text,
  add column if not exists aprovacao_motivo text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'publicacoes'::regclass and conname = 'publicacoes_aprovacao_check'
  ) then
    alter table publicacoes
      add constraint publicacoes_aprovacao_check
      check (aprovacao is null or aprovacao in ('pendente', 'deferida', 'indeferida'));
  end if;
end $$;

-- Se a coluna `status` tiver uma regra (check) com a lista de valores,
-- ela é refeita incluindo 'recusada'. Sem regra, nada muda.
do $$
declare
  r record;
  havia_regra boolean := false;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'publicacoes'::regclass
      and contype = 'c'
      and conname <> 'publicacoes_aprovacao_check'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table publicacoes drop constraint %I', r.conname);
    havia_regra := true;
  end loop;

  if havia_regra then
    alter table publicacoes
      add constraint publicacoes_status_check
      check (status in ('rascunho', 'agendada', 'publicando', 'publicada', 'erro', 'recusada')) not valid;
  end if;
end $$;

create index if not exists publicacoes_aprovacao_pendente_idx
  on publicacoes (data_hora)
  where aprovacao = 'pendente';

notify pgrst, 'reload schema';
