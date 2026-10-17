# Paginação da lista de obras

## Problema e comportamento

`/projetos` buscava todos os registros antes de mostrar a lista. Agora solicita
somente 20 obras por página, com contagem exata e ordenação por `criado_em DESC,
id DESC`. Os botões **Anterior** e **Próxima** mostram a faixa exibida e ficam
indisponíveis nos limites, durante uma gravação ou com edição/confirmação aberta.
Ao trocar de página, o foco vai para o título da lista após o carregamento.
Uma edição ou confirmação deve ser salva/concluída ou cancelada antes de criar
ou alterar outra obra, evitando deixar um formulário aberto fora da página.

`lib/project-pagination.ts` usa o carregador compartilhado em `lib/pagination.ts`
para validar contagem, tamanho da resposta e IDs. Uma
resposta truncada não vira uma página completa nem um estado vazio. A tela mantém
o controle de cancelamento, respostas antigas e timeout de `useDataLoad`.
Durante uma leitura pendente ou com erro, os registros anteriores não ficam
disponíveis para alterações. **Tentar novamente** repete apenas a leitura.

Após criação confirmada, a tela busca a primeira página e atualiza o total.
Após exclusão confirmada, busca a página atual para preencher a vaga; se a última
página ficar vazia, volta à anterior. Edições usam o título retornado pelo banco,
sem refazer a consulta. Uma falha ao recarregar depois de uma gravação confirmada
não repete o INSERT/DELETE.

Se exclusões em outra aba invalidarem a página solicitada, a tela volta à última
disponível. O PostgREST pode devolver `PGRST103` para intervalos inválidos; nesse
caso, uma consulta de uma linha confirma o total antes do ajuste. Falha nessa
consulta continua sendo erro, sem inventar um total zero.
Referência: [erros do PostgREST](https://docs.postgrest.org/en/latest/references/errors.html).

## Validação automatizada

Execute `npm run test:projects`. Os testes exercitam o carregador e a página React
com jsdom: intervalos no servidor, contagem, limites, navegação, foco, criação,
edição, exclusão, página removida, respostas inconsistentes, falha de leitura
após gravação confirmada e cancelamento ao sair. As respostas do Supabase são
simuladas; o roteiro abaixo verifica a integração no ambiente real.

Execute também `npm run test:mutations` e `npm run test:loads` para verificar os
controladores compartilhados de leitura e gravação.

## Roteiro manual

Use uma conta e obras de teste, sem dados reais para excluir.

1. Com pelo menos 21 obras, abra **Meus Projetos**. A primeira página deve exibir
   20, com total correto e **Anterior** desabilitado. No Network, a consulta
   deve conter `offset=0` e `limit=20`, sem buscar todas as páginas de uma vez.
2. Clique em **Próxima**. Confira `offset=20`, os registros restantes e o foco
   no título da lista. Volte usando **Anterior**. Teste também em tela mobile
   e navegando pelo teclado.
3. Crie uma obra estando na segunda página. Após confirmação, deve aparecer a
   primeira página, com a nova obra, no máximo 20 itens e total atualizado.
4. Edite um título. Confira a alteração após recarregar a página. Durante a
   edição ou confirmação de exclusão, os controles de paginação ficam bloqueados.
5. Exclua uma obra da primeira página com mais de 20 registros: a lista deve
   continuar com 20. Com exatamente 21, exclua a única obra da segunda página:
   a tela deve voltar à primeira, com total 20.
6. Com conexão lenta, avance uma página: os itens antigos não devem permitir
   ações enquanto a nova consulta está pendente. Bloqueie a leitura REST no
   DevTools para simular falha e confira **Tentar novamente**; desbloqueie e
   repita a leitura. Não deve mostrar lista vazia como se tivesse dado certo.
7. Abra duas abas com obras de teste. Na primeira, mantenha a página inicial;
   na outra, exclua registros suficientes para eliminar a segunda página.
   Clique em **Próxima** na primeira aba. Deve ajustar para a página disponível,
   inclusive se a primeira consulta retornar HTTP 416.
8. Confira uma conta sem obras: estado vazio, total zero e navegação desabilitada.

## Escopo e limites

Não precisa executar SQL nem alterar RLS. As consultas continuam usando o cliente
autenticado e as políticas existentes. A gestão de profissionais também recebeu
[paginação da equipe](./paginacao-da-equipe.md). Seletor da calculadora e detalhes
da obra continuam com seus carregamentos atuais.

A página selecionada é local: recarregar ou reabrir a rota começa na primeira.
Paginação por offset não fornece uma visão transacional entre páginas; inclusões
ou exclusões concorrentes podem deslocar itens durante a navegação. Contagem
exata e offsets altos ainda custam trabalho no banco em bases muito grandes;
a mudança limita os dados transferidos e renderizados, sem prometer custo
constante da consulta.
