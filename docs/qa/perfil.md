# Carregamento e edição do perfil

## Correção

`/perfil` não tratava falhas de carregamento ou exceções de `updateUser`. Isso
podia deixar o nome como “Carregando...” ou manter o botão “Salvando...” para
sempre. A tela confirmava a alteração usando o rascunho local, sem conferir o
usuário e os metadados retornados. Metadados com tipos inesperados também podiam
quebrar a renderização do nome ou o cálculo das iniciais.

O carregamento agora usa `useDataLoad`, já presente nas outras telas: só libera a
edição após obter um perfil válido, tem limite local de 20 segundos, oferece nova
tentativa e ignora retornos após desmontagem. `readProfile` normaliza os campos
textuais; campos antigos ausentes ou inválidos recebem valores de exibição
seguros. As iniciais toleram espaços repetidos e nome vazio.

`createProfileSaver` controla a gravação por instância da página:

- Remove espaços externos do nome e telefone e rejeita nome vazio. Não impõe
  uma nova máscara ou validação de telefone nesta etapa; o telefone é opcional.
- Bloqueia envios duplicados sincronamente e verifica a identidade no Auth antes
  do PUT. Não inicia gravação se login/logout estiver em andamento ou se o usuário
  verificado diferir do dono do perfil carregado.
- Confirma sucesso somente com `error: null`, o mesmo ID de usuário e os campos
  `nome` e `telefone` correspondentes aos valores enviados. Atualiza a tela com
  o perfil retornado, incluindo a remoção explícita do telefone ao enviar vazio.
- Trata rejeições HTTP 4xx preservando o rascunho para correção manual. HTTP
  401/403 ou mudança de sessão bloqueiam a edição e orientam recarregar.
- Após erro de rede, resposta incompleta/incompatível, erro 5xx ou timeout de uma
  gravação já iniciada, mantém os últimos dados confirmados e informa resultado
  incerto. Não permite novo envio nessa instância: oferece recarregar o perfil.
- Se a validação anterior ao PUT falhar ou exceder o tempo, permite tentar
  novamente. Uma validação que termina atrasada não inicia o PUT.

O formulário tem rótulos associados, autocomplete e envio pelo teclado. Cancelar
restaura os últimos dados confirmados; um novo ciclo de edição começa com eles.
Mensagens aparecem no próprio perfil, com foco e sem toast global pendente. Os
botões locais de cancelar, sair e redefinir senha ficam bloqueados durante envio.
O texto que afirmava criptografia de ponta a ponta para a senha foi substituído
por uma orientação de uso de senha forte e exclusiva.

## Limites e escopo

O prazo de 20 segundos abrange a verificação anterior à gravação e a resposta do
PUT. Encerrar a espera local ou navegar para outra tela **não cancela** uma
operação já enviada ao Auth nem os efeitos internos do SDK. Se o resultado for
incerto, a atualização pode ter sido processada; confira os dados no servidor
antes de editar novamente. Não há reenvio automático.

A proteção contra logout/troca de conta em outra aba continua sendo feita pelo
`PrivateSessionBoundary`, que desmonta a página quando a identidade muda. A
checagem anterior ao PUT não é atômica com uma troca de sessão em outra aba;
não desfaz requisições já enviadas. Não foi criada uma trava global para todas
as operações do aplicativo.

Esta etapa atualiza apenas nome e telefone em `user_metadata`, como o fluxo
anterior. Esses campos são editáveis pelo próprio usuário e não concedem acesso
ou permissões. Não requer SQL, migration, pacote ou variável de ambiente.

## Testes automatizados

Execute `npm run test:profile`. Os testes usam o controlador e a página React
com jsdom, incluindo Strict Mode e os hooks reais de carregamento. O Auth é
simulado; nenhum dado de conta real é modificado.

Em 08/10/2026, passaram os 30 testes novos (23 do controlador/leitura e sete da
página), os 103 testes de regressão de carregamento, sessão, login/logout e
redefinição de senha, o lint dos arquivos alterados, `npx tsc --noEmit` e
`npm run build`. A conferência com uma conta real continua pendente abaixo.

## Conferência manual pendente

1. Entre em uma conta de teste e abra **Meu Perfil**. Em conexão lenta, a edição
   só deve aparecer após o carregamento. Se a consulta falhar, deve haver uma
   mensagem com **Tentar novamente**, sem campos editáveis com dados incompletos.
2. Abra **Editar Dados**, mude nome e telefone e clique em **Cancelar**. Ao editar
   novamente, devem aparecer os valores confirmados anteriormente.
3. Salve um nome com espaços nas pontas e um telefone. Com rede lenta, clique
   duas vezes rapidamente: deve existir apenas um **PUT** para `/auth/v1/user`.
   Chamadas **GET** para validar a sessão são esperadas. Durante o envio, os
   campos e botões locais devem ficar bloqueados.
4. Confira o aviso de sucesso, o foco nele e o novo nome no avatar. Recarregue a
   página e confirme a persistência. Repita limpando o telefone: deve mostrar
   **Não informado** e continuar vazio após recarregar.
5. Tente salvar um nome apenas com espaços. Deve haver aviso, sem PUT. Em uma
   rejeição explícita do Auth, os campos devem preservar o rascunho para correção.
6. Interrompa a conexão durante o PUT ou bloqueie a requisição no DevTools. Deve
   aparecer resultado incerto, sem espera infinita (limite local de 20 segundos).
   O botão **Editar Dados** fica bloqueado. Restaure a conexão e use **Recarregar
   perfil** para conferir se o servidor recebeu a mudança.
7. Com uma requisição lenta, navegue para outra página pelo menu. O retorno não
   deve gerar toast, redirecionamento ou alteração de dados na tela seguinte.
8. Abra outra aba e faça logout/troque de conta enquanto edita. A proteção de
   sessão deve retirar o perfil antigo. O rascunho não deve aparecer na nova conta.
9. Confira a edição pelo teclado e em uma tela pequena, inclusive os rótulos dos
   campos, a confirmação pelo Enter e a leitura dos avisos.
