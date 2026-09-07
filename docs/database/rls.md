# Correção de isolamento por usuário

Migration: [20260907000100_isolar_dados_por_usuario.sql](../../supabase/migrations/20260907000100_isolar_dados_por_usuario.sql).

## Aplicação confirmada

Em 07/09/2026, o usuário informou que executou a migration no Supabase com retorno
`Success. No rows returned`. O [diagnóstico posterior](./rls-depois.csv) foi
conferido e corresponde às 19 políticas esperadas: RLS habilitada nas cinco tabelas,
papel `authenticated`, validação de propriedade e grants de tabela limitados às
operações do app. `anon` não possui privilégios de tabela no resultado.

A conferência desse CSV confirma o estado das políticas e dos grants de tabela.
A validação funcional pelo aplicativo após a aplicação ainda não foi informada.

## Evidências recebidas

O [diagnóstico anterior](./rls-antes.csv), fornecido em 07/09/2026, mostra RLS
habilitada nas cinco tabelas. O botão **Disable RLS** oferece a ação de desativar
uma proteção que já está ativa. `rls_forcada = false` não significa RLS desabilitada:
proprietários de tabelas e papéis privilegiados têm regras próprias de bypass.

As falhas reproduzidas localmente com esse diagnóstico foram:

- Sem política de `UPDATE` em `projetos`, editar o título afeta zero linhas.
- A inserção de materiais valida `user_id`, mas permite indicar a obra de outro usuário.
- O `UPDATE` permissivo de materiais permite mudar `projeto_id` para uma obra alheia.
- O financeiro valida a obra, mas permite vincular um funcionário de outro usuário.
- `anon` e `authenticated` possuem privilégios desnecessários, inclusive `TRUNCATE`,
  que não é protegido por RLS. Isso não significa que o PostgREST exponha um endpoint
  de truncamento; o privilégio é excessivo no banco e deve ser retirado.

Uma política aplicada a `public` não torna os dados automaticamente públicos:
suas expressões também são avaliadas. Da mesma forma, `WITH CHECK = null` em uma
política de `UPDATE` com `USING` utiliza a expressão de `USING` como verificação
da nova linha. Esses dois aspectos, isoladamente, não eram brechas.

O `USING (true)` do material também não comprova que qualquer usuário consegue
atualizar todos os materiais por ID: a política de `SELECT` participa da avaliação
das atualizações que precisam ler colunas. Os testes reproduzem o vínculo indevido
de um material próprio com uma obra alheia.

## O que a migration faz

Substitui todas as políticas das cinco tabelas em uma única transação, mantendo
RLS habilitada e restringindo as novas políticas a `authenticated`.

| Tabela | Regra | Operações diretas permitidas |
| --- | --- | --- |
| projetos | `user_id = auth.uid()` | SELECT, INSERT, UPDATE, DELETE |
| funcionarios | `user_id = auth.uid()` | SELECT, INSERT, UPDATE, DELETE |
| tarefas | A obra pertence ao usuário | SELECT, INSERT, UPDATE |
| materiais_projeto | O material e a obra pertencem ao usuário | SELECT, INSERT, UPDATE, DELETE |
| financeiro_obra | A obra pertence ao usuário; INSERT/UPDATE também validam o funcionário, quando preenchido | SELECT, INSERT, UPDATE, DELETE |

A exclusão direta de tarefas continua indisponível, como no conjunto anterior.
A exclusão da obra continua removendo as tarefas por `ON DELETE CASCADE`.
A exclusão de funcionário continua preservando pagamentos com `funcionario_id = null`.

Os grants de tabela de `PUBLIC`, `anon` e `authenticated` são removidos e somente
os necessários ao app são concedidos novamente a `authenticated`. As sequences
de identidade das cinco tabelas recebem o mesmo tratamento, concedendo apenas
`USAGE` a `authenticated`. Grants explícitos de outros papéis e políticas de outras
tabelas não são alterados. Nenhum valor, proprietário ou vínculo é reescrito.

## Aplicação no Supabase

1. Abra o **SQL Editor** usando o papel administrativo `postgres`.
2. Copie o conteúdo inteiro da migration, incluindo `BEGIN` e `COMMIT`, e execute.
   Não execute o DDL de `schema-reference.md` nem os arquivos de `tests/database`.
3. Se aparecer **Success**, execute novamente [diagnostico-rls.sql](./diagnostico-rls.sql).
4. O resultado esperado é RLS habilitada em todas as tabelas, políticas somente para
   `authenticated`, quatro políticas por tabela (três em `tarefas`), privilégios de
   tabela vazios para `anon` e os de `authenticated` conforme a tabela acima.
   `rls_forcada` pode continuar `false`.
5. No app, valide editar um projeto, salvar/editar material, cadastrar funcionário
   e lançar um pagamento. Use duas contas para confirmar a separação das listas.

A migration é reaplicável. Um commit ou deploy do Next.js não a executa no Supabase;
a aplicação manual é necessária neste projeto, que ainda não tem fluxo de migrations
remotas configurado.

Se o preflight detectar vínculos entre proprietários diferentes, a migration falha
antes da troca de políticas e a transação é revertida. Execute
[diagnostico-vinculos.sql](./diagnostico-vinculos.sql) e compartilhe as contagens para
análise. Não é feita correção automática da propriedade de registros.

A aplicação precisa de locks nas cinco tabelas. Se o banco estiver ocupado e o lock
não for obtido em cinco segundos, a transação falha sem aplicar a mudança; reaplique
integralmente quando a operação concorrente terminar.

## Verificação local

```bash
npm run test:rls
```

Requer Python 3 e PostgreSQL local com `pg_config` disponível, ou `PG_BINDIR`
apontando para os binários da instalação. O runner cria um cluster temporário,
acessa somente um socket Unix privado, encerra o servidor e remove o cluster ao
terminar. Não usa `.env.local`, credenciais ou registros do Supabase.

As 167 verificações passaram em PostgreSQL 16.14. Foram testados o comportamento
anterior, rollback por inconsistências, reaplicação, preservação de registros,
grants, duas identidades, sessão sem UID, acesso anônimo, operações do app,
vínculos indevidos, joins, exclusões e cascades. As consultas de diagnóstico
também foram executadas no cluster de teste.

`auth.uid()` é simulado a partir do UID da sessão. Esses testes validam as políticas
no PostgreSQL, mas não substituem a verificação pelo aplicativo após aplicar a
migration nem auditam funções, triggers e configurações remotas não fornecidas.

Referências: [CREATE POLICY](https://www.postgresql.org/docs/16/sql-createpolicy.html),
[Row Security](https://www.postgresql.org/docs/16/ddl-rowsecurity.html) e
[RLS no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
