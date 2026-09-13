# Sessão em abas abertas e retorno à página

## Correção

O proxy protege as requisições que chegam ao servidor, mas uma página já aberta
podia continuar mostrando o estado React da conta anterior após saída ou troca
de conta em outra aba. O layout privado agora usa `PrivateSessionBoundary`, com
controle de concorrência em `lib/session-guard.ts`.

- Antes de montar as telas privadas, confirma o usuário com `getUser()`.
- `SIGNED_OUT` oculta imediatamente o conteúdo, desmonta as telas e leva ao login.
  Uma identidade diferente descarta o estado anterior e recarrega `/home`.
- Eventos repetidos e renovação de token da mesma conta preservam a tela.
- Retorno ao foco ou à visibilidade verifica novamente o usuário. `pagehide`
  oculta também o DOM antes da preservação da página pelo navegador;
  `pageshow` com `persisted` exige nova verificação.
- Durante uma verificação, mantém formulários montados, porém ocultos. A mesma
  conta recupera os campos; uma conta diferente nunca recebe esses formulários.
- Falha de rede, HTTP 429/5xx ou espera superior a 20 segundos mantém o conteúdo
  oculto e oferece nova tentativa. Não anuncia logout nem autoriza pelo cache local.
- Consultas antigas não podem liberar conteúdo após saída, suspensão ou desmontagem.
- O logout iniciado na própria aba continua sob controle de `auth-actions`,
  preservando inclusive o aviso em `/login?saida=parcial`.

A inscrição de Auth usa callback síncrono e agenda consultas fora dele, conforme
as orientações de [onAuthStateChange do Supabase](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
Listeners e inscrições são removidos na desmontagem.

## Validação automatizada

Execute `npm run test:session`. São 15 testes do controlador e 7 do componente
React no DOM simulado com jsdom (dependência apenas de desenvolvimento).
Os testes cobrem eventos de sessão, respostas atrasadas, timeout, indisponibilidade,
desmontagem, retorno à página, preservação de campos e integração com logout parcial.

As respostas de Auth e a navegação são simuladas. Os eventos de histórico nos
testes não reproduzem a captura real do cache de navegação de cada navegador.
A validação manual abaixo permanece pendente.

Em 13/09/2026, passaram os 22 testes desta etapa, os 82 testes de regressão de
login/logout, carregamento, proxy e PWA, o lint dos arquivos de código alterados,
`npx tsc --noEmit` e `npm run build`. Ambiente local: Node 24.13.1.

## Conferência manual

Use duas abas do mesmo navegador e perfil, com a aplicação atualizada:

1. Entre na conta A e abra uma obra nas duas abas. Saia pela primeira. Ao voltar
   à segunda, os dados da obra devem desaparecer e o login deve abrir.
2. Entre novamente na conta A e abra um formulário, sem salvar. Alterne para
   outra aba e volte: após conferir a sessão, os campos devem continuar preenchidos.
3. Mantenha uma aba antiga aberta, saia e entre com uma conta B pela outra aba.
   Ao retornar à antiga, ela deve mostrar o login ou recarregar os dados de B;
   nenhum formulário ou dado de A deve continuar disponível.
4. Volte e avance pelo histórico após sair ou trocar de conta. As páginas privadas
   devem verificar a sessão antes de permitir acesso ao conteúdo. Repita no mobile.
5. Em uma página privada aberta, bloqueie temporariamente a requisição ao endpoint
   `/auth/v1/user` pelo DevTools e alterne de aba. Deve aparecer erro de verificação
   (após até 20 segundos se a requisição ficar pendente), com conteúdo oculto.
   Desbloqueie e clique em **Tentar novamente**: a mesma conta recupera os campos.
6. Confira o logout normal e o cenário de logout parcial do roteiro
   [login/logout](./login-logout.md): o aviso de saída parcial deve ser preservado.

Não há SQL, migration ou alteração de variável de ambiente nesta etapa. Proxy e
RLS continuam responsáveis pela autorização. A sincronização depende dos eventos
do SDK e das verificações ao retornar à página; não é uma garantia de revogação
instantânea em outros dispositivos. Retornar à aba passa a exigir conexão para
confirmar a sessão, acrescentando uma consulta de Auth.
