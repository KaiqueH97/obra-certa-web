# Gravações ao sair da tela

## Problema corrigido

O executor compartilhado de gravações deixava o toast de carregamento ativo ao
sair da página e publicava sucesso ou erro quando a resposta chegava. Como o
`Toaster` pertence ao layout raiz, esse aviso podia surgir em outra obra, no login
ou após mudar de conta. A flag `active` sozinha também permitia que um retorno
antigo atualizasse uma instância reativada e interferisse na trava de uma ação nova.

Havia dois problemas relacionados: criar obra/profissional podia iniciar um
INSERT depois de sair da tela, se `getUser()` ainda estivesse pendente; e a
limpeza do preço editado ficava depois de `await run()`, fora da proteção do executor.

## Alterações

- Cada operação pertence à geração da página e à sua própria entrada de trava.
  Reativar a instância não autoriza respostas da geração anterior.
- Desmontar encerra imediatamente a espera local, invalida callbacks e dispensa
  pelo ID os avisos criados pela instância, incluindo resultados ainda visíveis.
  Não usa `toast.dismiss()` global e não interfere nos avisos de outras ações.
- Sucesso, erro, atualização de dados e liberação de trava só acontecem para a
  operação ainda pertencente à tela. Um `finally` antigo não libera a trava nova.
- `request` recebe um `AbortSignal`. Os cadastros de obra e profissional conferem
  o sinal logo após `getUser()` e antes de construir/enviar o INSERT.
- A restauração do campo de preço usa `onSettled`, protegido pelo mesmo ciclo de
  vida. Continua funcionando após sucesso ou erro enquanto a tela estiver ativa.
- Uma resposta de gravação sem `error: null` não é aceita como confirmação,
  mesmo se trouxer um ID.

A correção afeta projetos, equipe, materiais, tarefas, lançamentos financeiros e
salvamento da calculadora, que já usam o mesmo hook. Perfil e fluxos de autenticação
continuam com os controladores específicos implementados nas etapas anteriores.

## Limites

Encerrar a espera local **não desfaz** uma requisição já enviada ao Supabase.
O sinal impede o INSERT após uma validação de sessão cancelada; as gravações
REST já iniciadas podem ser processadas e seus retornos são ignorados na interface.
Ao voltar, confira os registros carregados antes de repetir uma ação sem confirmação.
Não há reenvio automático nem garantia de idempotência entre telas, abas ou dispositivos.

A proteção de saída é complementada pelo [limite de espera e tratamento de
resultado incerto](./limite-de-gravacoes.md), que também atua com a página aberta. Uma aba apenas
oculta pode manter a instância montada; ocultação não equivale a cancelamento.
A proteção de sessão existente desmonta o conteúdo quando identifica logout ou
mudança de conta. Uma instância reativada após abandonar uma gravação exige recarregar os dados;
respostas anteriores continuam invalidadas, mas o trabalho no servidor pode seguir.

Nenhum SQL, migration, pacote ou variável de ambiente é necessário.

## Validação automatizada

- `npm run test:mutations`: 35 testes do executor e quatro testes React dos cadastros
  de projetos/equipe, inclusive com Strict Mode.
- `npm run test:deletions`: 18 testes das páginas de equipe e obra, usando o hook,
  executor, confirmação de exclusão e proteção de sessão reais com jsdom.
- Os testes da calculadora e da proteção de sessão conferem os demais fluxos
  relacionados. Respostas do Supabase, navegação e notificações são simuladas.

Em 10/10/2026, passaram os 68 testes relacionados (gravações, cadastros de
obra/equipe, exclusões, calculadora e proteção de sessão), o lint dos arquivos
de código alterados, `npx tsc --noEmit` e `npm run build`. A conferência com
requisições reais continua pendente abaixo.

## Conferência manual pendente

Use obras, profissionais e lançamentos de teste.

1. Ative conexão lenta no DevTools, salve um material/preço ou confirme uma
   exclusão. Navegue para outra página antes da resposta. O aviso da operação
   deve ser dispensado ao sair e não deve reaparecer quando a resposta chegar.
2. Repita com uma resposta de erro. A nova página não deve receber o aviso antigo.
3. Com gravação pendente, faça logout por outra aba. Quando a proteção identificar
   a saída, o login não deve mostrar o resultado da operação anterior.
4. Crie uma obra ou um profissional e deixe a consulta `/auth/v1/user` pendente
   antes do INSERT. Navegue para outra tela e permita que a consulta termine.
   Não deve surgir um POST posterior para `/rest/v1/projetos` ou
   `/rest/v1/funcionarios` causado por esse cadastro abandonado.
5. Permaneça na mesma tela e confirme uma gravação normal: registro, total e
   notificação devem refletir a resposta confirmada. Em erro de preço, o campo
   deve retornar ao último valor confirmado.
6. Com uma notificação de outra ação visível, saia da tela de gravação. Apenas
   os avisos pertencentes à instância encerrada devem ser dispensados.
7. Volte à obra e confira os dados. Uma requisição já enviada antes de navegar
   pode ter persistido; não a repita sem verificar o resultado.
