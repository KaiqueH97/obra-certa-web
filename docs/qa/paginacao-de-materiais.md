# Paginação de materiais e cotação — implantação e QA

## Aplicação

1. Antes de publicar o frontend, execute integralmente no SQL Editor:
   `supabase/migrations/20261029000100_pagina_materiais.sql`.
   Depende da migration de RLS já aplicada. Cria duas funções de leitura e um
   índice; não altera registros ou políticas. Retorno esperado: sucesso sem linhas.
   A criação do índice pode aguardar/bloquear gravações; prefira horário de menor uso.
2. Execute `docs/database/diagnostico-materiais.sql`. São duas linhas: existência,
   invoker, stable, índice e execução por authenticated devem ser true; anon e
   service_role devem ser false, com search_path vazio.
3. Publique o frontend e faça os testes abaixo. Nenhuma migration foi aplicada
   automaticamente no Supabase remoto.

Sem a migration, a lista mostra erro e custo/lucro ficam indisponíveis; caixa e
tarefas continuam acessíveis. O frontend anterior continua compatível com o SQL.

## Validação manual

- Com mais de 20 materiais, navegar não altera o custo integral nem o lucro.
  Network deve mostrar `pagina_materiais`, no máximo 20 itens por resposta.
- Lista vazia deve exibir zero legítimo e paginação desabilitada.
- Edite nome/quantidade: a navegação e a cotação ficam bloqueadas durante edição.
  Salvar atualiza a lista na mesma página; cancelar preserva o registro.
- Altere um preço. Depois da confirmação, custo e lucro devem refletir o total
  da obra. Em falha de releitura, exiba Indisponível; retry só refaz SELECT/RPC,
  não UPDATE. Falha de gravação incerta mantém o bloqueio já existente.
- Abra a confirmação de exclusão: valor e texto devem permanecer; navegação
  bloqueada. Cancele com Escape e confira foco. Exclua o único material da última
  página e confira recuperação da página válida e foco no título.
- Nenhuma consulta de cotação deve acontecer ao abrir a obra. Clique em
  “Preparar cotação completa”, inclusive estando na última página. Depois clique
  em “Abrir cotação no WhatsApp”. Todos os materiais devem estar presentes.
- Confira “Texto completo da cotação”: permite copiar a lista caso o navegador
  ou o WhatsApp não aceite um link muito longo. O aplicativo não corta a lista.
- Falha/timeout/resposta incompleta não pode gerar link parcial. Preparar novamente
  tenta outra leitura. Navegar para outra obra/logout cancela a leitura antiga.
- Depois de alterar ou excluir material, a cotação preparada deve desaparecer:
  prepare outra para obter a lista atualizada.
- Troque português/inglês com cotação pronta e confirmação aberta. Não refaça a
  consulta por causa do idioma; mantenha nomes/quantidades originais e BRL.
- Teste no celular/PWA: link abre por clique explícito (sem popup assíncrono),
  foco visível, campo de texto legível e navegação por teclado.
- Use duas contas reais: uma não deve consultar ou exportar materiais da outra.

## Testes locais e limites

`npm run test:materials` valida contrato, páginas, cancelamento e cotação parcial.
`npm run test:deletions` exercita a tela e as gravações com Supabase simulado.
`npm run test:materials-db` usa PostgreSQL descartável, duas contas, RLS,
migração reaplicável e cotação com mais de mil itens, sem acessar Supabase remoto.

Lista e custo são obtidos juntos; a cotação completa é outro snapshot, tomado
ao solicitar. Caixa e materiais usam consultas separadas, sem sincronização em
tempo real entre sessões. A exportação completa pode consumir memória e tempo
proporcional ao número de itens; não ocorre automaticamente na abertura da obra.
