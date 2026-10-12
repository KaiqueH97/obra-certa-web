# Limite de espera nas gravações

## Problema e alteração

O controle de gravações já ignorava respostas após sair da tela, mas uma chamada
sem resposta ainda podia manter “Salvando...” indefinidamente enquanto a página
permanecesse aberta. Após uma falha inconclusiva, a mensagem recomendava conferir
os dados, porém o executor permitia enviar outra inserção imediatamente.

`createMutationRunner` agora limita cada espera local a **20 segundos**, contando
inclusive a consulta de sessão anterior ao INSERT de obras e profissionais. O
prazo é encerrado também no sucesso, erro ou saída da tela. Um timeout sinaliza
cancelamento às validações pendentes, evitando que iniciem um INSERT atrasado.
Respostas posteriores não aplicam dados, não anunciam sucesso e não retiram o
bloqueio da interface.

| Resultado | Comportamento |
| --- | --- |
| Registro com ID e `error: null` | Atualiza a interface com o registro confirmado |
| Erro explícito de permissão `42501` ou validação local via `MutationError` antes da confirmação | Informa o erro e permite corrigir/tentar manualmente |
| Timeout, exceção de rede, resposta incompleta ou outro erro sem confirmação | Encerra o carregamento e exige recarregar antes de novas gravações |
| Erro ao aplicar uma resposta já confirmada na interface | Exige recarregar, pois repetir pode duplicar a operação |

`PGRST116` também exige recarregar: a ausência de uma representação singular
confirmada não deve liberar a repetição automática de uma gravação. Outros erros
não classificados são tratados conservadoramente como resultado incerto.

## Interface

Projetos, equipe, detalhes da obra (materiais, tarefas e caixa) e calculadora usam
`MutationGuard`, conectado ao estado `requiresReload` do hook existente.

Quando o resultado é incerto:

- A tela conserva os últimos dados confirmados. O preço em edição retorna ao
  valor confirmado; os demais rascunhos permanecem visíveis sem permitir edição.
- Um aviso persistente recebe foco e explica que a operação pode ter concluído
  no servidor. O aviso continua disponível depois que o toast desaparece.
- Um `fieldset` desabilita os controles da tela, inclusive salvamentos por outra
  chave. O executor também rejeita novas chamadas, independentemente do DOM.
- **Recarregar dados** fica fora da área desabilitada e recarrega o documento atual.
  O aviso informa que os rascunhos ainda não salvos serão descartados.
- Links de navegação continuam disponíveis. Recarregar ou reabrir a página cria
  uma nova instância, que consulta os dados novamente. Confira-os antes de repetir.

Uma operação diferente que já estava em andamento pode concluir normalmente;
isso não retira o bloqueio causado pela primeira. Retomar a mesma instância após
abandonar uma gravação pendente também exige recarregar. Não há reenvio automático.

## Limites

O prazo encerra a espera **no cliente**. Não desfaz nem comprova o cancelamento de
uma gravação já enviada ao Supabase. O servidor pode continuar processando-a,
inclusive depois da recarga; este bloqueio local não oferece idempotência entre
abas, páginas ou dispositivos. A operação deve ser conferida antes de repetir.

Não foram alteradas as regras de RLS, os controladores de autenticação/perfil ou
a estrutura do banco. Nenhum SQL, migration, pacote ou variável de ambiente é
necessário nesta etapa.

## Testes automatizados

- `npm run test:mutations`: 35 testes do executor e quatro testes React dos
  cadastros de obras/profissionais, incluindo timeout antes do INSERT.
- `npm run test:deletions`: 18 testes com as páginas reais de equipe e obra,
  incluindo timeout, foco, bloqueio e resposta tardia de exclusão.
- `node --test tests/calculator.test.mjs`: cinco testes, incluindo preservação da
  estimativa e bloqueio após timeout ao salvar um material.

Os testes injetam prazos curtos e respostas controladas para não esperar 20 segundos
por cenário. O código de produção usa 20 segundos. Não alteram o Supabase remoto.

Em 12/10/2026, passaram os 84 testes relacionados (incluindo 22 de proteção de
sessão), o lint dos arquivos alterados, `npx tsc --noEmit` e `npm run build`.
A conferência com requisições reais continua pendente abaixo.

## Conferência manual pendente

Use registros de teste e conexão lenta/interrupção controlada no DevTools.

1. Em projetos, equipe, detalhes de uma obra e calculadora, faça uma gravação
   normal. Confira a confirmação e persistência após recarregar.
2. Deixe uma gravação sem resposta por mais de 20 segundos. “Salvando...” deve
   terminar, o aviso deve receber foco e **Recarregar dados** deve permanecer
   habilitado. Os controles de edição e envio ficam desabilitados.
3. Tente clicar repetidamente ou enviar pelo teclado depois do aviso. Não deve
   haver outra requisição de gravação, inclusive de outro registro da mesma tela.
4. Permita que a resposta original chegue. Ela não deve substituir o aviso por
   sucesso nem remover registros da tela que aguardava confirmação.
5. Confira o aviso sobre descartar rascunhos. Restaure a conexão, clique em
   **Recarregar dados** e verifique se a operação foi concluída no servidor antes
   de cogitar repeti-la.
6. Deixe `/auth/v1/user` pendente ao cadastrar uma obra ou profissional. Depois do
   timeout, libere a resposta. O cadastro abandonado não deve iniciar um INSERT.
7. Saia da página antes do prazo. O aviso da gravação deve desaparecer e o timeout
   não deve criar uma notificação na página seguinte.
8. Confira o aviso e a navegação por teclado em tela pequena, incluindo o botão
   de recarga e os links para outras páginas.
