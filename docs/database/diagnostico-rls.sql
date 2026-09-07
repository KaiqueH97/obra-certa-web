-- Executar no SQL Editor do Supabase e compartilhar as cinco linhas do resultado.
-- Somente leitura de metadados: não altera tabelas, políticas nem dados do app.
-- Referências:
-- https://www.postgresql.org/docs/current/view-pg-policies.html
-- https://www.postgresql.org/docs/current/functions-info.html

select
  c.relname as tabela,
  c.relrowsecurity as rls_habilitada,
  c.relforcerowsecurity as rls_forcada,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'nome', p.policyname,
          'tipo', p.permissive,
          'roles', p.roles,
          'operacao', p.cmd,
          'using', p.qual,
          'with_check', p.with_check
        ) order by p.policyname
      )
      from pg_catalog.pg_policies p
      where p.schemaname = n.nspname and p.tablename = c.relname
    ),
    '[]'::jsonb
  ) as politicas,
  array(
    select privilegio
    from unnest(array[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ]) as privilegios(privilegio)
    where pg_catalog.has_table_privilege('anon', c.oid, privilegio)
  ) as privilegios_tabela_anon,
  array(
    select privilegio
    from unnest(array[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ]) as privilegios(privilegio)
    where pg_catalog.has_table_privilege('authenticated', c.oid, privilegio)
  ) as privilegios_tabela_authenticated
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname in (
    'projetos', 'funcionarios', 'tarefas', 'materiais_projeto', 'financeiro_obra'
  )
order by c.relname;
