# Cadastro com confirmação de resultado

## Problema corrigido

A página de cadastro tratava qualquer resposta sem erro como conta criada,
ignorando usuário e sessão. Ela anunciava confirmação por e-mail mesmo quando o
Auth já retornava sessão. Exceções podiam deixar o formulário preso em envio;
havia ainda um `Toaster` duplicado, campos editáveis durante a requisição e links
de login apontando para a landing page.

## Comportamento

`lib/signup.ts` controla a operação por instância da página, com trava síncrona
contra cliques duplicados. `app/cadastro/page.tsx` apresenta o estado na própria
tela, com campos rotulados, feedback acessível e foco nos avisos finais.

| Resposta | Resultado na interface |
| --- | --- |
| Usuário e sessão correspondente, com token | Navegação completa para `/home`, mantendo envio bloqueado até descarregar |
| Usuário e `session: null` | Aviso neutro para conferir e-mail, com links de login e recuperação |
| Rejeição HTTP 4xx explícita | Erro compreensível, campos preservados e nova tentativa manual disponível |
| Rede, erro 5xx/sem status, resposta incompleta ou espera acima de 20 segundos | Resultado incerto, com orientação para conferir e-mail/entrar antes de enviar outro cadastro |

O Supabase pode retornar um usuário ofuscado quando o e-mail já está cadastrado.
Por isso, o aviso sem sessão não garante que uma conta foi criada ou que uma
mensagem foi entregue. O tratamento segue o contrato de
[signUp do Supabase](https://supabase.com/docs/reference/javascript/auth-signup)
e o código instalado em `@supabase/auth-js`.

Nome e e-mail são aparados nas extremidades; a senha não é alterada. O mínimo
local é seis caracteres e o servidor continua aplicando sua política de senha.
A senha é removida do estado ao concluir ou entrar no resultado incerto. Mensagens
brutas do servidor não são exibidas. O cadastro não usa notificações globais.

## Concorrência e limites

Não há repetição automática. Depois de resultado incerto, a mesma instância não
reenviará cadastro; ela oferece acesso ao login e à recuperação. Recarregar ou
abrir outra aba não fornece idempotência e não deve substituir a conferência do
resultado anterior.

Desmontar a página encerra a espera local e invalida respostas posteriores.
Nenhum retorno tardio atualiza a página ou dispara sua navegação, inclusive após
reativação do controlador. O timeout/desmonte não cancela a operação no servidor
nem impede efeitos internos do SDK sobre a sessão caso a resposta chegue depois.

Os links de e-mail continuam usando a configuração existente de Site URL e
templates no Supabase. Não foram alteradas configurações de confirmação, entrega
de e-mail, políticas de senha ou recuperação/redefinição de senha nesta etapa.

## Testes automatizados

`npm run test:signup` executa 22 testes: 17 do controlador e cinco da página React
em jsdom. Cobrem respostas com/sem sessão, usuário ofuscado, respostas incompletas,
identidades divergentes, dados acompanhados de erro, rejeição, limite de tentativas,
cliques duplicados, timeout, desmontagem, normalização de campos, foco e payload.

Supabase e navegação são simulados. Os testes não criam usuários reais nem enviam
e-mails. A entrega e confirmação no ambiente real precisam da conferência abaixo.

Em 26/09/2026, passaram os 22 testes novos, os 77 testes de regressão de login,
logout, proxy e sessão, o lint dos arquivos alterados, `npx tsc --noEmit` e
`npm run build`.

## Conferência manual pendente

1. Em uma janela sem sessão, abra `/cadastro`. Confira os rótulos, autocomplete e
   os links **Faça Login** (`/login`) e **Recuperar acesso** (`/recuperar`).
2. Use uma conta de teste. Com conexão lenta, tente enviar duas vezes: deve haver
   uma requisição de signup, com campos bloqueados durante o envio.
3. Com confirmação de e-mail habilitada, deve aparecer o aviso para conferir a
   caixa de entrada, sem redirecionamento à landing page. Siga o e-mail recebido
   e confirme que consegue entrar. Não altere a configuração de produção só para
   testar a variante sem confirmação; essa variante está coberta pelos testes.
4. Se o ambiente já estiver configurado para retornar sessão imediata, o cadastro
   deve abrir `/home` com a conta correspondente.
5. Teste uma senha recusada pelo servidor. Deve aparecer erro sem apagar nome,
   e-mail ou senha, permitindo corrigir e enviar novamente.
6. Bloqueie temporariamente `/auth/v1/signup` no DevTools. A tela deve sair do
   estado de envio para resultado incerto, após no máximo 20 segundos de espera
   local, sem anunciar sucesso ou reenviar. Confira e-mail/login antes de repetir.
7. Saia da página com uma solicitação pendente. A resposta posterior não deve
   forçar navegação nem deixar uma notificação de carregamento global.

Nenhum SQL, migration, pacote ou variável de ambiente é necessário nesta etapa.
