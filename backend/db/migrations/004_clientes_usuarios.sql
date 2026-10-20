-- Perfis de acesso: clientes e usuários (administrador / cliente).
-- Execute no Supabase (SQL Editor) ANTES de subir o backend desta versão.
-- Pode ser executado mais de uma vez.

-- 1) Clientes ---------------------------------------------------------------
-- Até aqui o cliente era só um texto em `contas_instagram.cliente`.
-- Agora vira uma tabela, para que usuários e contas apontem para o mesmo
-- registro (base para o cliente enxergar apenas o que é dele).
create table if not exists clientes (
  id        bigint generated always as identity primary key,
  nome      text not null check (char_length(trim(nome)) between 1 and 120),
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

-- "Padaria X" e "padaria x " são o mesmo cliente.
create unique index if not exists clientes_nome_unico_idx
  on clientes (lower(trim(nome)));

-- Cria os clientes a partir dos nomes que já existem nas contas e convites.
insert into clientes (nome)
select distinct on (lower(trim(nome))) trim(nome)
from (
  select cliente as nome from contas_instagram
  union all
  select cliente from convites_contas_instagram
) existentes
where nome is not null and trim(nome) <> ''
on conflict do nothing;

-- 2) Vínculo das contas e convites com o cliente ----------------------------
-- A coluna de texto `cliente` é mantida por enquanto (compatibilidade);
-- o vínculo oficial passa a ser `cliente_id`.
alter table contas_instagram
  add column if not exists cliente_id bigint references clientes(id);

update contas_instagram c
set cliente_id = cl.id
from clientes cl
where c.cliente_id is null
  and lower(trim(c.cliente)) = lower(trim(cl.nome));

create index if not exists contas_instagram_cliente_idx
  on contas_instagram (cliente_id);

alter table convites_contas_instagram
  add column if not exists cliente_id bigint references clientes(id);

update convites_contas_instagram c
set cliente_id = cl.id
from clientes cl
where c.cliente_id is null
  and lower(trim(c.cliente)) = lower(trim(cl.nome));

-- 3) Usuários ---------------------------------------------------------------
create table if not exists usuarios (
  id            bigint generated always as identity primary key,
  nome          text not null check (char_length(trim(nome)) between 1 and 120),
  -- Sempre gravado em minúsculas e sem espaços (o backend normaliza).
  email         text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  -- Hash scrypt gerado pelo backend; a senha em si nunca é armazenada.
  senha_hash    text not null,
  perfil        text not null check (perfil in ('admin', 'cliente')),
  cliente_id    bigint references clientes(id),
  ativo         boolean not null default true,
  ultimo_acesso timestamptz,
  criado_em     timestamptz not null default now(),
  constraint usuarios_email_unico unique (email),
  -- Usuário cliente SEMPRE pertence a um cliente; administrador, nunca.
  constraint usuarios_perfil_cliente check ((perfil = 'cliente') = (cliente_id is not null))
);

create index if not exists usuarios_cliente_idx on usuarios (cliente_id);

-- Acesso somente pelo backend (service role), como nas demais tabelas.
alter table clientes enable row level security;
alter table usuarios enable row level security;
