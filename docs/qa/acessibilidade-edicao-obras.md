# Acessibilidade da edição e exclusão de obras

Esta etapa não exige SQL. O formulário de edição recebe foco no nome e tem label
visível; a confirmação de exclusão identifica a obra e descreve a perda dos dados.
Cancelar ou Escape devolvem foco à ação da mesma obra. Após salvar, o foco volta
a Editar; após excluir e recarregar, vai ao título da lista.

## Verificação manual

Use uma obra de teste, pois excluir remove também seus dados vinculados.

1. Em Projetos, navegue com Tab até Editar, inclusive na segunda página. Abra
   com Enter e confira o foco no nome. Altere o texto e pressione Escape: o
   rascunho deve ser descartado e o foco voltar ao Editar da mesma obra.
2. Repita usando Cancelar. Depois edite e pressione Enter no campo: deve salvar
   uma vez e devolver foco ao Editar, com o novo nome anunciado.
3. Abra Excluir pelo teclado. O foco deve ir para Cancelar. Confira com leitor de
   tela o nome da obra e a descrição da perda dos dados. Escape e Cancelar devem
   fechar a confirmação e devolver foco ao Excluir da mesma obra, sem apagar.
4. Troque o idioma com o formulário aberto: rascunho e confirmação devem ser
   preservados, sem nova consulta nem gravação. Confira os textos em inglês.
5. Simule rede lenta. Durante salvar/excluir, Cancelar e Escape não devem fechar
   o fluxo; repetição de envio não deve gerar outra gravação. Se o resultado for
   incerto, o aviso de recarga deve continuar bloqueando ações.
6. Exclua uma obra de teste, inclusive a última da última página. Após a leitura,
   confira o foco no título da lista e a página corrigida (ou o estado vazio).
7. Em celular/PWA e desktop, confira os botões, foco visível, zoom e leitura ao
   ar livre. Esta etapa não substitui a avaliação global de contraste.

## Cobertura automatizada

`npm run test:projects` exercita foco, label, cancelamento, submissão repetida,
resposta pendente, troca de idioma e retorno à lista, com React em jsdom e
Supabase simulado. O evento de submit é disparado diretamente; o comportamento
real de Enter, leitor de tela e apresentação visual precisa da verificação acima.
