# Validação das confirmações de tarefas

A leitura e as confirmações de criação/alteração verificam ID positivo e seguro,
nome textual, estado booleano ou nulo e vínculo numérico com a obra aberta.
Alterar uma tarefa também exige o ID selecionado e o estado de conclusão enviado.

Uma resposta incompatível de gravação não limpa o rascunho nem anuncia sucesso.
O checklist fica bloqueado com orientação de recarga: a operação pode já ter
ocorrido no banco. A conferência de vínculo não substitui RLS.

`concluida: null` continua aceito na leitura e criação, conforme o schema. Ao
concluir ou reabrir, a resposta precisa confirmar respectivamente true ou false.

## Verificação manual

1. Na obra de teste, adicione uma tarefa e confira uma notificação de sucesso e
   a atualização da lista. O campo deve ser limpo somente após a confirmação.
2. Conclua a tarefa e depois reabra. Confira estado visual e notificação em cada
   operação, inclusive em outra página do checklist.
3. Troque entre português e inglês com um rascunho preenchido; ele deve permanecer.
4. Com rede lenta, tente repetir o envio. Deve continuar bloqueado enquanto grava.
5. Se houver aviso de resultado incerto, recarregue e confira o resultado antes
   de tentar novamente. Não altere dados reais para simular respostas inválidas.

## Testes locais

`npm run test:tasks` cobre respostas incompletas, ID/vínculo errados, estado que
não confirma a alteração, valores nulos válidos, bloqueio de reenvio e tradução
do aviso. Também verifica retry de leitura e concluir/reabrir normalmente.
`npm run test:deletions` verifica regressões na tela que contém o checklist.

As APIs são simuladas. Não há SQL nesta etapa. Validação das gravações de
materiais/caixa e geração de tipos do schema permanecem pendentes.
