# Validação dos dados da equipe

A lista, a criação e a edição de profissionais agora conferem os campos que a
tela consulta: ID numérico positivo e seguro, nome textual, cargo textual ou
nulo e diária numérica finita ou nula. Campos ausentes não equivalem a null.
A edição e a exclusão também conferem se o ID retornado é o selecionado.

Na leitura, uma linha inconsistente impede a renderização da página e permite
“Tentar novamente”. Na gravação, uma resposta incompatível mantém o formulário
e exige recarga: a operação pode ter ocorrido no servidor. Não há anúncio de
sucesso nem repetição automática. Cargo e diária nulos continuam aceitos;
a diária nula é exibida como “Não informada”.

Esta validação verifica a projeção consultada, não o proprietário (que não faz
parte dessa projeção). O isolamento continua sendo responsabilidade de RLS.
Não há alteração das regras de entrada de valores nem SQL nesta etapa.

## Verificação manual

1. Em Equipe, confira listagem e paginação nos dois idiomas.
2. Cadastre e edite um profissional de teste com diária em reais. Confira uma
   notificação de sucesso e o registro atualizado após confirmação.
3. Exclua o profissional de teste; confira a confirmação e a atualização da lista.
4. Se já houver registros com cargo/diária nulos, confira a exibição e edição.
5. Em caso de aviso de resultado incerto, recarregue e confira o resultado antes
   de tentar novamente. Não altere dados reais para simular respostas inválidas.

## Testes automatizados

`npm run test:team` cobre campos nulos legítimos, tipos incorretos, campos
omitidos, valores não finitos, ID errado e preservação do formulário sem reenvio.
Também verifica recuperação da leitura por retry. APIs são simuladas.

As suítes `test:deletions` e `test:mutations` verificam regressões nas confirmações
e no ciclo de vida. Tipos gerados do schema e validação das gravações das demais
entidades continuam pendentes.
