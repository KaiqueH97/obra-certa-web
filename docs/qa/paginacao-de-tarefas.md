# Paginação de tarefas

Não há SQL para aplicar. Testar com conta de teste no Supabase conectado.

1. Abra uma obra com mais de 40 tarefas. A primeira página deve exibir 20 itens,
   mais recentes primeiro; confira no Network o filtro por projeto e o intervalo
   de 20 registros. A consulta inicial dos detalhes não deve baixar todas as tarefas.
2. Avance e volte: contador e limites devem corresponder ao total. Navegando por
   teclado, o foco deve chegar ao título do checklist após carregar a página.
3. Na última página, adicione uma tarefa. Após confirmação, o formulário limpa e
   a primeira página exibe a nova tarefa, ainda com no máximo 20 itens.
4. Conclua e reabra uma tarefa. Durante o envio, bloqueie cliques duplicados e
   navegação; depois a lista permanece na página atual e reflete o banco.
5. Bloqueie a consulta de tarefas pelo Network: o erro deve ficar no checklist.
   Materiais e caixa continuam disponíveis. Tentar novamente só repete a leitura.
6. Simule falha de leitura depois de uma criação confirmada. O retry não pode
   cadastrar outra tarefa. Se a própria gravação não for confirmada, deve aparecer
   o bloqueio de edição já usado pelo aplicativo.
7. Com um rascunho preenchido, alterne português/inglês. Texto digitado, página
   e nomes cadastrados devem permanecer, sem nova consulta pela troca de idioma.
8. Troque de obra durante uma consulta lenta: nenhum dado da obra anterior pode
   aparecer na nova. Verifique também o PWA e o layout mobile das três abas.
9. Em uma conta sem tarefas, exiba lista vazia e navegação desabilitada; confirme
   que outra conta não consegue ver ou alterar tarefas da primeira.

Automação: `npm run test:tasks` e `npm run test:deletions`.
Os testes simulam Supabase; a checagem real de rede, RLS e layout permanece manual.
Totais financeiros e lista de cotação continuam completos nesta etapa.
