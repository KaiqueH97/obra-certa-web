# Indicadores das obras — QA

Não há SQL para aplicar nesta etapa.

1. No dashboard, confira os totais e links para até quatro obras recentes.
   “Em andamento” e o botão sem ação “Gerar Relatório” não devem aparecer.
2. A tabela de obras recentes deve mostrar a data real de cadastro, na coluna
   Criação. Confira com o campo criado_em no Supabase, considerando o fuso do
   navegador.
3. Em Meus Projetos, não devem aparecer 0%, barras de progresso fixas ou
   “Local a definir”. Nome, data de criação e ações continuam disponíveis.
4. No celular, a data deve aparecer com o rótulo Criação. No desktop, cabeçalho e
   linhas devem manter alinhamento. Navegue por teclado pelos links e ações.
5. Troque português/inglês: rótulos e formato da data acompanham o idioma; nomes,
   moeda BRL e número de consultas permanecem os mesmos.
6. Confira contas vazias, falha de rede e obras com nomes longos. Verifique também
   criar, editar, excluir e navegar pelas páginas de projetos.

Verificações locais: npm run test:dashboard, npm run test:projects, npm run lint
e npm run build. Testes simulam o banco; layout e navegação mobile requerem
validação manual.

Status, progresso físico, localização e relatório geral não foram implementados
nesta etapa. Os controles fictícios foram retirados até essas funções terem
dados e regras próprios.
