-- Executar integralmente no SQL Editor como administrador do projeto.
-- Substitui as políticas das cinco tabelas; não modifica registros do app.
-- Reaplicável: políticas anteriores são substituídas dentro da mesma transação.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Impede alterações concorrentes entre a verificação dos vínculos e as políticas.
lock table public.projetos, public.funcionarios, public.tarefas,
  public.materiais_projeto, public.financeiro_obra in share row exclusive mode;

do $preflight$
declare
  materiais_inconsistentes bigint;
  pagamentos_inconsistentes bigint;
begin
  select count(*) into materiais_inconsistentes
  from public.materiais_projeto m
  join public.projetos p on p.id = m.projeto_id
  where m.user_id is distinct from p.user_id;

  select count(*) into pagamentos_inconsistentes
  from public.financeiro_obra f
  join public.projetos p on p.id = f.projeto_id
  join public.funcionarios funcionario on funcionario.id = f.funcionario_id
  where funcionario.user_id is distinct from p.user_id;

  if materiais_inconsistentes > 0 or pagamentos_inconsistentes > 0 then
    raise exception 'Vínculos entre usuários diferentes: % materiais e % lançamentos financeiros. Migration cancelada.',
      materiais_inconsistentes, pagamentos_inconsistentes
      using hint = 'Execute docs/database/diagnostico-vinculos.sql e revise a propriedade dos registros antes de reaplicar. Nenhum registro deve ser corrigido automaticamente.';
  end if;
end;
$preflight$;

-- Políticas permissivas se combinam com OR. Manter uma regra antiga ampla
-- poderia anular as restrições novas, por isso substituímos o conjunto completo.
do $policies$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('projetos', 'funcionarios', 'tarefas', 'materiais_projeto', 'financeiro_obra')
  loop
    execute format('drop policy %I on %I.%I',
      policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end;
$policies$;

alter table public.projetos enable row level security;
alter table public.funcionarios enable row level security;
alter table public.tarefas enable row level security;
alter table public.materiais_projeto enable row level security;
alter table public.financeiro_obra enable row level security;

-- RLS não protege TRUNCATE. O navegador só precisa das operações abaixo.
revoke all privileges on table public.projetos, public.funcionarios,
  public.tarefas, public.materiais_projeto, public.financeiro_obra
  from public, anon, authenticated;

grant select, insert, update, delete on table public.projetos,
  public.funcionarios, public.materiais_projeto, public.financeiro_obra
  to authenticated;
-- A aplicação não oferece exclusão direta de tarefas; o cascade da obra permanece.
grant select, insert, update on table public.tarefas to authenticated;

-- Limita também as sequences de identidade, sem atingir outras tabelas.
do $sequences$
declare
  table_name text;
  sequence_name text;
begin
  foreach table_name in array array[
    'projetos', 'funcionarios', 'tarefas', 'materiais_projeto', 'financeiro_obra'
  ] loop
    sequence_name := pg_catalog.pg_get_serial_sequence(format('public.%I', table_name), 'id');
    if sequence_name is not null then
      execute format('revoke all privileges on sequence %s from public, anon, authenticated', sequence_name);
      execute format('grant usage on sequence %s to authenticated', sequence_name);
    end if;
  end loop;
end;
$sequences$;

create policy projetos_select_owner on public.projetos
  for select to authenticated using (user_id = (select auth.uid()));
create policy projetos_insert_owner on public.projetos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy projetos_update_owner on public.projetos
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy projetos_delete_owner on public.projetos
  for delete to authenticated using (user_id = (select auth.uid()));

create policy funcionarios_select_owner on public.funcionarios
  for select to authenticated using (user_id = (select auth.uid()));
create policy funcionarios_insert_owner on public.funcionarios
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy funcionarios_update_owner on public.funcionarios
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy funcionarios_delete_owner on public.funcionarios
  for delete to authenticated using (user_id = (select auth.uid()));

create policy tarefas_select_owner on public.tarefas
  for select to authenticated using (
    exists (select 1 from public.projetos p
      where p.id = tarefas.projeto_id and p.user_id = (select auth.uid()))
  );
create policy tarefas_insert_owner on public.tarefas
  for insert to authenticated with check (
    exists (select 1 from public.projetos p
      where p.id = tarefas.projeto_id and p.user_id = (select auth.uid()))
  );
create policy tarefas_update_owner on public.tarefas
  for update to authenticated
  using (
    exists (select 1 from public.projetos p
      where p.id = tarefas.projeto_id and p.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.projetos p
      where p.id = tarefas.projeto_id and p.user_id = (select auth.uid()))
  );

-- O proprietário do material deve coincidir com o proprietário da obra.
create policy materiais_select_owner on public.materiais_projeto
  for select to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.projetos p
      where p.id = materiais_projeto.projeto_id and p.user_id = (select auth.uid())
    )
  );
create policy materiais_insert_owner on public.materiais_projeto
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.projetos p
      where p.id = materiais_projeto.projeto_id and p.user_id = (select auth.uid())
    )
  );
create policy materiais_update_owner on public.materiais_projeto
  for update to authenticated
  using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.projetos p
      where p.id = materiais_projeto.projeto_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.projetos p
      where p.id = materiais_projeto.projeto_id and p.user_id = (select auth.uid())
    )
  );
create policy materiais_delete_owner on public.materiais_projeto
  for delete to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.projetos p
      where p.id = materiais_projeto.projeto_id and p.user_id = (select auth.uid())
    )
  );

create policy financeiro_select_owner on public.financeiro_obra
  for select to authenticated using (
    exists (select 1 from public.projetos p
      where p.id = financeiro_obra.projeto_id and p.user_id = (select auth.uid()))
  );
create policy financeiro_insert_owner on public.financeiro_obra
  for insert to authenticated with check (
    exists (select 1 from public.projetos p
      where p.id = financeiro_obra.projeto_id and p.user_id = (select auth.uid()))
    and (
      funcionario_id is null or exists (
        select 1 from public.funcionarios f
        where f.id = financeiro_obra.funcionario_id and f.user_id = (select auth.uid())
      )
    )
  );
create policy financeiro_update_owner on public.financeiro_obra
  for update to authenticated
  using (
    exists (select 1 from public.projetos p
      where p.id = financeiro_obra.projeto_id and p.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.projetos p
      where p.id = financeiro_obra.projeto_id and p.user_id = (select auth.uid()))
    and (
      funcionario_id is null or exists (
        select 1 from public.funcionarios f
        where f.id = financeiro_obra.funcionario_id and f.user_id = (select auth.uid())
      )
    )
  );
create policy financeiro_delete_owner on public.financeiro_obra
  for delete to authenticated using (
    exists (select 1 from public.projetos p
      where p.id = financeiro_obra.projeto_id and p.user_id = (select auth.uid()))
  );

commit;
