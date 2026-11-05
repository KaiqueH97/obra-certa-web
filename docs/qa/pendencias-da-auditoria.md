# Pendências confirmadas — atualização de 04/11/2026

Revisão direcionada do código atual, após paginação de obras e equipe. Não é
uma nova certificação de segurança nem uma revisão das configurações remotas.

| Prioridade | Evidência | Próxima correção |
| --- | --- | --- |
| Validação manual | Tradução das telas, avisos e PWA implementada. | Executar o [roteiro de idiomas](./idiomas.md) no celular, com leitor de tela e no PWA instalado. |
| Média | Detalhes de obra: campos e botões receberam nomes acessíveis na tradução; ainda há estilos de texto claro que exigem verificação visual. | Revisar associação de labels, nomes de botões, foco e contraste medido em estados normal/desabilitado, nas duas línguas. |
| Baixa | Tipos escritos manualmente divergem do schema em campos opcionais, por exemplo `preco_total`/`concluida` nos detalhes. | Gerar tipos do schema real e validar os dados de entrada nas fronteiras, sem tratar resposta inválida como sucesso. |

RLS, autenticação e gravações têm correções e testes anteriores. Esta revisão não
confirma novas brechas nessas camadas; futuras alterações devem preservar as
políticas e as verificações já implementadas. Os testes locais simulam as APIs;
os roteiros manuais continuam necessários no ambiente conectado ao Supabase.

## Correção desta etapa

A exclusão direta de lançamentos do caixa foi substituída por confirmação local
com valor, efeito sobre o saldo, foco e tradução. Veja o
[roteiro de exclusão do caixa](./exclusao-do-caixa.md). A próxima frente de
performance continua sendo a paginação das abas com totais agregados no banco.

## Seletor de obras da calculadora

Busca no servidor e páginas de 20 obras substituem a leitura integral da lista.
A seleção fica preservada fora da página e consultas antigas são canceladas.
Veja o [roteiro de busca de obras](./busca-de-obras-na-calculadora.md).

## Seletor de profissionais do caixa

A equipe passa a ser consultada apenas ao escolher pagamento, em páginas de 20
com busca no servidor e seleção preservada. Veja o
[roteiro de busca de profissionais](./busca-de-profissionais-no-caixa.md).
A próxima etapa é paginar as abas da obra com totais calculados no banco.

## Paginação de tarefas

O checklist agora consulta 20 tarefas por página, ordenadas pelas mais recentes,
com leitura e falhas independentes do carregamento principal da obra. Criação e
conclusão confirmadas atualizam a página e o total; falha nessa releitura permite
tentar novamente sem repetir a gravação. Roteiro:
[paginação de tarefas](./paginacao-de-tarefas.md).

A paginação de materiais foi concluída na etapa abaixo.

## Paginação do caixa

A RPC `pagina_caixa` retorna até 20 lançamentos, contagem e totais de entradas e
pagamentos da obra em uma única consulta sob RLS. Falhas da RPC não viram saldo
zero; confirmação de gravação é separada da releitura. Aplicar a migration antes
do frontend conforme o [roteiro do caixa](./paginacao-do-caixa.md).

Na etapa seguinte, materiais também passaram a ter paginação e custo agregado;
a cotação completa passou a ser carregada sob demanda.

## Paginação de materiais e cotação completa

Materiais agora consultam páginas de 20 itens com custo integral agregado no
banco. Alterar preço, nome, quantidade ou excluir relê a página e o total após
confirmação. Falhas não exibem custo ou lucro zerado.

A cotação consulta todos os nomes e quantidades em uma RPC separada, somente
após solicitar. O usuário abre o WhatsApp pelo link preparado, ou copia o texto
completo. Não há mais leitura integral de materiais na abertura da obra.
Aplicação da migration e QA: [paginação de materiais](./paginacao-de-materiais.md).

Os indicadores fixos e o botão sem ação foram tratados na etapa abaixo.

## Indicadores das obras

Removidos status “Em andamento”, percentual “0%” e localização “Local a definir”,
pois não vinham de dados cadastrados. A data real de criação aparece nas duas
telas, inclusive no mobile. Os totais reais do dashboard permanecem.

O botão “Gerar Relatório” foi retirado por não ter implementação. Um relatório
geral e um acompanhamento de progresso físico continuam funcionalidades futuras,
dependentes de definição de conteúdo e regras; tarefas concluídas não equivalem
automaticamente à conclusão física da obra. Roteiro:
[indicadores das obras](./indicadores-das-obras.md).

## Acessibilidade da edição de materiais

