-- Aplicar após a migration de RLS e antes de publicar o frontend.
-- Somente função de leitura e índice; preserva registros e políticas.
begin;

create index if not exists materiais_projeto_pagina_idx
  on public.materiais_projeto (projeto_id, id desc);

create or replace function public.pagina_materiais(p_projeto_id bigint, p_pagina integer default 0)
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
  -- Não recebe user_id do cliente; SELECT continua sujeito à RLS.
  with totais as (
    select count(*) as total,
      coalesce(sum(f.preco_total), 0) as custo
    from public.materiais_projeto f where f.projeto_id = p_projeto_id
  ), faixa as (
    select t.*, least(p_pagina::bigint, greatest(0::bigint, (t.total - 1) / 20)) as pagina
    from totais t
  )
  select jsonb_build_object(
    'projeto_id', p.id, 'pagina', faixa.pagina, 'total', faixa.total,
    'custo', faixa.custo,
    'materiais', coalesce((
      select jsonb_agg(to_jsonb(linha) order by linha.id desc)
      from (
        select f.id, f.nome, f.quantidade, f.projeto_id, f.preco_total
        from public.materiais_projeto f
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

revoke all on function public.pagina_materiais(bigint, integer) from public, anon, authenticated, service_role;
grant execute on function public.pagina_materiais(bigint, integer) to authenticated;
comment on function public.pagina_materiais(bigint, integer) is
  'Materiais privados: até 20 itens e custo de todos os materiais da obra sob RLS.';
-- Exportação explícita: uma consulta única inclui todos os itens sob o mesmo snapshot.
create or replace function public.cotacao_materiais(p_projeto_id bigint)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare resultado jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária.' using errcode = '42501';
  end if;
  if p_projeto_id is null or p_projeto_id <= 0 then
    raise exception 'Parâmetros inválidos.' using errcode = '22023';
  end if;
  select jsonb_build_object('projeto_id', p.id,
    'total', (select count(*) from public.materiais_projeto m where m.projeto_id = p.id),
    'materiais', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'quantidade', m.quantidade) order by m.id desc)
      from public.materiais_projeto m where m.projeto_id = p.id
    ), '[]'::jsonb)
  ) into resultado
  from public.projetos p where p.id = p_projeto_id and p.user_id = (select auth.uid());
  if resultado is null then
    raise exception 'Obra não encontrada ou sem acesso.' using errcode = '42501';
  end if;
  return resultado;
end;
$$;
revoke all on function public.cotacao_materiais(bigint) from public, anon, authenticated, service_role;
grant execute on function public.cotacao_materiais(bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
