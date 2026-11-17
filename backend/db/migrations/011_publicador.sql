-- Site 24h (Vercel) + Publicador (app no computador do administrador).
--
-- - status 'atrasada': publicação aprovada cujo horário passou com o
--   Publicador desligado. Não sai sozinha: o administrador escolhe
--   "Publicar agora" ou "Reagendar".
-- - contas_instagram.sessao_salva_em: o Publicador informa aqui quando o
--   perfil tem sessão salva no computador dele (o site não vê o disco).
-- - tarefas_automacao: pedidos do site para o Publicador (conectar,
--   desconectar, coletar comentários).
-- - publicador_estado: "sinal de vida" do Publicador (online/offline).
-- - bucket 'publicacoes' no Storage: imagens das postagens.
--
-- Execute no SQL Editor do Supabase (depois da 010). Pode ser executada
-- mais de uma vez.

set lock_timeout = '10s';

alter table contas_instagram
  add column if not exists sessao_salva_em timestamptz;

-- Refaz a regra de valores do `status` incluindo 'atrasada'.
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'publicacoes'::regclass
      and contype = 'c'
      and conname <> 'publicacoes_aprovacao_check'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table publicacoes drop constraint %I', r.conname);
  end loop;

  alter table publicacoes
    add constraint publicacoes_status_check
    check (status in ('rascunho', 'agendada', 'publicando', 'publicada', 'erro',
                      'recusada', 'cancelada', 'atrasada')) not valid;
end $$;

create table if not exists tarefas_automacao (
  id bigserial primary key,
  tipo text not null check (tipo in ('conectar', 'desconectar', 'coletar_comentarios')),
  conta_id bigint,
  publicacao_id bigint,
  status text not null default 'pendente'
    check (status in ('pendente', 'executando', 'concluida', 'erro')),
  mensagem text,
  resultado jsonb,
  criada_em timestamptz not null default now(),
  iniciada_em timestamptz,
  concluida_em timestamptz
);

create index if not exists tarefas_automacao_pendentes
  on tarefas_automacao (status, criada_em);

create table if not exists publicador_estado (
  id smallint primary key default 1 check (id = 1),
  ultimo_sinal timestamptz,
  iniciado_em timestamptz,
  maquina text,
  versao text
);

insert into publicador_estado (id) values (1) on conflict (id) do nothing;

-- Só o backend (chave service role) acessa estas tabelas.
alter table tarefas_automacao enable row level security;
alter table publicador_estado enable row level security;

-- Bucket privado das imagens (o site gera links temporários).
insert into storage.buckets (id, name, public)
values ('publicacoes', 'publicacoes', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
