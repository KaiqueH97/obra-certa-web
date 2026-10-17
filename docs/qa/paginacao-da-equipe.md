# Paginação da equipe

## Problema e correção

A tela `/equipe` buscava todos os profissionais antes de exibir a lista. Agora
consulta até 20 registros por página com contagem exata e ordenação por
`criado_em DESC, id DESC`. O cabeçalho mostra o total da equipe, não apenas a
quantidade da página atual; a navegação informa a faixa visível.

A validação de páginas foi extraída para `lib/pagination.ts`, compartilhada com
as obras por `lib/project-pagination.ts`. Mantém detecção de respostas truncadas,
contagem ausente, IDs inconsistentes e recuperação de página removida por
exclusões em outra aba, inclusive a resposta `PGRST103` do PostgREST.

- Cadastro confirmado retorna à primeira página e atualiza o total.
- Exclusão confirmada recarrega a página para preencher a vaga. Se a última
  página ficar vazia, volta à anterior. Excluir o último registro mostra o vazio.
- Edição usa a resposta confirmada do banco, sem recarregar a lista.
- Edição e confirmação abertas bloqueiam paginação e outras alterações até
  concluir ou cancelar, evitando deixar um formulário fora da página.
- Ao navegar ou excluir, o foco segue para o título da lista depois de carregar.
  Cancelar exclusão ou usar Escape devolve o foco ao botão que abriu a confirmação.
- Falha de leitura mostra **Tentar novamente** e oculta ações sobre dados antigos.
  Repetir a leitura após um cadastro confirmado não repete o INSERT.
- Os rótulos dos campos estão associados aos inputs; ações de edição têm nomes
  acessíveis. Diária nula, permitida pelo schema, mostra **Não informada** sem
  interromper a renderização da lista. Diária zero continua sendo exibida como zero.

## Verificação automatizada

`npm run test:team` exercita o componente real com React/jsdom e Supabase simulado:
navegação e faixas, contagem, foco, criação, edição e validação monetária, exclusão,
erro de leitura, RLS, valores nulos e resposta tardia após desmontagem.

`npm run test:projects`, `npm run test:deletions` e `npm run test:mutations` verificam
regressões no carregador compartilhado, nas confirmações e no ciclo de gravação.
Os testes não acessam o Supabase remoto.

## Roteiro manual

Use uma conta de teste. Para excluir, utilize profissionais sem pagamentos reais.

1. Com pelo menos 21 profissionais, abra **Minha Equipe**. Confira o total no
   cabeçalho e até 20 linhas. No Network, a consulta de `funcionarios` deve usar
   `offset=0` e `limit=20`, sem baixar as outras páginas antecipadamente.
2. Avance e volte. Confira `offset=20` na segunda página e o foco no título da
   lista depois de carregar. Teste em largura mobile e com teclado.
3. Cadastre um profissional na segunda página com diária `175,50`. Deve voltar
   à primeira, mostrar o novo cadastro e atualizar a contagem, mantendo até 20 itens.
4. Edite nome, cargo e diária. A paginação e o cadastro ficam bloqueados durante
   a edição. Salve e recarregue o navegador para conferir persistência.
5. Abra a exclusão, cancele com Escape e confirme o retorno do foco ao botão de
   excluir. Abra novamente e confirme: o registro só desaparece após sucesso.
6. Com exatamente 21 registros, exclua o único da segunda página: deve voltar à
   primeira. Com mais de 20, exclua na primeira: a vaga deve ser preenchida pelo
   próximo registro. Em uma conta com apenas um profissional, excluir deve mostrar
   o estado vazio e desabilitar os dois controles de navegação.
7. Em duas abas, mantenha a primeira parada na página inicial. Na segunda, exclua
   registros suficientes para eliminar a próxima página. Ao avançar na primeira,
   a tela deve ajustar a página ao novo total, inclusive após HTTP 416.
8. Simule conexão lenta ao avançar: não deve permitir alterações na lista anterior.
   Bloqueie a leitura REST, confira a mensagem de erro, desbloqueie e clique em
   **Tentar novamente**. A tentativa deve consultar a página solicitada.
9. Navegue para outra tela durante uma leitura lenta. A resposta anterior não deve
   reaparecer na nova tela. Confira também a lista de obras após a extração da lógica.

## Limites

Não é necessário SQL nem mudar políticas de RLS. A paginação utiliza o cliente
autenticado existente. O seletor de profissionais dentro da obra continua com seu
carregamento atual; esta etapa altera somente a tela de gestão da equipe.

O índice da página é local; reabrir/recarregar a rota começa na primeira. Offset
e contagem exata ainda têm custo no banco em bases grandes. Alterações concorrentes
podem deslocar itens entre páginas: não há snapshot nem sincronização em tempo real.
