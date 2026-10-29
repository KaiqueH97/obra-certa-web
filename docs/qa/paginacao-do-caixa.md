# Paginação do caixa — implantação e QA

## Antes de publicar

1. No SQL Editor do Supabase, execute todo o arquivo
   `supabase/migrations/20261028000100_pagina_caixa.sql`.
   A migration depende da de RLS já aplicada; cria uma função de leitura e um
   índice, sem alterar registros ou políticas. O retorno esperado é sucesso sem
   linhas. Em tabelas grandes, a criação do índice pode aguardar/bloquear
   gravações durante sua execução; aplique fora do horário de uso intenso.
2. Execute `docs/database/diagnostico-caixa.sql`. Esperado:
   `funcao_existe`, `usa_permissoes_do_usuario`,
   `somente_leitura_stable` e `authenticated_pode_executar` = true;
   `anon_pode_executar` e `service_role_pode_executar` = false;
   `indices_criados` = 1 e `configuracao` contendo search_path vazio.
3. Só então publique o frontend. Sem a função, o caixa mostra erro local e os
   indicadores financeiros ficam indisponíveis; materiais e tarefas continuam
   disponíveis. O SQL é compatível com o frontend anterior.

Não validar a identidade pelo SQL Editor como administrador: os testes das
contas devem usar sessões reais do aplicativo. Nenhum SQL remoto foi executado
automaticamente pelo assistente.

## Testes manuais

- Com mais de 20 lançamentos, avance e volte. A lista muda, mas Entradas e Equipe
  consideram todas as transações. Lucro Atual desconta também todos os materiais.
- Na aba Network, confira `rpc/pagina_caixa`: no máximo 20 transações por
  resposta. A abertura da obra não deve mais fazer leitura integral de
  `financeiro_obra`. A ordem continua por ID decrescente.
- Crie um recebimento ou pagamento na última página: após confirmação, deve
  voltar à primeira página, com totais e nome do profissional atualizados.
- Exclua o único lançamento da última página: deve retornar à última página
  válida. Enquanto a confirmação estiver aberta ou enviando, a navegação fica
  bloqueada. Cancelar devolve foco ao botão; confirmar leva ao título do caixa.
- Simule falha de rede após uma criação/exclusão confirmada. Mostre erro e
  indicadores “Indisponível”, nunca zero como se fosse uma obra vazia. Tentar
  novamente deve fazer somente RPC de leitura, sem repetir INSERT/DELETE.
- Verifique obra sem lançamentos (zero legítimo), descrição nula e profissional
  removido (rótulo Equipe).
- Troque idioma com rascunho, seleção e confirmação abertos. Preserve dados
  originais e BRL. Confira foco, rolagem e paginação no celular/PWA.
- Troque de obra ou faça logout com consulta lenta: a resposta antiga não deve
  substituir dados da tela atual.
- Use duas contas: nenhuma pode consultar a obra da outra pela RPC. Teste também
  obra inexistente e sessão expirada.
- Altere preço ou exclua material: custo e lucro devem refletir a alteração;
  pedido de cotação ainda inclui todos os materiais.

## Automação e limites

`npm run test:cash`: contrato e ciclo de leitura com API simulada.
`npm run test:deletions`: formulário, exclusões e totais na página com API simulada.
`npm run test:cash-db`: PostgreSQL descartável, RLS, permissões, 1.206 lançamentos
da conta A e outra conta, migração reaplicável e ajuste de página.
Esses testes não certificam o ambiente remoto nem substituem o teste visual.

Entradas e pagamentos vêm do mesmo snapshot do banco. Materiais ainda vêm da
leitura própria da tela; não há atualização em tempo real entre sessões. A
próxima etapa agrega custos e pagina materiais, preservando a cotação completa.

Referências do desenho: [funções no Supabase](https://supabase.com/docs/guides/database/functions)
e [CREATE FUNCTION no PostgreSQL](https://www.postgresql.org/docs/current/sql-createfunction.html).
