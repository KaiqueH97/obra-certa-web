-- Somente metadados; duas linhas esperadas, sem acessar dados dos usuários.
select alvo.assinatura, p.oid is not null as funcao_existe,
  coalesce(not p.prosecdef, false) as usa_permissoes_do_usuario,
  coalesce(p.provolatile = 's', false) as somente_leitura_stable,
  p.proconfig as configuracao,
  coalesce(has_function_privilege('anon', p.oid, 'EXECUTE'), false) as anon_pode_executar,
  coalesce(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) as authenticated_pode_executar,
  coalesce(has_function_privilege('service_role', p.oid, 'EXECUTE'), false) as service_role_pode_executar,
  exists(select 1 from pg_indexes where schemaname='public' and indexname='materiais_projeto_pagina_idx') as indice_existe
from (values ('public.pagina_materiais(bigint,integer)'),('public.cotacao_materiais(bigint)')) alvo(assinatura)
left join pg_proc p on p.oid = to_regprocedure(alvo.assinatura);
