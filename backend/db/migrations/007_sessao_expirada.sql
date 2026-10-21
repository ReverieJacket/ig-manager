-- Perfis do Instagram: marca quando a sessão salva deixou de funcionar.
-- Execute no Supabase (SQL Editor) depois da 006. Pode ser executado mais de uma vez.
--
-- Quando uma publicação falha porque o Instagram pediu login de novo, o
-- backend preenche estas colunas e o perfil aparece como "Sessão expirada"
-- (tela Clientes, tela Criar e aviso em Postagens). Ao reconectar, elas
-- voltam a ficar vazias.

alter table contas_instagram
  add column if not exists sessao_expirada_em timestamptz,
  add column if not exists sessao_erro text;
