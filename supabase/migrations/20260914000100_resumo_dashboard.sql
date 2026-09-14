-- Aplicar após 20260907000100_isolar_dados_por_usuario.sql e antes do novo frontend.
-- Apenas índices e função de leitura; não altera registros ou políticas RLS.
begin;

create index if not exists projetos_dashboard_owner_recent_idx
  on public.projetos (user_id, criado_em desc, id desc);
create index if not exists tarefas_dashboard_projeto_idx
  on public.tarefas (projeto_id);
create index if not exists materiais_dashboard_owner_projeto_idx
  on public.materiais_projeto (user_id, projeto_id);

create or replace function public.resumo_dashboard()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  resumo jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária para consultar o resumo.' using errcode = '42501';
  end if;

  -- Um único SELECT: totais e lista compartilham o snapshot da consulta.
  -- SECURITY INVOKER mantém as políticas RLS das três tabelas em vigor.
  select jsonb_build_object(
    'projetos', coalesce((
      select jsonb_agg(to_jsonb(recentes) order by recentes.criado_em desc, recentes.id desc)
      from (
        select p.id, p.titulo, p.criado_em
        from public.projetos p
        order by p.criado_em desc, p.id desc
        limit 4
      ) recentes
    ), '[]'::jsonb),
    'metricas', jsonb_build_object(
      'obrasAtivas', (select count(*) from public.projetos),
      'tarefasConcluidas', tarefas.concluidas,
      'tarefasPendentes', tarefas.pendentes,
      'custoTotal', (select coalesce(sum(m.preco_total), 0) from public.materiais_projeto m)
    )
  ) into resumo
  from (
    select count(*) filter (where t.concluida is true) as concluidas,
      count(*) filter (where t.concluida is not true) as pendentes
    from public.tarefas t
  ) tarefas;

  return resumo;
end;
$$;

-- Funções novas podem herdar EXECUTE público dos privilégios padrão do projeto.
revoke all on function public.resumo_dashboard() from public, anon, authenticated, service_role;
grant execute on function public.resumo_dashboard() to authenticated;

comment on function public.resumo_dashboard() is
  'Resumo privado do dashboard: totais sob RLS e os quatro projetos mais recentes. Somente leitura.';

notify pgrst, 'reload schema';
commit;
