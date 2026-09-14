# Confirmações de exclusão locais

## Problema corrigido

Equipe e materiais usavam notificações de duração infinita para confirmar uma
exclusão. Como o `Toaster` está no layout raiz, a confirmação podia continuar
visível após navegar para outra página, com nome e callbacks da tela anterior.
Ela também ficava fora da área oculta pela proteção de sessão. Abrir a confirmação
de material chamava `toast.dismiss()` sem ID, apagando notificações de outras ações.

## Comportamento

As duas telas agora usam `app/components/DeleteConfirmation.tsx`, renderizado
junto ao registro. Cada tela mantém apenas uma confirmação aberta. O componente
acompanha a desmontagem da página e a visibilidade da área privada, inclusive
durante a verificação de sessão ao retornar à aba.

- Abrir ou cancelar não envia requisição de exclusão nem altera notificações.
- A confirmação identifica o material/profissional e explica o efeito da exclusão.
  No profissional, informa que os pagamentos permanecem, mas perdem o vínculo
  com ele, conforme a chave estrangeira com `ON DELETE SET NULL`.
- O foco começa em **Cancelar**. Cancelar ou pressionar Escape dentro do painel
  fecha a confirmação e devolve o foco ao botão de exclusão daquele registro.
- Durante a operação, os botões ficam desabilitados e Escape não fecha o painel.
  A trava síncrona do executor existente impede duas exclusões pelo mesmo clique
  duplicado, antes mesmo de o React atualizar os botões.
- O registro só sai da lista depois de o Supabase retornar a linha excluída.
  Erro mantém o registro e a confirmação; não há repetição automática.
- Os avisos de resultado continuam usando o executor de gravações confirmadas.

O painel é um grupo de controles no fluxo da página, com título e descrição
associados para tecnologia assistiva. Não é modal e não prende o foco.

## Validação automatizada

`npm run test:deletions` executa 10 testes com as páginas reais de equipe e obra,
o componente de confirmação, o hook/executor de gravação e a proteção de sessão.
As leituras iniciais, respostas do Supabase, notificações e navegação são simuladas.
O DOM usa jsdom; estes testes não substituem a conferência visual no navegador.

Cobertura: abertura sem requisição, foco, cancelar/Escape, preservação de outras
notificações, clique duplicado, bloqueio durante envio, filtros do DELETE, sucesso,
erro de permissão, navegação, suspensão da página e logout recebido.

Em 14/09/2026, passaram os 10 testes novos, os 63 testes de regressão de gravações,
carregamento e sessão, o lint dos arquivos de código alterados, `npx tsc --noEmit`
e `npm run build`.

## Conferência manual pendente

Use registros de teste nas duas telas:

1. Abra a exclusão de um material e de um profissional. O painel deve aparecer
   junto ao registro correto. Confira o layout no celular e desktop.
2. Cancele com o botão e depois com Escape. O registro deve permanecer e o foco
   voltar à lixeira. Navegue pelos controles com Tab e Shift+Tab.
3. Abra uma confirmação e navegue para outra página sem confirmar. Não deve
   permanecer nenhuma confirmação flutuante. Na volta, ela deve estar fechada.
4. Com confirmação aberta, saia pela outra aba. Ao retornar à primeira, o painel
   deve ser ocultado junto aos dados privados e o login deve abrir.
5. Simule conexão lenta e confirme duas vezes rapidamente: no painel Network
   deve haver apenas um DELETE daquele registro. O item permanece até confirmar.
6. Bloqueie temporariamente a requisição DELETE no DevTools. Ao falhar, deve haver
   aviso de erro, mantendo registro e confirmação. Cancele e recarregue a página
   antes de repetir uma operação cujo resultado tenha ficado incerto.
7. Com uma notificação de outra ação visível, abra e cancele uma exclusão.
   Essa notificação deve continuar seu ciclo normal.

Nenhum SQL, migration, pacote novo ou variável de ambiente é necessário.
