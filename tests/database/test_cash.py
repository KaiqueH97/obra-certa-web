"""Testa a RPC em PostgreSQL descartável. Não acessa o Supabase remoto."""

import os
import re
import subprocess

from test_rls import ROOT, MIGRATION, USER_A, USER_B, as_user, local_postgres, original_schema_and_policies, postgres_bin

CASH_MIGRATION = ROOT / "supabase/migrations/20261028000100_pagina_caixa.sql"


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
            insert into auth.users values ('{USER_A}'), ('{USER_B}');
            insert into public.projetos(id,titulo,user_id) values
              (1,'A','{USER_A}'), (2,'B','{USER_B}'), (3,'Vazia','{USER_A}');
            insert into public.funcionarios(id,nome,user_id) values (1,'Pessoa A','{USER_A}');
            insert into public.financeiro_obra(id,projeto_id,tipo,valor,descricao)
              select i,1,'RECEBIMENTO_CLIENTE',0.10,'Entrada ' || i from generate_series(1,1205) i;
            insert into public.financeiro_obra(id,projeto_id,tipo,valor,funcionario_id)
              values (1206,1,'PAGAMENTO_FUNCIONARIO',20,1), (2000,2,'RECEBIMENTO_CLIENTE',999,null);
            create table test_support.policies_before as select * from pg_policies where schemaname='public';
            alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
        """)
        run(CASH_MIGRATION.read_text())
        run(CASH_MIGRATION.read_text())
        run((ROOT / "docs/database/diagnostico-caixa.sql").read_text())
        run("""
            select test_support.ok(not p.prosecdef and p.provolatile='s' and p.proconfig @> array['search_path=""'],
              'invoker stable com search_path vazio') from pg_proc p
              where p.oid='public.pagina_caixa(bigint,integer)'::regprocedure;
            select test_support.ok(has_function_privilege('authenticated','public.pagina_caixa(bigint,integer)','EXECUTE'), 'authenticated autorizado');
            select test_support.ok(not has_function_privilege('anon','public.pagina_caixa(bigint,integer)','EXECUTE'), 'anon negado');
            select test_support.ok(not has_function_privilege('service_role','public.pagina_caixa(bigint,integer)','EXECUTE'), 'sem grant herdado');
            select test_support.ok(not exists (
              (select * from test_support.policies_before except select * from pg_policies where schemaname='public')
              union all (select * from pg_policies where schemaname='public' except select * from test_support.policies_before)
            ), 'políticas preservadas');
            set role anon;
            select test_support.denied('select public.pagina_caixa(1,0)', 'chamada anon negada');
            reset role;
            set role authenticated;
            select set_config('request.jwt.claim.sub','',false);
            select test_support.denied('select public.pagina_caixa(1,0)', 'identidade ausente negada');
        """)
        run(as_user(USER_A) + """
            select test_support.ok(public.pagina_caixa(1,0)->>'entradas'='120.50', 'soma além do limite de 1000');
            select test_support.ok((public.pagina_caixa(1,0)->>'pagamentos')::numeric=20, 'pagamentos completos');
            select test_support.ok((public.pagina_caixa(1,0)->>'total')::int=1206, 'contagem integral');
            select test_support.ok(jsonb_array_length(public.pagina_caixa(1,0)->'transacoes')=20, 'limite 20');
            select test_support.ok((public.pagina_caixa(1,0)#>>'{transacoes,0,id}')::int=1206, 'ordem desc');
            select test_support.ok((public.pagina_caixa(1,1)#>>'{transacoes,0,id}')::int=1186, 'segunda página');
            select test_support.ok(public.pagina_caixa(1,0)#>>'{transacoes,0,funcionarios,nome}'='Pessoa A', 'join de funcionário');
            select test_support.ok(jsonb_array_length(public.pagina_caixa(1,2147483647)->'transacoes')=6, 'ajuste página extrema');
            select test_support.ok((public.pagina_caixa(1,2147483647)->>'pagina')::int=60, 'última página efetiva');
            select test_support.ok(public.pagina_caixa(3,0)->'transacoes'='[]'::jsonb, 'obra vazia');
            select test_support.ok((public.pagina_caixa(3,0)->>'entradas')::numeric=0, 'vazia soma zero');
            select test_support.denied('select public.pagina_caixa(2,0)', 'outra conta negada');
            select test_support.denied('select public.pagina_caixa(999,0)', 'obra inexistente negada');
            do $$ begin
              begin perform public.pagina_caixa(1,-1); raise exception 'aceitou página inválida';
              exception when invalid_parameter_value then raise notice 'PASS: rejeita página negativa'; end;
              begin perform public.pagina_caixa(null,0); raise exception 'aceitou id nulo';
              exception when invalid_parameter_value then raise notice 'PASS: rejeita id nulo'; end;
            end $$;
            delete from public.financeiro_obra where projeto_id=1 and id <= 6;
            select test_support.ok((public.pagina_caixa(1,60)->>'pagina')::int=59, 'exclusão recupera última página');
            select test_support.ok((public.pagina_caixa(1,60)->>'entradas')::numeric=119.90, 'total reflete exclusão');
        """)
        run(as_user(USER_B) + """
            select test_support.ok((public.pagina_caixa(2,0)->>'entradas')::numeric=999, 'conta B isolada');
            select test_support.denied('select public.pagina_caixa(1,0)', 'B não lê A');
        """)
        run("""
            reset role;
            begin;
            create policy cash_test_restrict on public.financeiro_obra as restrictive
              for select to authenticated using (false);
        """ + as_user(USER_A) + """
            select test_support.ok((public.pagina_caixa(1,0)->>'total')::int=0, 'respeita RLS restritiva');
            rollback;
            begin;
            revoke select on public.financeiro_obra from authenticated;
        """ + as_user(USER_A) + """
            select test_support.denied('select public.pagina_caixa(1,0)', 'sem SELECT não retorna resumo parcial');
            rollback;
        """)
        print(f"OK: {assertions} verificações de paginação e totais em PostgreSQL local.")

if __name__ == "__main__":
    main()
