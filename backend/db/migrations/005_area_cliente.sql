-- Área do cliente: senha temporária, encerramento de sessões e autoria das contas.
-- Execute no Supabase (SQL Editor) depois da 004. Pode ser executado mais de uma vez.

-- 1) Usuários ----------------------------------------------------------------
alter table usuarios
  -- true = o usuário entrou com senha gerada pelo admin e precisa criar a dele.
  add column if not exists senha_temporaria boolean not null default false,
  -- Aumenta a cada troca de senha/e-mail/desativação: tokens antigos deixam
  -- de valer e as sessões abertas em outros aparelhos são encerradas.
  add column if not exists sessao_versao integer not null default 1;

-- 2) Contas do Instagram: quem cadastrou e quando ------------------------------
alter table contas_instagram
  add column if not exists cadastrada_por bigint references usuarios(id),
  add column if not exists cadastrada_em timestamptz;

-- Só as contas novas recebem a data (as antigas ficam sem, em vez de "hoje").
alter table contas_instagram
  alter column cadastrada_em set default now();
