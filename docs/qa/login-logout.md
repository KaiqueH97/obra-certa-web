# Login e logout no navegador

## Correção

O login tinha um atraso fixo de um segundo e apagava todas as notificações antes
de navegar. Exceções podiam deixar o formulário bloqueado. Os dois botões de saída
ignoravam o erro retornado por `signOut` e anunciavam sessão encerrada mesmo sem
confirmação.

`lib/auth-actions.ts` concentra o fluxo, integrado ao React pelo
`AuthActionsProvider` no layout raiz. A instância pertence à aplicação montada;
não há estado de sessão compartilhado entre requisições no servidor.

- O login exige resposta sem erro, usuário e sessão correspondentes. Falhas
  preservam os campos, resolvem o toast e liberam uma nova tentativa explícita.
- Não há timer nem repetição automática de operações. Cada ação atualiza apenas
  sua própria notificação.
- Menu e perfil usam a mesma ação de logout e a mesma trava síncrona. Cliques
  rápidos não enviam duas requisições antes de o React atualizar os botões.
- A confirmação inicia `window.location.replace` para um destino fixo. Isso
  reinicia a aplicação e seu cache de navegação nesta aba, com os cookies atuais.
  A navegação completa tem um custo de carregamento maior que a troca de rota
  interna, mas evita reutilizar o estado React da sessão anterior.
- Durante essa navegação, a trava permanece ativa até descarregar a página.
- Uma resposta após desmontar o provider não provoca navegação tardia.

## Logout parcial

O código instalado em `node_modules/@supabase/auth-js/src/GoTrueClient.ts`, método
`_signOut`, pode remover a sessão local mesmo quando retorna erro da revogação
remota. Por isso, após `signOut`, a ação verifica `getSession`:

| Resultado | Comportamento |
| --- | --- |
| Sem erro e sem sessão local | Navega para `/login` |
| Com erro ou exceção, mas sem sessão local | Navega para `/login?saida=parcial`, onde aparece um aviso de saída não confirmada nos outros dispositivos |
| Sessão ainda presente ou leitura inconclusiva | Exibe erro, libera o botão e não anuncia sucesso |

O escopo `global` do logout foi mantido explicitamente. A leitura local serve
somente para conferir a remoção da sessão neste navegador; autorização de dados
continua com o proxy e as políticas de RLS.

## Validação

`npm run test:auth-actions` executa 22 testes do controlador real com respostas
simuladas: confirmação, credenciais inválidas, e-mail não confirmado, sessão
ausente/divergente, falhas de rede, saída parcial, cliques duplicados e desmontagem.
Não são testes de navegador conectado ao Supabase.

Roteiro manual desta etapa:

1. Entre com senha incorreta: deve aparecer erro e o botão deve voltar a funcionar.
2. Entre com credenciais corretas: deve abrir `/home` sem a espera artificial.
3. Abra o perfil no desktop. Com conexão lenta, clique em sair pelo perfil e pelo
   menu: só deve haver uma operação de logout, com ambos os botões desabilitados.
4. Repita a saída no mobile e entre novamente. Confira que as listas são carregadas
   para a conta atual.
5. Simule falha no endpoint de logout. Se o SDK preservar a sessão, deve aparecer
   erro com possibilidade de tentar novamente. Se remover a sessão local, o login
   deve mostrar o aviso de saída parcial. Não deve aparecer sucesso completo.
6. Confira que uma notificação de conexão não desaparece por um `toast.dismiss()`
   global ao entrar. Na navegação completa, as notificações da página anterior
   naturalmente deixam de existir.

Nenhuma migration é necessária. Cadastro, recuperação de senha, edição do perfil,
sincronização visual entre outras abas e restauração de páginas pelo histórico
do navegador não foram reimplementados nesta etapa.
