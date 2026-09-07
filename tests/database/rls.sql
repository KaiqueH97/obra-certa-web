-- Regressões executadas por test_rls.py apenas em PostgreSQL descartável.
select test_support.ok(
  (select count(*) = 19 from pg_policies where schemaname = 'public' and tablename <> 'fora_do_escopo'),
  '19 políticas, sem duplicação após reaplicar'
);
select test_support.ok(
  not exists (select 1 from pg_policies where schemaname = 'public'
    and tablename <> 'fora_do_escopo' and roles <> array['authenticated']::name[]),
  'políticas do app aplicadas somente a authenticated'
);
select test_support.ok(
  exists (select 1 from pg_policies where schemaname = 'public'
    and tablename = 'fora_do_escopo' and policyname = 'sentinela')
  and has_table_privilege('anon', 'public.fora_do_escopo', 'TRUNCATE'),
  'tabelas fora do escopo preservadas'
);

with current_rows as (
  select 'projetos'::text as tabela, to_jsonb(t) as dados from public.projetos t
  union all select 'funcionarios', to_jsonb(t) from public.funcionarios t
  union all select 'tarefas', to_jsonb(t) from public.tarefas t
  union all select 'materiais_projeto', to_jsonb(t) from public.materiais_projeto t
  union all select 'financeiro_obra', to_jsonb(t) from public.financeiro_obra t
)
select test_support.ok(not exists (
  (select * from current_rows except select * from test_support.initial_rows)
  union all
  (select * from test_support.initial_rows except select * from current_rows)
), 'migration preserva integralmente os registros');

do $$
declare
  table_name text;
  sequence_name text;
