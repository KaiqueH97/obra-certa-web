# Busca paginada de obras na calculadora

## Mudança

A calculadora baixava todas as obras com `loadAllRows` ao abrir a página.
`ProjectPicker` agora consulta apenas `id, titulo`, com contagem exata e faixas
de 20 registros, ordenadas por `criado_em DESC, id DESC`. A lista só é consultada
quando existe uma estimativa pronta para vincular a uma obra.

Digite parte do nome e clique em **Buscar**, ou pressione Enter. O filtro é
aplicado no servidor com `ilike`; enviar busca vazia volta à listagem completa,
sempre paginada. Digitar sozinho não dispara consultas. `%`, `_` e barra invertida
são escapados; o asterisco mantém a semântica de curinga do PostgREST.

A escolha é armazenada separadamente dos resultados. Paginar, pesquisar, receber
uma lista vazia ou falhar na leitura não apaga a obra selecionada. Ela permanece
identificada e disponível no select, além dos até 20 resultados da página.
Escolher “Selecione um projeto...” limpa a seleção. Sem seleção, salvar é bloqueado.

Uma obra já selecionada pode continuar sendo usada mesmo se uma busca posterior
falhar. O servidor continua validando permissão e existência ao salvar; a seleção
não concede acesso nem contorna RLS. Não há salvamento nem repetição automáticos.

Resultados anteriores ficam indisponíveis durante nova leitura. Consultas antigas
são abortadas e respostas atrasadas são ignoradas. Uma página que desaparece por
exclusões em outra aba retorna à última página disponível. Falhas e respostas
incompletas mostram opção de tentar novamente, sem virar falso resultado vazio.

Durante salvamento, os controles do seletor ficam bloqueados. Trocar português/
inglês preserva busca, página, seleção e estimativa sem repetir consultas. Nomes
das obras, IDs, quantidades e valores em BRL não são traduzidos nem convertidos.

## Limites desta etapa

Nenhuma migração SQL é necessária. A busca reduz transferência e quantidade de
opções no DOM; a contagem exata e o filtro por trecho ainda têm custo no banco.
Bases maiores podem exigir índices e medição de consultas em uma próxima etapa.
O seletor de profissionais e as abas dos detalhes da obra ainda precisam de
paginação própria, junto com totais agregados no banco.

## Testes

`npm run test:calculator` inclui testes da calculadora e do seletor real com
React/jsdom e Supabase simulado: páginas limitadas, busca, seleção fora da lista,
respostas fora de ordem, cancelamento, falha, resposta incompleta, idioma, página
removida, payload salvo e ausência de consultas antes de calcular.

Roteiro manual com conta de teste:

1. Abra `/calcular` e confira no Network que nenhuma lista de obras é baixada.
2. Faça um cálculo válido. A lista deve consultar somente a primeira faixa de
   20 registros e mostrar ordenação consistente.
3. Com mais de 20 obras, selecione uma e avance. A escolha deve continuar visível.
4. Busque outra obra, confira o filtro `titulo=ilike...` e a faixa reiniciada em
   zero. Busque um nome inexistente: a escolha anterior continua identificada.
5. Troque o idioma, limpe a seleção e escolha outra obra. Salve e confira o vínculo
   correto no banco e a preservação de quantidade/preço.
6. Com rede lenta, envie duas buscas seguidas. Só a mais recente pode preencher
   os resultados. Saia da tela: a consulta pendente deve ser abortada.
7. Bloqueie a consulta no Network. Confira erro, seleção preservada e retry.
   Corrigir uma busca não deve recriar ou duplicar o material salvo.
8. No celular e com teclado, confira rótulos, foco, paginação e descrição da obra
   selecionada em ambos os idiomas. Testes jsdom não substituem esta validação.
