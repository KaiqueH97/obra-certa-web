# Navegação entre seções da obra

O seletor mobile de Orçamento, Caixa e Tarefas informa qual botão está pressionado
(`aria-pressed`) e qual região controla (`aria-controls`). Cada região tem nome
traduzido. Os controles são botões nativos: Tab navega e Enter/Espaço ativam.
No desktop, o seletor fica oculto e as três colunas continuam visíveis.

Não há SQL nesta etapa. Trocar de seção preserva os formulários montados e seus
rascunhos, sem disparar gravações ou novas consultas.

## Verificação manual

1. Abra uma obra em uma janela estreita ou no celular/PWA. Orçamento deve começar
   selecionado; Caixa e Tarefas devem mostrar somente seu próprio conteúdo quando
   ativados. Confira o foco visível ao navegar por teclado.
2. Com leitor de tela, confira o nome “Seções da obra”, o estado pressionado do
   botão selecionado e os nomes das regiões. Conteúdo oculto não deve entrar na
   navegação. Tab deve percorrer os botões; Enter/Espaço devem ativá-los.
3. Preencha um rascunho no caixa, vá a Tarefas e volte. O rascunho deve permanecer.
   Troque o idioma: confira “Project sections”, “Budget”, “Cash flow” e “Tasks”,
   sem perder a seleção ou os dados digitados.
4. Aumente a janela até o layout de desktop: as três colunas devem aparecer e o
   seletor mobile deve desaparecer. Reduza novamente e confira a seção escolhida.
5. Confira legibilidade e foco no celular, com zoom e sob luz externa.

## Testes locais

O teste com React/jsdom verifica seleção exclusiva, relação entre controles e
regiões, tradução, foco preservado na troca de idioma e rascunho preservado sem
novas requisições. jsdom não aplica os breakpoints do Tailwind nem substitui os
passos reais de teclado, leitor de tela e avaliação visual acima.
