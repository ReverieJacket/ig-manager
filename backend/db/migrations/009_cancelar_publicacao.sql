-- Cancelamento de publicações pelo administrador.
--
-- A publicação não é apagada: o status vira 'cancelada' e fica registrado
-- quem cancelou e quando. Só agendadas ou recusadas podem ser canceladas.
--
-- Execute no SQL Editor do Supabase (depois da 008). Pode ser executada
-- mais de uma vez.

alter table publicacoes
  add column if not exists cancelada_por bigint references usuarios(id) on delete set null,
  add column if not exists cancelada_em timestamptz;

-- Se a coluna `status` tiver uma regra (check) com a lista de valores,
-- ela é refeita incluindo 'cancelada'. Sem regra, nada muda.
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
      check (status in ('rascunho', 'agendada', 'publicando', 'publicada', 'erro', 'recusada', 'cancelada')) not valid;
  end if;
end $$;

notify pgrst, 'reload schema';
