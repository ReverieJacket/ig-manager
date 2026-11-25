-- Espaços: cada administrador que se cadastra pelo Publicador ganha o próprio
-- espaço, com os próprios clientes, perfis, postagens e Publicador. Um
-- administrador só enxerga o espaço dele; para dividir o trabalho, ele cria
-- outro administrador no mesmo espaço (site → Equipe).
--
-- Tudo o que já existe vai para um espaço só (o primeiro).
--
-- Execute no SQL Editor do Supabase (depois da 011). Pode ser executada
-- mais de uma vez.

set lock_timeout = '10s';

create table if not exists espacos (
  id        bigint generated always as identity primary key,
  nome      text not null check (char_length(trim(nome)) between 1 and 120),
  criado_em timestamptz not null default now()
);

alter table espacos enable row level security;

-- Espaço dos dados atuais.
insert into espacos (nome)
select 'IG Manager'
where not exists (select 1 from espacos);

-- espaco_id em cada tabela, preenchido com o primeiro espaço.
do $$
declare
  t text;
  primeiro bigint;
begin
  select min(id) into primeiro from espacos;

  foreach t in array array[
    'usuarios', 'clientes', 'contas_instagram', 'convites_contas_instagram',
    'publicacoes', 'tarefas_automacao'
  ] loop
    execute format('alter table %I add column if not exists espaco_id bigint references espacos(id)', t);
    execute format('update %I set espaco_id = %s where espaco_id is null', t, primeiro);
    execute format('alter table %I alter column espaco_id set not null', t);
    execute format('create index if not exists %I on %I (espaco_id)', t || '_espaco_idx', t);
  end loop;
end $$;

-- O nome do cliente passa a ser único dentro de cada espaço.
drop index if exists clientes_nome_unico_idx;
create unique index if not exists clientes_espaco_nome_unico_idx
  on clientes (espaco_id, lower(trim(nome)));

-- Sinal de vida do Publicador: um por espaço.
create table if not exists publicadores (
  espaco_id    bigint primary key references espacos(id) on delete cascade,
  ultimo_sinal timestamptz,
  iniciado_em  timestamptz,
  maquina      text,
  versao       text
);

alter table publicadores enable row level security;

insert into publicadores (espaco_id, ultimo_sinal, iniciado_em, maquina, versao)
select (select min(id) from espacos), ultimo_sinal, iniciado_em, maquina, versao
from publicador_estado
where id = 1
on conflict (espaco_id) do nothing;

notify pgrst, 'reload schema';