begin
  foreach table_name in array array['projetos', 'funcionarios', 'tarefas', 'materiais_projeto', 'financeiro_obra'] loop
    perform test_support.ok((select relrowsecurity from pg_class where oid = ('public.' || table_name)::regclass), table_name || ': RLS habilitada');
    perform test_support.ok(not has_table_privilege('anon', 'public.' || table_name, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'), table_name || ': sem grants para anon');
    perform test_support.ok(not has_table_privilege('authenticated', 'public.' || table_name, 'TRUNCATE, REFERENCES, TRIGGER'), table_name || ': sem privilégios administrativos para authenticated');
    perform test_support.ok(has_table_privilege('authenticated', 'public.' || table_name, 'SELECT') and has_table_privilege('authenticated', 'public.' || table_name, 'INSERT') and has_table_privilege('authenticated', 'public.' || table_name, 'UPDATE'), table_name || ': grants necessários preservados');
    perform test_support.ok(has_table_privilege('authenticated', 'public.' || table_name, 'DELETE') = (table_name <> 'tarefas'), table_name || ': grant de exclusão conforme o app');
    perform test_support.ok(has_table_privilege('service_role', 'public.' || table_name, 'SELECT'), table_name || ': grant explícito do serviço preservado');
    sequence_name := pg_get_serial_sequence('public.' || table_name, 'id');
    perform test_support.ok(not has_sequence_privilege('anon', sequence_name, 'SELECT, UPDATE, USAGE'), table_name || ': sequence sem acesso anônimo');
    perform test_support.ok(has_sequence_privilege('authenticated', sequence_name, 'USAGE') and not has_sequence_privilege('authenticated', sequence_name, 'SELECT, UPDATE'), table_name || ': sequence com privilégio mínimo');
  end loop;
end;
$$;

-- A e B têm as mesmas garantias. As funções auxiliares são SECURITY INVOKER.
do $$
declare
  actor record;
  table_name text;
  editable_column text;
  visible_rows bigint;
begin
  for actor in select * from (values
    ('00000000-0000-4000-8000-000000000001', 100, 200),
    ('00000000-0000-4000-8000-000000000002', 200, 100)
  ) as actors(uid, own_id, other_id) loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', actor.uid, true);
    perform test_support.ok(current_user = 'authenticated' and not (select rolbypassrls or rolsuper from pg_roles where rolname = current_user), 'testes executados sem bypass de RLS');
    foreach table_name in array array['projetos', 'funcionarios', 'tarefas', 'materiais_projeto', 'financeiro_obra'] loop
      editable_column := case table_name when 'projetos' then 'titulo' when 'financeiro_obra' then 'descricao' else 'nome' end;
      execute format('select count(*) from public.%I', table_name) into visible_rows;
      perform test_support.ok(visible_rows = 1, table_name || ': lista somente registros próprios');
      execute format('select count(*) from public.%I where id = %s', table_name, actor.other_id) into visible_rows;
      perform test_support.ok(visible_rows = 0, table_name || ': acesso por ID alheio bloqueado');
      perform test_support.affected(format('update public.%I set %I = %I where id = %s returning id', table_name, editable_column, editable_column, actor.own_id), 1, table_name || ': atualização própria com retorno funciona');
      perform test_support.affected(format('update public.%I set %I = %I where id = %s returning id', table_name, editable_column, editable_column, actor.other_id), 0, table_name || ': atualização alheia não afeta linhas');
      if table_name <> 'tarefas' then
        perform test_support.affected(format('delete from public.%I where id = %s returning id', table_name, actor.other_id), 0, table_name || ': exclusão alheia não afeta linhas');
      end if;
    end loop;
    execute 'reset role';
  end loop;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);

-- Operações usadas pelo front-end, inclusive defaults e RETURNING.
select test_support.affected('update public.projetos set titulo = ''Obra A editada'' where id = 100 returning id', 1, 'edição de título passa a persistir');
select test_support.affected('insert into public.projetos(titulo, user_id) values (''Nova obra'', auth.uid()) returning id', 1, 'criação de projeto com identidade automática');
select test_support.affected('insert into public.funcionarios(nome, cargo, valor_diaria, user_id) values (''Novo profissional'', ''Pedreiro'', 120, auth.uid()) returning id', 1, 'cadastro de equipe com identidade automática');
select test_support.affected('insert into public.tarefas(projeto_id, nome) values (100, ''Nova tarefa'') returning id', 1, 'criação de tarefa própria');
select test_support.affected('insert into public.materiais_projeto(projeto_id, nome, quantidade, preco_total) values (100, ''Novo material'', ''10 m²'', 350) returning id', 1, 'material usa default auth.uid e identidade automática');
select test_support.affected('insert into public.financeiro_obra(projeto_id, tipo, valor, descricao) values (100, ''RECEBIMENTO_CLIENTE'', 1000, ''Sinal'') returning id', 1, 'entrada sem funcionário funciona');
select test_support.affected('insert into public.financeiro_obra(projeto_id, tipo, valor, funcionario_id) values (100, ''PAGAMENTO_FUNCIONARIO'', 150, 100) returning id', 1, 'pagamento de funcionário próprio funciona');
select test_support.affected('update public.materiais_projeto set nome = ''Material editado'', quantidade = ''12 m²'', preco_total = 450 where id = 100 returning id', 1, 'edição completa do próprio material funciona');
select test_support.affected('update public.tarefas set concluida = true where id = 100 returning id', 1, 'conclusão da tarefa funciona');
select test_support.ok((select f.nome = 'Equipe A' from public.financeiro_obra t join public.funcionarios f on f.id = t.funcionario_id where t.id = 100), 'join financeiro com equipe própria funciona');

-- Rejeição de propriedade falsa e vínculos entre usuários diferentes.
select test_support.denied('insert into public.projetos(titulo, user_id) values (''Inválido'', ''00000000-0000-4000-8000-000000000002'')', 'projeto não pode ser criado em nome de B');
select test_support.denied('insert into public.funcionarios(nome, user_id) values (''Inválido'', ''00000000-0000-4000-8000-000000000002'')', 'funcionário não pode ser criado em nome de B');
select test_support.denied('insert into public.tarefas(projeto_id, nome) values (200, ''Inválida'')', 'tarefa não pode ser inserida na obra de B');
select test_support.denied('insert into public.materiais_projeto(projeto_id, nome, quantidade) values (200, ''Inválido'', ''1'')', 'material não pode ser inserido na obra de B');
select test_support.denied('insert into public.materiais_projeto(projeto_id, user_id, nome, quantidade) values (100, ''00000000-0000-4000-8000-000000000002'', ''Inválido'', ''1'')', 'material não pode ter proprietário B');
select test_support.denied('insert into public.financeiro_obra(projeto_id, tipo, valor) values (200, ''RECEBIMENTO_CLIENTE'', 1)', 'lançamento não pode ser inserido na obra de B');
select test_support.denied('insert into public.financeiro_obra(projeto_id, tipo, valor, funcionario_id) values (100, ''PAGAMENTO_FUNCIONARIO'', 1, 200)', 'pagamento não pode vincular funcionário de B');
select test_support.denied('update public.projetos set user_id = ''00000000-0000-4000-8000-000000000002'' where id = 100', 'obra não pode ser transferida para B');
select test_support.denied('update public.funcionarios set user_id = ''00000000-0000-4000-8000-000000000002'' where id = 100', 'funcionário não pode ser transferido para B');
select test_support.denied('update public.materiais_projeto set user_id = ''00000000-0000-4000-8000-000000000002'' where id = 100', 'material não pode ser transferido para B');
select test_support.denied('update public.materiais_projeto set projeto_id = 200 where id = 100', 'material não pode mudar para obra de B');
select test_support.denied('update public.tarefas set projeto_id = 200 where id = 100', 'tarefa não pode mudar para obra de B');
select test_support.denied('update public.financeiro_obra set projeto_id = 200 where id = 100', 'lançamento não pode mudar para obra de B');
select test_support.denied('update public.financeiro_obra set funcionario_id = 200 where id = 100', 'lançamento não pode mudar para funcionário de B');
select test_support.denied('delete from public.tarefas where id = 100', 'exclusão direta de tarefa continua indisponível');

-- Sessão sem identidade: mesmo no papel authenticated, não há acesso a registros.
select set_config('request.jwt.claim.sub', '', false);
do $$
declare
  table_name text;
  visible_rows bigint;
begin
  foreach table_name in array array['projetos', 'funcionarios', 'tarefas', 'materiais_projeto', 'financeiro_obra'] loop
    execute format('select count(*) from public.%I', table_name) into visible_rows;
    perform test_support.ok(visible_rows = 0, table_name || ': sessão sem UID não vê dados');
  end loop;
end;
$$;
select test_support.denied('insert into public.projetos(titulo, user_id) values (''Inválido'', ''00000000-0000-4000-8000-000000000001'')', 'sessão sem UID não pode criar projeto');
reset role;

set role anon;
do $$
declare
  table_name text;
  editable_column text;
begin
  foreach table_name in array array['projetos', 'funcionarios', 'tarefas', 'materiais_projeto', 'financeiro_obra'] loop
    editable_column := case table_name when 'projetos' then 'titulo' when 'financeiro_obra' then 'descricao' else 'nome' end;
    perform test_support.denied(format('select * from public.%I', table_name), table_name || ': anon sem leitura');
    perform test_support.denied(format('insert into public.%I default values', table_name), table_name || ': anon sem inserção');
    perform test_support.denied(format('update public.%I set %I = %I', table_name, editable_column, editable_column), table_name || ': anon sem atualização');
    perform test_support.denied(format('delete from public.%I', table_name), table_name || ': anon sem exclusão');
    perform test_support.denied(format('truncate public.%I cascade', table_name), table_name || ': anon sem truncate');
  end loop;
end;
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
select test_support.denied('truncate public.projetos cascade', 'authenticated sem truncate');
select test_support.affected('delete from public.funcionarios where id = 100 returning id', 1, 'exclusão do próprio funcionário funciona');
select test_support.ok((select funcionario_id is null and valor = 150 from public.financeiro_obra where id = 100), 'ON DELETE SET NULL preserva pagamento e valor');
select test_support.affected('update public.financeiro_obra set descricao = ''Histórico preservado'' where id = 100 returning id', 1, 'histórico sem funcionário continua editável');
select test_support.affected('delete from public.financeiro_obra where id = 100 returning id', 1, 'exclusão do próprio lançamento funciona');
select test_support.affected('delete from public.materiais_projeto where id = 100 returning id', 1, 'exclusão do próprio material funciona');
select test_support.affected('delete from public.projetos where id = 100 returning id', 1, 'exclusão da própria obra funciona');
reset role;

select test_support.ok(not exists (select 1 from public.tarefas where projeto_id = 100)
  and not exists (select 1 from public.materiais_projeto where projeto_id = 100)
  and not exists (select 1 from public.financeiro_obra where projeto_id = 100),
  'cascade da obra remove suas entidades filhas');
select test_support.ok((select titulo = 'Obra B' from public.projetos where id = 200)
  and (select nome = 'Equipe B' from public.funcionarios where id = 200)
  and (select not concluida from public.tarefas where id = 200)
  and (select nome = 'Material B' from public.materiais_projeto where id = 200)
  and (select valor = 250 and funcionario_id = 200 from public.financeiro_obra where id = 200),
  'dados de B preservados após operações de A');
