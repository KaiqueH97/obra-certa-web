# Pendências confirmadas — atualização de 28/10/2026

Revisão direcionada do código atual, após paginação de obras e equipe. Não é
uma nova certificação de segurança nem uma revisão das configurações remotas.

| Prioridade | Evidência | Próxima correção |
| --- | --- | --- |
| Média | `app/(sistema)/projetos/[id]/page.tsx`: ainda busca todos os materiais antes de liberar a tela; caixa já lê 20 lançamentos com totais globais no banco. | Paginar materiais e agregar seus custos no banco; preservar a lista completa de cotação. |
| Média | `app/(sistema)/home/page.tsx`: botão “Gerar Relatório” sem ação e status fixo “Em andamento”. `app/(sistema)/projetos/page.tsx`: progresso fixo em 0%. | Implementar relatório e indicadores derivados de dados reais, ou retirar os elementos até terem comportamento funcional. |
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

Ainda falta paginar materiais, agregando seus custos no banco e preservando a
lista completa no pedido de cotação pelo WhatsApp.

## Paginação do caixa

A RPC `pagina_caixa` retorna até 20 lançamentos, contagem e totais de entradas e
pagamentos da obra em uma única consulta sob RLS. Falhas da RPC não viram saldo
zero; confirmação de gravação é separada da releitura. Aplicar a migration antes
do frontend conforme o [roteiro do caixa](./paginacao-do-caixa.md).

Materiais continuam completos no cliente: seu custo e a cotação não são
calculados a partir de uma página parcial. Esse é o próximo ponto de performance.
