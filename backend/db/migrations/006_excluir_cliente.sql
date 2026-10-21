-- Exclusão definitiva de um cliente (lixeira da tela "Clientes").
-- Execute no Supabase (SQL Editor) depois da 005. Pode ser executado mais de uma vez.
--
-- Apaga, numa única transação (tudo ou nada):
--   - as contas do Instagram do cliente,
--   - os usuários de acesso dele,
--   - os convites gerados para ele,
--   - o próprio cliente.
-- É BLOQUEADA se alguma conta do cliente já tiver publicações: o histórico é
-- preservado e, nesse caso, o caminho é desativar o cliente.
-- (Comentários e curtidas sempre pertencem a uma publicação, então também
-- ficam protegidos por esse bloqueio.)

create or replace function excluir_cliente(p_cliente_id bigint)
returns table (contas_excluidas bigint[], usuarios_excluidos integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_conta_com_posts text;
  v_contas bigint[];
  v_usuarios integer;
begin
  if not exists (select 1 from clientes where id = p_cliente_id) then
    raise exception 'CLIENTE_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  select c.username into v_conta_com_posts
  from contas_instagram c
  where c.cliente_id = p_cliente_id
    and exists (select 1 from publicacoes p where p.conta_id = c.id)
  limit 1;

  if v_conta_com_posts is not null then
    raise exception 'CONTA_COM_PUBLICACOES:%', v_conta_com_posts using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id order by id), '{}') into v_contas
  from contas_instagram where cliente_id = p_cliente_id;

  delete from contas_instagram where cliente_id = p_cliente_id;

  -- Por segurança: contas de outros clientes que um destes usuários tenha
  -- cadastrado perdem só a autoria (a conta continua).
  update contas_instagram set cadastrada_por = null
  where cadastrada_por in (select id from usuarios where cliente_id = p_cliente_id);

  delete from usuarios where cliente_id = p_cliente_id;
  get diagnostics v_usuarios = row_count;

  delete from convites_contas_instagram where cliente_id = p_cliente_id;
  delete from clientes where id = p_cliente_id;

  return query select v_contas, v_usuarios;
end;
$$;

-- Só o backend (service role) pode chamar. Sem isto, qualquer um com a
-- chave pública do Supabase conseguiria executar a função pela API.
revoke all on function excluir_cliente(bigint) from public, anon, authenticated;
grant execute on function excluir_cliente(bigint) to service_role;
