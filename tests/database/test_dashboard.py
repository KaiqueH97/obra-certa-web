"""Testa a RPC em PostgreSQL descartável. Não acessa o Supabase remoto."""

import os
import re
import subprocess

from test_rls import ROOT, MIGRATION, USER_A, USER_B, as_user, local_postgres, original_schema_and_policies, postgres_bin

USER_EMPTY = "00000000-0000-4000-8000-000000000003"
DASHBOARD_MIGRATION = ROOT / "supabase/migrations/20260914000100_resumo_dashboard.sql"


def main():
    bindir = postgres_bin()
    assertions = 0
    with local_postgres(bindir) as directory:
        def run(sql):
            nonlocal assertions
            result = subprocess.run(
                [str(bindir / "psql"), "-X", "-h", directory, "-p", "5432",
                 "-U", "rls_test_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
                input=sql, capture_output=True, text=True, env={**os.environ, "LC_ALL": "C"},
            )
            if result.returncode or re.search(r"\b(?:ERROR|FATAL|PANIC):", result.stderr):
                raise AssertionError(result.stdout + result.stderr)
            assertions += result.stderr.count("PASS:")

        run((ROOT / "tests/database/setup.sql").read_text() + original_schema_and_policies())
        run(MIGRATION.read_text())
        run(f"""
            insert into auth.users values ('{USER_A}'), ('{USER_B}'), ('{USER_EMPTY}');
            insert into public.projetos(id, titulo, user_id, criado_em)
              select i, 'Obra A ' || i, '{USER_A}', '2026-01-01Z' from generate_series(1, 1205) i;
            insert into public.projetos(id, titulo, user_id, criado_em) values
              (2000, 'Obra B antiga', '{USER_B}', '2026-02-01Z'),
              (2001, 'Obra B recente', '{USER_B}', '2026-03-01Z');
            insert into public.tarefas(id, projeto_id, nome, concluida)
              select i, i, 'Tarefa A', case i % 3 when 0 then null when 1 then true else false end
              from generate_series(1, 1205) i;
            insert into public.tarefas(id, projeto_id, nome, concluida) values
              (2000, 2000, 'Tarefa B', true), (2001, 2000, 'Tarefa B pendente', false);
            insert into public.materiais_projeto(projeto_id, user_id, nome, quantidade, preco_total)
              select i, '{USER_A}', 'Material A', '1', 0.10 from generate_series(1, 1205) i;
            insert into public.materiais_projeto(projeto_id, user_id, nome, quantidade, preco_total) values
              (1, '{USER_A}', 'Sem preço', '1', null),
              (2000, '{USER_B}', 'Material B', '1', 99.99);

            create table test_support.policies_before as select * from pg_policies where schemaname = 'public';
            -- Reproduz defaults permissivos de funções novas no Supabase.
            alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
        """)
        run(DASHBOARD_MIGRATION.read_text())
        run(DASHBOARD_MIGRATION.read_text())
        run((ROOT / "docs/database/diagnostico-dashboard.sql").read_text())
        run("""
            select test_support.ok(not p.prosecdef and p.provolatile = 's' and p.pronargs = 0
              and p.proconfig @> array['search_path=""'], 'função invoker stable sem parâmetro de usuário')
              from pg_proc p where p.oid = 'public.resumo_dashboard()'::regprocedure;
            select test_support.ok(has_function_privilege('authenticated', 'public.resumo_dashboard()', 'EXECUTE'), 'authenticated pode executar');
            select test_support.ok(not has_function_privilege('anon', 'public.resumo_dashboard()', 'EXECUTE'), 'anon sem EXECUTE');
            select test_support.ok(not has_function_privilege('service_role', 'public.resumo_dashboard()', 'EXECUTE'), 'não herda EXECUTE de service_role');
            select test_support.ok(not exists (
              (select * from test_support.policies_before except select * from pg_policies where schemaname = 'public')
              union all (select * from pg_policies where schemaname = 'public' except select * from test_support.policies_before)
            ), 'migration preserva todas as políticas');
            select test_support.ok((select count(*) = 3 from pg_indexes where schemaname = 'public'
              and indexname in ('projetos_dashboard_owner_recent_idx', 'tarefas_dashboard_projeto_idx', 'materiais_dashboard_owner_projeto_idx')), 'índices reaplicados sem duplicação');
            set role anon;
            select test_support.denied('select public.resumo_dashboard()', 'chamada anônima negada');
            reset role;
            set role authenticated;
            select set_config('request.jwt.claim.sub', '', false);
            select test_support.denied('select public.resumo_dashboard()', 'authenticated sem identidade negado');
        """)
        for user, expected, ids in [
            (USER_A, '{"obrasAtivas":1205,"tarefasConcluidas":402,"tarefasPendentes":803,"custoTotal":120.50}', '[1205,1204,1203,1202]'),
            (USER_B, '{"obrasAtivas":2,"tarefasConcluidas":1,"tarefasPendentes":1,"custoTotal":99.99}', '[2001,2000]'),
            (USER_EMPTY, '{"obrasAtivas":0,"tarefasConcluidas":0,"tarefasPendentes":0,"custoTotal":0}', '[]'),
        ]:
            run(as_user(user) + f"""
                select test_support.ok(public.resumo_dashboard()->'metricas' = '{expected}'::jsonb, 'totais isolados: {user}');
                select test_support.ok((select coalesce(jsonb_agg(p->'id'), '[]'::jsonb)
                  from jsonb_array_elements(public.resumo_dashboard()->'projetos') p) = '{ids}'::jsonb,
                  'recentes isolados e ordenados: {user}');
                select test_support.ok(jsonb_array_length(public.resumo_dashboard()->'projetos') <= 4, 'no máximo quatro projetos');
            """)
        run("""
            begin;
            create policy dashboard_test_hide_materials on public.materiais_projeto
              as restrictive for select to authenticated using (false);
        """ + as_user(USER_A) + """
            select test_support.ok(public.resumo_dashboard()->'metricas'->>'custoTotal' = '0', 'RPC respeita política RLS restritiva adicional');
            rollback;
            begin;
            revoke select on public.tarefas from authenticated;
        """ + as_user(USER_A) + """
            select test_support.denied('select public.resumo_dashboard()', 'falha de uma tabela não retorna resumo parcial');
            rollback;
        """)
        print(f"OK: {assertions} verificações da RPC em PostgreSQL local; duas contas, conta vazia e 1.205 registros por conjunto.")


if __name__ == "__main__":
    main()
