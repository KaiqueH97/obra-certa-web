# Proteção de rotas e renovação de sessão

## Validação manual confirmada

Em 11/09/2026, o usuário informou que realizou os testes manuais desta etapa e
que todos funcionaram corretamente. A etapa de proteção no servidor foi validada.

## Problemas corrigidos

O antigo `middleware.ts` recebia cookies renovados do Supabase, mas criava uma
resposta de redirecionamento sem copiá-los. O navegador podia continuar com os
tokens antigos. A implementação também ignorava os cabeçalhos recebidos no segundo
argumento de `setAll`, destinados a impedir cache das respostas de autenticação.

O matcher excluía qualquer caminho terminado em extensão de imagem, incluindo
`/projetos/123.png`, embora esse caminho corresponda à rota dinâmica de projetos.
Isso contornava a checagem de sessão da página. Não comprova exposição de dados:
as consultas ao banco continuam sujeitas às políticas de RLS.

## Implementação

- `proxy.ts` substitui `middleware.ts`, conforme a convenção do Next.js 16.
- O cliente Supabase e os cookies pendentes são criados por requisição.
- Cookies novos, removidos e suas opções são aplicados tanto nas respostas normais
  quanto nos redirecionamentos. A requisição encaminhada também recebe os cookies
  atualizados. Chamadas sucessivas a `setAll` preservam as alterações anteriores.
- Os cabeçalhos recebidos do SDK são aplicados. Respostas de autenticação e páginas
  protegidas recebem `Cache-Control: private, no-cache, no-store, must-revalidate,
  max-age=0`, além de `Expires` e `Pragma`.
- A sessão é validada com `getUser()`. Cookie presente, usuário nulo ou retorno
  acompanhado de erro não autorizam uma página protegida.
- Sem sessão válida, a página protegida redireciona para `/login`. Com sessão
  válida, `/login` e `/cadastro` redirecionam para `/home`. Os destinos são fixos
  e não carregam parâmetros da URL anterior.
- Exceções, erros sem status HTTP, timeout, limite de requisições e erros de servidor do Auth bloqueiam páginas
  privadas com HTTP 503 e uma mensagem para tentar novamente. Essa resposta não
  chama `signOut`. Cookies eventualmente modificados pelo SDK são preservados.
- Login, cadastro e recuperação continuam acessíveis quando o Auth está
  indisponível; isso não garante que seus formulários consigam concluir operações.
- O matcher cobre os cinco caminhos privados e seus descendentes, além das páginas
  de autenticação e recuperação. Assets e a página offline não consultam o Auth.

Novas páginas privadas precisam constar em `protectedRoots` e no `config.matcher`.
O teste que percorre `app/(sistema)` detecta páginas adicionadas sem essa cobertura.

O tratamento de cookies e cache segue o
[guia de SSR do Supabase](https://supabase.com/docs/guides/auth/server-side/advanced-guide).
A migração usa a documentação incluída na versão instalada do Next.js em
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

## Validação automatizada

`npm run test:auth` executa 33 testes do código real de `proxy.ts`, com
`NextRequest`, `NextResponse` e o matcher do Next.js instalado. Apenas a resposta
do Supabase é simulada: acesso anônimo/autenticado, renovação/remoção de cookies,
destinos de redirecionamento, cache, falha de rede e exclusão dos recursos públicos.

Não são testes de sessão real contra o projeto remoto do Supabase. A proteção do
banco permanece responsabilidade das políticas de RLS já aplicadas.

Em 11/09/2026, a checagem HTTP sem cookies no servidor de produção local confirmou
redirecionamento 307 para `/login` em `/home`, `/equipe` e `/projetos/123.png`.
Login, recuperação, redefinição de senha, página offline e `sw.js` responderam 200.
Foram usadas requisições HEAD para conferir status e cabeçalhos. A conferência
com sessão real no navegador foi posteriormente confirmada pelo usuário, conforme
registrado na seção inicial.

## Conferência manual

1. Em uma janela anônima, abra `/home`, `/equipe` e `/projetos/123.png`. Todos devem
   redirecionar para `/login`.
2. Entre com sua conta, navegue pelas obras e abra `/login` diretamente. Deve ir
   para `/home` e manter a sessão ao recarregar.
3. Quando houver renovação do token, confira no painel Network que a resposta
   preserva `Set-Cookie` e os cabeçalhos de cache. Não compartilhe os valores dos
   cookies ou tokens.
4. Confira `/recuperar`, `/redefinir-senha`, a página offline e a instalação do PWA.

Nenhum SQL ou alteração de chave é necessário. Esta etapa trata das requisições
que chegam ao servidor. As ações de login/logout no cliente estão documentadas na
[etapa seguinte](./login-logout.md). A reação de outras abas já abertas à expiração
de sessão permanece uma etapa separada.
