# Resumo do dashboard no banco

## Correção

O dashboard baixava todos os projetos, tarefas e materiais com `loadAllRows`,
mantinha essas listas temporariamente na memória e calculava totais no navegador.
Usava somente quatro projetos na tabela de recentes. O volume de dados e de
requisições aumentava com o histórico inteiro da conta.

Agora `public.resumo_dashboard()` entrega um objeto com os quatro projetos mais
recentes e os indicadores agregados pelo PostgreSQL. A tela faz uma chamada RPC
por carregamento. As consultas de Auth da proteção de sessão continuam existindo.
As listas das demais telas continuam com o comportamento da etapa anterior.

Indicadores mantidos:

- Obras: todos os projetos visíveis ao usuário. O schema não tem status de obra;
  por isso o cartão foi renomeado para **Obras Cadastradas**.
- Tarefas concluídas: `concluida = true`.
- Pendentes: `false` ou `null`. Sem datas de vencimento, o aviso usa **Pendentes**.
- Custo: soma de `materiais_projeto.preco_total`, com valores nulos ignorados e
  zero para conjunto vazio. O cartão agora diz **Custo de Materiais**: não inclui
  pagamentos da equipe nem recebimentos do caixa.

A soma usa `numeric` no PostgreSQL. Totais e projetos recentes são calculados no
mesmo SELECT; os recentes ordenam por `criado_em DESC, id DESC`, inclusive em empates.
O limite de linhas REST não trunca as agregações, pois o retorno é um objeto JSON.

## Segurança e falhas

A função usa `SECURITY INVOKER`, `STABLE`, `search_path` vazio e tabelas qualificadas.
Não recebe ID de conta e exige `auth.uid()`. A execução é concedida somente ao
papel `authenticated`, preservando as políticas RLS já aplicadas. Não usa chave
privilegiada no frontend. Veja a [documentação de funções do Supabase](https://supabase.com/docs/guides/database/functions).

`lib/dashboard.ts` valida o contrato recebido. Resposta nula, incompleta, contadores
inválidos, custos não finitos ou lista incompatível com o total não viram indicadores
zerados. A tela conserva o tratamento de erro, cancelamento, timeout de 20 segundos
e nova tentativa explícita de `useDataLoad`. Não há fallback que baixe as tabelas
se a função estiver ausente ou não puder ser executada.

São adicionados três índices para busca de projetos por usuário/data, tarefas por
projeto e materiais por usuário/projeto. Os totais ainda exigem leitura no banco;
esta etapa reduz principalmente transferência e processamento no navegador.
Não foi medido ganho de latência no Supabase de produção.

## Aplicação no Supabase — antes de publicar o frontend

1. No SQL Editor, execute o conteúdo completo de
   [20260914000100_resumo_dashboard.sql](../../supabase/migrations/20260914000100_resumo_dashboard.sql).
   A migration pressupõe a etapa de RLS já aplicada. Ela cria índices e a função;
   não altera registros ou políticas. Pode retornar **Success. No rows returned**.
   A criação dos índices pode aguardar/bloquear gravações durante sua execução;
   escolha um momento sem uso intenso. A operação é transacional e reaplicável.
2. Execute [diagnostico-dashboard.sql](../database/diagnostico-dashboard.sql).
   Esperado: `funcao_existe`, `usa_permissoes_do_usuario`,
   `somente_leitura_stable` e `authenticated_pode_executar` como `true`;
   `anon_pode_executar` e `service_role_pode_executar` como `false`;
   `indices_criados = 3`; configuração contendo `search_path=""`.
   Isso verifica metadados, não substitui o teste de isolamento entre contas.
3. Teste o código local e depois publique o commit. A versão antiga do app continua
   funcionando com a função adicionada. A nova versão precisa da função aplicada.

Não chame a RPC diretamente como administrador no SQL Editor para conferir totais:
essa sessão não representa a conta autenticada do navegador. Os dados devem ser
conferidos pelo app. Não é necessário enviar tokens, chaves ou senhas.

## Conferência manual pendente

1. Antes de aplicar/publicar, anote os quatro indicadores de uma conta conhecida.
   Com o código novo, confira os mesmos valores (considerando os rótulos corrigidos).
2. Abra `/home` e filtre Network por `resumo_dashboard`: deve haver uma chamada de
   resumo, com no máximo quatro projetos na resposta. Não deve haver consultas REST
   às três tabelas para montar o dashboard. No desenvolvimento, Strict Mode pode
   mostrar também uma primeira tentativa cancelada.
3. Confira a ordem dos projetos recentes e abra um deles. Repita em outra conta,
   verificando que os dados pertencem a ela, e em uma conta sem registros.
4. Bloqueie o endpoint `/rest/v1/rpc/resumo_dashboard` no DevTools e recarregue:
   deve aparecer erro, sem indicadores parciais. Desbloqueie e use **Tentar novamente**.
5. Adicione uma tarefa ou altere o preço de um material e recarregue o dashboard:
   a nova consulta deve refletir os dados confirmados. Não há atualização em
   tempo real enquanto a página permanece aberta.

## Testes locais

- `npm run test:dashboard`: contrato e componente React com RPC simulada.
- `npm run test:dashboard-db`: integração em PostgreSQL descartável, sem conexão
  remota, usando schema e RLS do projeto. Requer PostgreSQL local, como `test:rls`.

Os testes de banco usam duas contas, uma terceira vazia e 1.205 registros por
conjunto principal. Conferem totais, nulos, ordenação, isolamento, grants, política
restritiva adicional, falha sem permissão, preservação de políticas e reaplicação.

Em 14/09/2026, passaram 19 testes novos do frontend, 46 testes de regressão de
carregamento/sessão, 19 verificações da RPC e 167 verificações de regressão de RLS
em PostgreSQL local. Também passaram o diagnóstico novo, lint dos arquivos de
código alterados, `npx tsc --noEmit` e `npm run build`.

Se precisar voltar o frontend, a função e os índices podem permanecer no banco:
o código antigo não os utiliza. A aplicação no Supabase e os testes manuais ainda
dependem da execução pelo usuário.
