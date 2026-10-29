-- Aplicar após a migration de RLS e antes de publicar o frontend.
-- Somente função de leitura e índice; preserva registros e políticas.
begin;

create index if not exists financeiro_obra_projeto_id_desc_idx
  on public.financeiro_obra (projeto_id, id desc);

create or replace function public.pagina_caixa(p_projeto_id bigint, p_pagina integer default 0)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  resultado jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária.' using errcode = '42501';
  end if;
  if p_projeto_id is null or p_projeto_id <= 0 or p_pagina is null or p_pagina < 0 then
    raise exception 'Parâmetros inválidos.' using errcode = '22023';
  end if;

  -- Totais, faixa e lista compartilham um único snapshot.
  -- RLS vale também no join de funcionários. Não recebe user_id do cliente.
  with totais as (
    select count(*) as total,
      coalesce(sum(f.valor) filter (where f.tipo = 'RECEBIMENTO_CLIENTE'), 0) as entradas,
      coalesce(sum(f.valor) filter (where f.tipo = 'PAGAMENTO_FUNCIONARIO'), 0) as pagamentos
    from public.financeiro_obra f where f.projeto_id = p_projeto_id
  ), faixa as (
    select t.*, least(p_pagina::bigint, greatest(0::bigint, (t.total - 1) / 20)) as pagina
    from totais t
  )
  select jsonb_build_object(
    'projeto_id', p.id, 'pagina', faixa.pagina, 'total', faixa.total,
    'entradas', faixa.entradas, 'pagamentos', faixa.pagamentos,
    'transacoes', coalesce((
      select jsonb_agg(to_jsonb(linha) order by linha.id desc)
      from (
        select f.id, f.tipo, f.valor, f.data, f.descricao, f.funcionario_id,
          case when u.id is null then null else jsonb_build_object('nome', u.nome) end as funcionarios
        from public.financeiro_obra f
        left join public.funcionarios u on u.id = f.funcionario_id
        where f.projeto_id = p.id
        order by f.id desc limit 20 offset (faixa.pagina * 20)
      ) linha
    ), '[]'::jsonb)
  ) into resultado
  from public.projetos p cross join faixa
  where p.id = p_projeto_id and p.user_id = (select auth.uid());

  if resultado is null then
    raise exception 'Obra não encontrada ou sem acesso.' using errcode = '42501';
  end if;
  return resultado;
end;
$$;

revoke all on function public.pagina_caixa(bigint, integer) from public, anon, authenticated, service_role;
grant execute on function public.pagina_caixa(bigint, integer) to authenticated;
comment on function public.pagina_caixa(bigint, integer) is
  'Caixa privado: até 20 lançamentos e totais de todas as transações da obra sob RLS.';
notify pgrst, 'reload schema';
commit;
