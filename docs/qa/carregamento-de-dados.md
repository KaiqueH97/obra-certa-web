# Carregamento de dados com confirmação

## Comportamento

Dashboard, projetos, detalhes da obra, equipe e a lista de obras da calculadora
agora distinguem carregamento, sucesso com lista vazia e falha de consulta.
Em caso de erro, exibem uma mensagem com o botão **Tentar novamente**.

O dashboard e os detalhes da obra só publicam os dados quando todas as consultas
necessárias terminam com sucesso. Uma falha em materiais ou financeiro não vira
custo zero nem lucro calculado sobre parte das respostas. A obra inexistente ou
inacessível apresenta uma mensagem própria e um link para voltar aos projetos.

As consultas independentes do dashboard são iniciadas em paralelo. Nos detalhes,
primeiro é validada a obra; depois tarefas, materiais, caixa, equipe e usuário
são consultados em paralelo. Respostas com erro ou `data: null` são recusadas.

Na calculadora, os cálculos locais continuam disponíveis durante o carregamento
das obras. O seletor e o botão de salvar ficam bloqueados até a lista ser
confirmada; mensagens de carregamento/erro aparecem na área de vincular o resultado.

## Concorrência e tempo limite

`lib/load-data.ts` e `app/hooks/useDataLoad.ts` controlam o ciclo de leitura:

- Cada tentativa tem uma identificação; respostas de tentativas antigas não
  publicam dados nem sobrescrevem erros/sucessos da tentativa atual.
- Uma nova tentativa ou desmontagem aborta as consultas REST anteriores.
- Há um limite de 20 segundos para o carregamento completo. Se excedido, a tela
  sai do carregamento e permite tentar novamente.
- Não há repetição automática, nem recarga completa após gravações confirmadas.
- `getUser()` não recebe o sinal de cancelamento REST; seu resultado tardio é
  ignorado pelo controlador, sem manter a interface bloqueada.

As telas de listas e detalhes não disponibilizam ações de gravação até concluir
a leitura inicial. As gravações seguem usando o executor da etapa anterior.

## Listas completas

O Supabase pode limitar as linhas retornadas sem indicar erro. Para não calcular
totais sobre uma lista truncada, `loadAllRows` lê intervalos de até 500 registros
com contagem exata e ordenação determinística. Avança pelo número efetivamente
recebido, inclusive quando o limite do servidor é menor que 500.

Contagem ausente, IDs repetidos, mudança na contagem entre páginas ou resposta
vazia antes de atingir o total causam erro, sem publicar uma lista incompleta.
Essas verificações não constituem uma transação: alterações concorrentes com a
mesma contagem podem não ser detectadas entre consultas. Uma visão transacional
exigiria agregação/consulta específica no servidor.

Esta é paginação de leitura, sem novos controles de páginas na interface. Todos
os registros ainda ficam na memória do cliente. Agregações no banco e paginação
visual continuam sendo melhorias futuras para bases grandes. Uma base que não
termine de carregar em 20 segundos apresentará erro, sem totais parciais.

## Validação

`npm run test:loads` executa 24 testes unitários do módulo real: vazio versus erro,
confirmação conjunta, falha parcial, tentativa manual, concorrência, desmontagem,
reinicialização do efeito, timeout, paginação com 1.205 registros, limites menores
do servidor e inconsistências entre páginas. As respostas são simuladas; os testes
não usam o Supabase remoto nem executam os componentes em um navegador.

Roteiro manual:

1. Abra dashboard, projetos, equipe e uma obra com conexão normal. Confira listas,
   indicadores e as gravações de projeto, tarefa, material e caixa.
2. No painel Network do navegador, bloqueie o endpoint REST do Supabase e navegue
   novamente para uma dessas telas. Deve aparecer erro, nunca uma lista vazia ou
   indicadores zerados como se o carregamento tivesse funcionado.
3. Desbloqueie o endpoint e clique em **Tentar novamente**. Os dados devem aparecer.
4. Bloqueie somente a consulta de `financeiro_obra` e abra uma obra. Os cartões de
   totais e as ações da obra devem permanecer indisponíveis até uma tentativa bem
   sucedida. Repita bloqueando `materiais_projeto` no dashboard.
5. Com conexão lenta, troque de obra antes da resposta. A obra nova não deve
   receber o título, listas ou totais da anterior.
6. Na calculadora, simule falha na lista de projetos. Deve ser possível calcular,
   mas salvar exige corrigir a conexão e tentar carregar a lista novamente.
7. Em uma conta sem registros, uma consulta bem sucedida deve apresentar os estados
   vazios normais. Os indicadores do dashboard podem então ser zero.

Nenhum SQL ou alteração nas políticas é necessário nesta etapa.