O formulário agora recebe foco no nome ao abrir; cancelar ou pressionar Escape
devolve foco ao botão Editar. Enter envia o formulário e a gravação pendente
bloqueia cancelamento/reenvio. Nome, quantidade e custo têm labels associados.
Botões de ação ganharam área mínima de 44 px e foco visível; os de obras
anunciam o nome do registro. Roteiro:
[edição acessível de materiais](./acessibilidade-edicao-materiais.md).

A revisão global de contraste e leitor de tela permanece pendente. Esta etapa
não certifica conformidade do aplicativo inteiro. O fluxo de obras foi tratado
na etapa abaixo.


## Acessibilidade da edição e exclusão de obras

A edição usa formulário com label visível e envio por Enter. Cancelar ou Escape
devolvem foco à ação da mesma obra; salvar confirmado devolve foco ao Editar.
A confirmação de exclusão recebe foco em Cancelar, identifica a obra e associa
a descrição da perda dos dados. Gravações pendentes continuam bloqueando
cancelamento e reenvio. Após excluir e reler, o foco vai ao título da lista.

Testes locais cobrem os fluxos com Supabase simulado. A validação real de teclado,
leitor de tela e apresentação mobile permanece manual conforme o
[roteiro de edição e exclusão de obras](./acessibilidade-edicao-obras.md).

## Acessibilidade do formulário do caixa

Tipo de lançamento, descrição e valor têm rótulos visíveis associados aos
controles, preservados após preenchimento e traduzidos para inglês. O formulário
recebeu foco de teclado mais evidente e placeholders mais escuros. Valores
continuam em BRL. A associação dos rótulos foi verificada no teste existente de
lançamento com troca de idioma. Veja o
[roteiro do formulário do caixa](./acessibilidade-formulario-caixa.md).

A medição global de contraste e a validação real com leitor de tela permanecem
pendentes; esta alteração não certifica conformidade do aplicativo inteiro.

## Navegação acessível entre seções da obra

O seletor mobile agora informa a seleção por `aria-pressed` e associa os botões
às regiões nomeadas de Orçamento, Caixa e Tarefas. O foco do teclado ficou
explícito e as cores dos textos foram escurecidas. O desktop mantém as três
colunas visíveis; a troca de seção mantém rascunhos sem novas requisições.
Roteiro: [navegação entre seções](./navegacao-secoes-obra.md).

A validação real dos breakpoints, leitor de tela e contraste continua pendente.

## Validação da leitura de obras

A lista de obras agora rejeita título não textual, proprietário vazio ou não
textual e data de criação ausente ou não interpretável. A tela usa o erro com
retry existente, sem renderizar registros parciais. IDs e contagem continuam
validados pela paginação comum. Veja o
[roteiro de validação da lista](./validacao-lista-obras.md).

Esta etapa cobre a leitura da lista. Gerar tipos a partir do schema real e revisar
as demais fronteiras, incluindo respostas de gravação, continua pendente.

## Validação da confirmação de gravações de obras

Criação e edição da lista de obras agora validam a linha retornada antes de
anunciar sucesso. A criação confere o proprietário do envio; a edição confere
ID e proprietário originais; a exclusão confere o ID selecionado. Respostas
inconsistentes mantêm o formulário e exigem recarga, pois a gravação pode ter
ocorrido no servidor. Roteiro:
[validação das gravações de obras](./validacao-gravacoes-obras.md).

O executor aceita validação específica opcional. A aplicação dessa validação nas
demais entidades e a geração de tipos do schema continuam pendentes.

## Validação dos dados da equipe

A leitura e a confirmação de criação/edição validam ID, nome, cargo e diária na
projeção consultada. Cargo e diária nulos continuam aceitos. Edição e exclusão
exigem o ID selecionado. Respostas de gravação incompatíveis preservam o
formulário e bloqueiam reenvio até recarga; leitura inválida oferece retry.
Roteiro: [validação da equipe](./validacao-equipe.md).

O proprietário não faz parte dessa projeção; RLS continua responsável pelo
isolamento. A validação das gravações de materiais, tarefas e caixa e a geração
de tipos do schema permanecem pendentes.

## Validação das confirmações de tarefas

Criação e alteração do checklist agora validam a linha retornada e o vínculo com
a obra. Alterações também exigem o ID selecionado e o estado de conclusão
solicitado. Respostas inconsistentes preservam o rascunho e exigem recarga antes
de novo envio. A leitura compartilha o validador e aceita conclusão nula,
conforme o schema. Roteiro: [validação das tarefas](./validacao-tarefas.md).

A validação das gravações de materiais e caixa e a geração de tipos do schema
continuam pendentes.
