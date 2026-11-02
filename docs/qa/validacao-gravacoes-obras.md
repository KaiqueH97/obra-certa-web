# Validação da confirmação de gravações de obras

A confirmação agora pode validar o conteúdo da linha antes de anunciar sucesso
ou alterar a tela. Na lista de obras:

- Criar exige ID numérico positivo e seguro, título textual, data interpretável
  e proprietário igual ao usuário validado para aquele envio.
- Editar exige os mesmos campos e preservação do ID e proprietário da obra.
- Excluir exige que o ID retornado seja o da obra selecionada.

Uma resposta incompleta ou incompatível é resultado incerto: o servidor pode já
ter gravado. O formulário é preservado e a tela exige recarga antes de novo envio.
Não se anuncia sucesso, não se aplica a linha inválida e não se repete a operação.
A validação é compartilhada com a leitura da lista e não substitui RLS.

## Verificação manual

1. Em uma obra de teste, crie, renomeie e exclua um registro. Confira uma única
   notificação de sucesso por ação e a lista atualizada.
2. Durante um envio lento, tente repetir a ação: deve continuar bloqueada.
3. Troque entre português e inglês com um rascunho aberto; confira que o fluxo
   normal continua funcionando e que nomes cadastrados não são traduzidos.
4. Se ocorrer aviso de resultado incerto, recarregue e confira o banco pela lista
   antes de tentar novamente. Não é necessário alterar dados reais para simular
   respostas inconsistentes; esses casos são cobertos pelos testes locais.

## Testes locais

`npm run test:projects` verifica respostas incompletas, ID errado, proprietário
incompatível, data nula, preservação do rascunho e bloqueio de reenvio. Os fluxos
normais já cobertos continuam executados.

`npm run test:mutations` verifica que um validador rejeitado ou que lança erro
não chama a confirmação, não anuncia sucesso e bloqueia repetição. Operações sem
validador específico mantêm o comportamento anterior.

Não há SQL nesta etapa. A revisão das confirmações de equipe, materiais, tarefas
e caixa e a geração de tipos do schema continuam pendentes.
