-- Somente leitura. Esperado: zero nas duas contagens antes da migration de RLS.
-- Não retorna nomes, valores financeiros ou identificadores de usuários.
select 'materiais_com_proprietario_diferente_da_obra' as problema, count(*) as quantidade
from public.materiais_projeto m
join public.projetos p on p.id = m.projeto_id
where m.user_id is distinct from p.user_id
union all
select 'lancamentos_com_funcionario_de_outro_usuario', count(*)
from public.financeiro_obra f
join public.projetos p on p.id = f.projeto_id
join public.funcionarios funcionario on funcionario.id = f.funcionario_id
where funcionario.user_id is distinct from p.user_id;
