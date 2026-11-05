-- Retomar publicações que ficaram SEM RESPOSTA do cliente até o horário
-- ("prazo esgotado"). Por até 30 dias, o cliente ou o administrador (em
-- nome dele) pode publicar agora ou agendar de novo; fica registrado
-- quem retomou e quando.
--
-- Execute no SQL Editor do Supabase (depois da 009). Pode ser executada
-- mais de uma vez.

alter table publicacoes
  add column if not exists retomada_por bigint references usuarios(id) on delete set null,
  add column if not exists retomada_pela_equipe boolean not null default false,
  add column if not exists retomada_em timestamptz,
  add column if not exists horario_original timestamptz;

notify pgrst, 'reload schema';
