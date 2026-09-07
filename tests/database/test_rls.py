"""Integração em PostgreSQL descartável, sem rede e sem acesso ao Supabase.

Requisitos: Python 3 e binários do PostgreSQL (pg_config ou PG_BINDIR).
Executar: python3 tests/database/test_rls.py
"""

import csv
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260907000100_isolar_dados_por_usuario.sql"
USER_A = "00000000-0000-4000-8000-000000000001"
USER_B = "00000000-0000-4000-8000-000000000002"


def identifier(value):
    return '"' + value.replace('"', '""') + '"'


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def postgres_bin():
    if os.environ.get("PG_BINDIR"):
        return Path(os.environ["PG_BINDIR"])
    if shutil.which("pg_config"):
        result = subprocess.run(["pg_config", "--bindir"], check=True, capture_output=True, text=True)
        return Path(result.stdout.strip())
    raise SystemExit("Instale o PostgreSQL local ou informe PG_BINDIR. Nenhum banco remoto é utilizado.")


def original_schema_and_policies():
    reference = (ROOT / "docs/database/schema-reference.md").read_text()
    schema = reference.split("```sql\n", 1)[1].split("```", 1)[0]
    statements = [schema]
    with (ROOT / "docs/database/rls-antes.csv").open(newline="") as source:
        for row in csv.DictReader(source):
            table = "public." + identifier(row["tabela"])
            statements.append(f"alter table {table} enable row level security;")
            for policy in json.loads(row["politicas"]):
                statement = (
                    f"create policy {identifier(policy['nome'])} on {table} "
                    f"as {policy['tipo']} for {policy['operacao']} "
                    f"to {', '.join(identifier(role) for role in policy['roles'])}"
                )
                if policy["using"] is not None:
                    statement += f" using ({policy['using']})"
                if policy["with_check"] is not None:
                    statement += f" with check ({policy['with_check']})"
                statements.append(statement + ";")
    return "\n".join(statements)


def as_user(user):
    return f"set role authenticated; select set_config('request.jwt.claim.sub', {literal(user)}, false);"


@contextmanager
def local_postgres(bindir):
    # Um servidor real é necessário: o modo --single não aplica RLS normalmente.
    # Apenas socket Unix no diretório temporário, sem escutar portas TCP.
    with tempfile.TemporaryDirectory(prefix="obra-certa-rls-") as directory:
        data = Path(directory) / "data"
        result = subprocess.run(
            [str(bindir / "initdb"), "-D", str(data), "-U", "rls_test_admin",
             "--auth=trust", "--no-locale", "--encoding=UTF8"],
            capture_output=True, text=True,
        )
        if result.returncode:
            raise RuntimeError(result.stderr)
        log = Path(directory) / "postgres.log"
        result = subprocess.run(
            [str(bindir / "pg_ctl"), "-D", str(data), "-l", str(log),
             "-o", f"-h '' -k {directory} -p 5432", "-w", "start"],
            capture_output=True, text=True,
        )
        if result.returncode:
            raise RuntimeError(result.stderr + (log.read_text() if log.exists() else ""))
        try:
            yield directory
        finally:
            subprocess.run(
                [str(bindir / "pg_ctl"), "-D", str(data), "-m", "immediate", "-w", "stop"],
                capture_output=True, text=True, check=True,
            )


