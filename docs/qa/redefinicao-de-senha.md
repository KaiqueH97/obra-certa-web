# Redefinição de senha

## Correção

`/redefinir-senha` enviava `updateUser` sem conferir a sessão, sem tratar exceções
e sem verificar o usuário retornado. Um erro de rede podia manter “Salvando...”
indefinidamente. Havia um `Toaster` duplicado e um redirecionamento por timer que
podia acontecer depois de sair da página.

`lib/password-reset.ts` agora controla a validação e a gravação por instância da
página. A interface apresenta a conta verificada antes de receber a senha, usa
rótulos associados e autocomplete, bloqueia duplicatas sincronamente, limpa os
campos nos resultados finais e coloca foco no aviso. O sucesso oferece um link
para abrir o painel com navegação completa, sem temporizador de redirecionamento.

## Sessão e link de recuperação

1. Aguarda a inicialização automática do cliente Supabase e verifica seu resultado.
   Não chama `exchangeCodeForSession` em paralelo: o cliente instalado já consome
   o código PKCE. A consulta ao resultado de `initialize()` é intencional: um
   callback inválido pode preservar uma sessão anterior, que não deve ser usada
   para redefinir a senha da conta errada.
2. Rejeita erros, códigos ou tokens que continuem na URL após essa inicialização,
   inclusive código sem o verificador PKCE no navegador. Não exibe esses valores
   nem mensagens internas do Auth na interface.
3. Consulta `getUser()` para validar a identidade no Auth. O formulário não depende
   de capturar `PASSWORD_RECOVERY`, que pode ocorrer antes da montagem da página.
4. Antes de gravar, valida novamente a identidade. Logout ou troca de conta
   notificados pelo SDK invalidam o formulário e os retornos pendentes. Renovar
   a mesma sessão preserva os campos.

Abrir a URL sem callback, com uma sessão de e-mail válida, permite alterar a
senha da conta indicada na tela. Isso também permite recarregar a página depois
que o código foi consumido. Sem sessão válida, o formulário permanece bloqueado.
Essa página não constitui uma exigência de recuperação recente no servidor:
regras adicionais de reautenticação e de força de senha pertencem ao Supabase.

O fluxo continua usando as configurações atuais de Site URL, Redirect URLs e
modelo de e-mail. Para PKCE, solicite e abra o link no mesmo navegador/perfil;
abrir em outro perfil sem o verificador exige solicitar outro link nesse perfil.
Um callback acrescentado por navegação interna após a inicialização do singleton
não é trocado manualmente: se o código continuar na URL, a página o rejeita.

Contratos conferidos no SDK instalado (`GoTrueClient.initialize`,
`_getSessionFromURL`, `getUser` e `updateUser`) e nas referências oficiais:
[fluxo PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[atualização do usuário](https://supabase.com/docs/reference/javascript/auth-updateuser).

## Resultados da gravação

| Resultado | Comportamento |
| --- | --- |
| `error: null` e usuário retornado com o ID esperado | Confirma alteração e oferece continuar para o painel |
| Senhas diferentes ou menos de seis caracteres | Corrige localmente sem enviar |
| Rejeição HTTP 4xx, como senha fraca, repetida ou rate limit | Mensagem compreensível; permite corrigir e tentar manualmente |
| HTTP 401/403, identidade diferente antes de gravar ou validação indisponível | Bloqueia formulário e oferece solicitar novo link |
| Exceção, 5xx, retorno incompleto, ID inesperado na resposta ou timeout após iniciar gravação | Resultado incerto, sem anunciar sucesso nem repetir o envio |

Cada operação tem limite de espera local de 20 segundos, incluindo a validação
antes de gravar. Um `getUser` que só termine depois desse limite não inicia a
gravação. A saída da página encerra a espera local e remove a assinatura do Auth.

Timeout, desmontagem e troca de sessão **não desfazem** uma gravação já enviada
nem cancelam os efeitos internos do SDK. Uma troca de conta em outra aba não é
uma transação atômica com `updateUser`: as verificações evitam envios quando a
mudança já foi detectada e impedem feedback tardio incorreto. Se a troca ocorrer
durante um envio, a interface avisa que ele pode ter sido processado. Não há
reenvio automático nem armazenamento das senhas fora do estado local do formulário.

Nenhum SQL, migration, pacote ou variável de ambiente é necessário nesta etapa.

## Validação automatizada

Execute `npm run test:password-reset`. Os testes do controlador e da página React
com jsdom simulam o Auth; não enviam e-mail nem alteram senhas reais. Cobrem
inicialização, callback inválido com sessão anterior, ausência de evento de
recuperação, confirmação de identidade, duplicatas, erros, timeout, troca de
conta, Strict Mode, limpeza de assinaturas, foco e respostas tardias.

Em 08/10/2026, passaram os 35 testes novos (25 do controlador e 10 da página),
os 116 testes de regressão de solicitação do link, cadastro, login/logout, proxy
e proteção de sessão, o lint dos arquivos de código alterados,
`npx tsc --noEmit` e `npm run build`. O teste com e-mail e senha reais continua
pendente da conferência manual abaixo.

## Conferência manual pendente

Use contas de teste sob seu controle.

1. Sem sessão, abra `/redefinir-senha`: deve aparecer orientação para solicitar
   outro link, sem campos de senha.
2. Solicite a recuperação em `/recuperar` e abra o e-mail no mesmo navegador.
   Aguarde a validação e confira o e-mail exibido. Com rede lenta, envie duas
   vezes rapidamente: deve existir somente um **PUT** para `/auth/v1/user`.
   Chamadas **GET** de verificação de sessão são esperadas.
3. Após sucesso, confira a remoção dos campos e o foco no aviso. Clique em
   **Continuar para o painel**. Faça logout e confirme que a nova senha permite
   entrar e que a anterior deixou de funcionar.
4. Antes de enviar, tente confirmação diferente. Deve haver erro local e nenhum
   PUT. Se o Supabase rejeitar senha repetida ou fraca, deve permitir corrigir,
   sem mostrar detalhes internos do servidor.
5. Com uma conta conectada, abra `/redefinir-senha#error=access_denied&error_code=otp_expired`
   ou um link expirado/usado. A sessão anterior não deve liberar o formulário.
   Solicite um novo link para continuar.
6. Com formulário aberto e senha digitada, faça logout ou troque de conta em outra
   aba. O formulário deve desaparecer; voltar à conta anterior não reaproveita
   os campos. Feche e reabra o fluxo de recuperação para continuar.
7. Bloqueie a chamada de gravação no DevTools ou interrompa a conexão durante o
   envio. Deve surgir aviso de resultado incerto, sem carregamento infinito
   (máximo de 20 segundos de espera local). Não assuma que a senha ficou intacta:
   o servidor pode ter processado a requisição.
8. Com envio lento, navegue para outra página. O retorno não deve criar toast,
   redirecionar nem alterar a tela atual. Confira também a leitura e o foco pelo
   teclado em uma tela pequena.
