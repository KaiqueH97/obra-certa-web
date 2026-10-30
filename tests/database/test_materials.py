"""Testa a RPC em PostgreSQL descartável. Não acessa o Supabase remoto."""

import os
import re
import subprocess

from test_rls import ROOT, MIGRATION, USER_A, USER_B, as_user, local_postgres, original_schema_and_policies, postgres_bin

MATERIALS_MIGRATION = ROOT / "supabase/migrations/20261029000100_pagina_materiais.sql"


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
              (1,'A','{USER_A}'),(2,'B','{USER_B}'),(3,'Vazia','{USER_A}');
            insert into public.materiais_projeto(projeto_id,user_id,nome,quantidade,preco_total)
              select 1,'{USER_A}','Material ' || i,'2 sacos',0.10 from generate_series(1,1205) i;
            insert into public.materiais_projeto(projeto_id,user_id,nome,quantidade,preco_total)
              values (1,'{USER_A}','Sem preço','1',null),(2,'{USER_B}','Privado B','1',999);
            create table test_support.policies_before as select * from pg_policies where schemaname='public';
            alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
        """)
        run(MATERIALS_MIGRATION.read_text())
        run(MATERIALS_MIGRATION.read_text())
        run((ROOT / "docs/database/diagnostico-materiais.sql").read_text())
        for signature, call in [('pagina_materiais(bigint,integer)', 'pagina_materiais(1,0)'), ('cotacao_materiais(bigint)', 'cotacao_materiais(1)')]:
            run(f"""
                reset role;
                select test_support.ok(not p.prosecdef and p.provolatile='s' and p.proconfig @> array['search_path=""'],
                  'invoker stable') from pg_proc p where p.oid='public.{signature}'::regprocedure;
                select test_support.ok(has_function_privilege('authenticated','public.{signature}','EXECUTE'), 'authenticated autorizado');
                select test_support.ok(not has_function_privilege('anon','public.{signature}','EXECUTE'), 'anon negado');
                select test_support.ok(not has_function_privilege('service_role','public.{signature}','EXECUTE'), 'sem grant herdado');
                set role anon;
                select test_support.denied('select public.{call}', 'anon sem acesso');
                reset role;
                set role authenticated;
                select set_config('request.jwt.claim.sub','',false);
                select test_support.denied('select public.{call}', 'sem identidade negado');
            """)
        run("reset role; select test_support.ok(not exists ((select * from test_support.policies_before except select * from pg_policies where schemaname='public') union all (select * from pg_policies where schemaname='public' except select * from test_support.policies_before)), 'políticas preservadas');")
        run(as_user(USER_A) + """
            select test_support.ok((public.pagina_materiais(1,0)->>'custo')::numeric=120.50,'soma completa com null');
            select test_support.ok((public.pagina_materiais(1,0)->>'total')::int=1206,'contagem completa');
            select test_support.ok(jsonb_array_length(public.pagina_materiais(1,0)->'materiais')=20,'limite 20');
            select test_support.ok((public.pagina_materiais(1,0)#>>'{materiais,0,id}')::int=1206,'ordem desc');
            select test_support.ok((public.pagina_materiais(1,1)#>>'{materiais,0,id}')::int=1186,'segunda página');
            select test_support.ok((public.pagina_materiais(1,2147483647)->>'pagina')::int=60,'página extrema ajustada');
            select test_support.ok(jsonb_array_length(public.cotacao_materiais(1)->'materiais')=1206,'cotação não truncada em 1000');
            select test_support.ok(public.cotacao_materiais(1)#>>'{materiais,1205,nome}'='Material 1','último item presente');
            select test_support.ok(public.cotacao_materiais(3)->'materiais'='[]'::jsonb,'cotação vazia');
            select test_support.ok((public.pagina_materiais(3,0)->>'custo')::numeric=0,'custo vazio zero');
            select test_support.denied('select public.pagina_materiais(2,0)','A não lê B');
            select test_support.denied('select public.cotacao_materiais(2)','A não exporta B');
            select test_support.denied('select public.cotacao_materiais(999)','obra inexistente negada');
            do $$ begin
              begin perform public.pagina_materiais(1,-1); raise exception 'aceitou inválido';
              exception when invalid_parameter_value then raise notice 'PASS: página negativa negada'; end;
              begin perform public.cotacao_materiais(null); raise exception 'aceitou nulo';
              exception when invalid_parameter_value then raise notice 'PASS: id nulo negado'; end;
            end $$;
            delete from public.materiais_projeto where projeto_id=1 and id<=6;
            select test_support.ok((public.pagina_materiais(1,60)->>'pagina')::int=59,'exclusão recupera página');
            update public.materiais_projeto set preco_total=1 where id=1206;
            select test_support.ok((public.pagina_materiais(1,0)->>'custo')::numeric=120.90,'total reflete alteração');
        """)
        run(as_user(USER_B) + """
            select test_support.ok((public.pagina_materiais(2,0)->>'custo')::numeric=999,'conta B isolada');
            select test_support.denied('select public.pagina_materiais(1,0)','B não lê A');
            select test_support.denied('select public.cotacao_materiais(1)','B não exporta A');
        """)
        run("""
            reset role;
            begin;
            create policy materials_test_restrict on public.materiais_projeto as restrictive for select to authenticated using(false);
        """ + as_user(USER_A) + """
            select test_support.ok((public.pagina_materiais(1,0)->>'total')::int=0,'página respeita RLS restritiva');
            select test_support.ok(public.cotacao_materiais(1)->'materiais'='[]'::jsonb,'cotação respeita RLS restritiva');
            rollback;
            begin;
            revoke select on public.materiais_projeto from authenticated;
        """ + as_user(USER_A) + """
            select test_support.denied('select public.pagina_materiais(1,0)','sem SELECT não retorna página');
            select test_support.denied('select public.cotacao_materiais(1)','sem SELECT não retorna cotação');
            rollback;
        """)
        print(f"OK: {assertions} verificações de materiais e cotação em PostgreSQL local.")

if __name__ == "__main__":
    main()
