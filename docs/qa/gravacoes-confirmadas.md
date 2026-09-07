# Gravações confirmadas pelo banco

## Problema e comportamento

Excluir um lançamento financeiro removia a linha da tela e anunciava sucesso
mesmo se o banco recusasse a exclusão. Preços, materiais e tarefas também podiam
mostrar alterações ainda não persistidas. Algumas gravações de projetos e equipe
deixavam carregamentos ativos quando a sessão estava ausente ou a chamada lançava
uma exceção.

As gravações de projetos, equipe, materiais, tarefas, caixa e calculadora agora
solicitam a linha afetada com `select(...).single()`. Somente uma resposta sem erro,
contendo um registro identificado, executa a atualização da interface. As edições
usam os valores devolvidos pelo banco. Respostas vazias ou com erro não anunciam
sucesso. As operações existentes continuam sujeitas às políticas de RLS.

O executor em `lib/confirmed-mutation.ts`, integrado ao React por
`app/hooks/useConfirmedMutation.ts`, bloqueia requisições simultâneas para a mesma
chave, encerra a notificação de carregamento e libera a trava em `finally`.
Respostas após a desmontagem não executam callbacks de atualização da tela.
Na troca de obra, o componente recebe uma nova instância de estado.

Formulários são preservados em caso de erro. O campo de preço, salvo ao perder
o foco, volta ao último valor confirmado; os totais continuam refletindo esse valor.
As listas são atualizadas com a resposta da gravação, sem recarregar todos os dados
da tela após cada alteração.

Não há repetição automática: se a conexão cair depois de o servidor persistir
uma inserção, o resultado pode ficar incerto para o cliente. A mensagem orienta
atualizar a página antes de tentar novamente. A trava local não oferece idempotência
entre abas, dispositivos ou novas tentativas.

## Validação automatizada

Execute `npm run test:mutations`. Os 17 casos testam o executor real, com respostas
controladas: confirmação, RLS, zero linhas, retorno nulo ou inválido, falha de rede,
sessão ausente, clique duplicado, liberação após erro, concorrência entre registros
e resposta após desmontagem. São testes unitários; não executam o navegador nem
acessam o Supabase remoto.

## Roteiro manual no navegador

Use registros de teste em uma conta autenticada:

1. Crie e edite uma obra e um funcionário. Salve um material pela calculadora,
   altere seu preço, crie/conclua uma tarefa e registre/exclua um lançamento.
   Recarregue a página e confira que os valores persistiram.
2. Nas ferramentas do navegador, bloqueie as requisições ao endpoint REST do
   Supabase após carregar a tela. Tente salvar um preço e excluir um lançamento.
   Espere a resposta de erro: o preço deve voltar ao confirmado, o lançamento e os
   totais devem permanecer, e o carregamento deve encerrar. Desbloqueie o endpoint.
3. Abra a mesma obra em duas abas. Exclua um lançamento na primeira e tente
   excluí-lo na segunda, sem recarregá-la. A segunda deve informar que o registro
   não foi encontrado ou não está acessível, sem anunciar uma nova exclusão.
4. Simule uma conexão lenta e clique duas vezes em salvar ou concluir tarefa.
   Confira no painel Network que só uma gravação é enviada para aquela operação.
5. Com uma gravação pendente, navegue para outra obra. A resposta anterior não
   deve inserir nem alterar registros na nova tela.

Esta etapa não precisa de outra migration. O roteiro manual ainda deve ser
validado no aplicativo conectado ao ambiente do usuário.
