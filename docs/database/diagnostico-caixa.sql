-- Somente leitura. Executar após a migration do resumo, no SQL Editor do Supabase.
-- Não chama a função como administrador nem consulta os dados dos usuários.
select
  p.oid is not null as funcao_existe,
  coalesce(not p.prosecdef, false) as usa_permissoes_do_usuario,
  coalesce(p.provolatile = 's', false) as somente_leitura_stable,
  p.proconfig as configuracao,
  coalesce(has_function_privilege('anon', p.oid, 'EXECUTE'), false) as anon_pode_executar,
  coalesce(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) as authenticated_pode_executar,
  coalesce(has_function_privilege('service_role', p.oid, 'EXECUTE'), false) as service_role_pode_executar,
  (
    select count(*) from pg_catalog.pg_indexes
    where schemaname = 'public' and indexname in ('financeiro_obra_projeto_id_desc_idx')
  ) as indices_criados
from (select to_regprocedure('public.pagina_caixa(bigint,integer)') as oid) alvo
left join pg_catalog.pg_proc p on p.oid = alvo.oid;