def main():
    bindir = postgres_bin()
    assertions = 0
    with local_postgres(bindir) as directory:
        def run(sql, expected_error=None):
            nonlocal assertions
            result = subprocess.run(
                [str(bindir / "psql"), "-X", "-h", directory, "-p", "5432",
                 "-U", "rls_test_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
                input=sql, capture_output=True, text=True,
                env={**os.environ, "LC_ALL": "C"},
            )
            errors = re.findall(r"\b(?:ERROR|FATAL|PANIC):[^\n]*", result.stderr)
            if expected_error is None and (result.returncode or errors):
                raise AssertionError(result.stdout + result.stderr)
            if expected_error is not None and not any(expected_error in error for error in errors):
                raise AssertionError(f"Erro esperado não encontrado: {expected_error}\n{result.stderr}")
            assertions += result.stderr.count("PASS:")

        run((ROOT / "tests/database/setup.sql").read_text() + original_schema_and_policies() + f"""
            grant all on all tables in schema public to public, anon, authenticated, service_role;
            grant all on all sequences in schema public to public, anon, authenticated, service_role;
            insert into auth.users values ('{USER_A}'), ('{USER_B}');
            insert into public.projetos(id, titulo, user_id) values
              (100, 'Obra A', '{USER_A}'), (200, 'Obra B', '{USER_B}');
            insert into public.funcionarios(id, nome, user_id) values
              (100, 'Equipe A', '{USER_A}'), (200, 'Equipe B', '{USER_B}');
            insert into public.tarefas(id, projeto_id, nome) values
              (100, 100, 'Tarefa A'), (200, 200, 'Tarefa B');
            insert into public.materiais_projeto(id, projeto_id, user_id, nome, quantidade)
              overriding system value values
              (100, 100, '{USER_A}', 'Material A', '10 m²'),
              (200, 200, '{USER_B}', 'Material B', '20 m²');
            insert into public.financeiro_obra(id, projeto_id, tipo, valor, funcionario_id) values
              (100, 100, 'PAGAMENTO_FUNCIONARIO', 150, 100),
              (200, 200, 'PAGAMENTO_FUNCIONARIO', 250, 200);
            create table test_support.initial_rows as
              select 'projetos'::text as tabela, to_jsonb(t) as dados from public.projetos t
              union all select 'funcionarios', to_jsonb(t) from public.funcionarios t
              union all select 'tarefas', to_jsonb(t) from public.tarefas t
              union all select 'materiais_projeto', to_jsonb(t) from public.materiais_projeto t
              union all select 'financeiro_obra', to_jsonb(t) from public.financeiro_obra t;
        """)

        run("begin;" + as_user(USER_A) + """
            select test_support.affected('update public.projetos set titulo = ''Não salvo'' where id = 100', 0, 'reproduz edição de projeto sem persistência');
            select test_support.affected('insert into public.materiais_projeto(projeto_id, nome, quantidade) values (200, ''Invasão'', ''1'')', 1, 'reproduz material em obra alheia');
            select test_support.affected('update public.materiais_projeto set projeto_id = 200 where id = 100', 1, 'reproduz transferência de material para obra alheia');
            select test_support.affected('insert into public.financeiro_obra(projeto_id, tipo, valor, funcionario_id) values (100, ''PAGAMENTO_FUNCIONARIO'', 10, 200)', 1, 'reproduz funcionário alheio no caixa');
            rollback;
        """)
        print("Falhas das políticas fornecidas reproduzidas.")

        migration = MIGRATION.read_text()
        for invalid_row, cleanup in [
            (f"insert into public.materiais_projeto(projeto_id, user_id, nome, quantidade) values (200, '{USER_A}', 'Inconsistente', '1');",
             "delete from public.materiais_projeto where nome = 'Inconsistente';"),
            ("insert into public.financeiro_obra(projeto_id, tipo, valor, funcionario_id, descricao) values (100, 'PAGAMENTO_FUNCIONARIO', 10, 200, 'Inconsistente');",
             "delete from public.financeiro_obra where descricao = 'Inconsistente';"),
        ]:
            run(invalid_row)
            run(migration, expected_error="Vínculos entre usuários diferentes")
            run("""
                select test_support.ok((select count(*) = 18 from pg_policies where schemaname = 'public' and tablename <> 'fora_do_escopo'), 'falha de preflight preserva políticas');
                select test_support.ok(has_table_privilege('anon', 'public.projetos', 'TRUNCATE'), 'falha de preflight preserva grants');
            """ + cleanup)
        print("Cancelamento transacional validado para os dois tipos de vínculo inconsistente.")

        run(migration)
        run(migration)
        run((ROOT / "tests/database/rls.sql").read_text())
        run((ROOT / "docs/database/diagnostico-rls.sql").read_text())
        run((ROOT / "docs/database/diagnostico-vinculos.sql").read_text())
        print(f"OK: {assertions} verificações em PostgreSQL local; migration reaplicada e diagnósticos executados.")


if __name__ == "__main__":
    main()
