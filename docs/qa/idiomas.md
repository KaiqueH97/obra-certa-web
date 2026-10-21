# Idiomas — navegação, telas públicas e gestão

## Decisões

- Português (`pt-BR`) é o padrão; inglês (`en`) pode ser selecionado na página
  inicial, no login, cadastro, recuperação/redefinição de senha e nos menus desktop/mobile.
- Todos os valores financeiros continuam em reais (BRL). Idioma não converte
  moeda, muda valores gravados nem altera a unidade das medidas.
- Nome **Obra Certa**, URLs, tabelas e dados cadastrados pelo usuário são preservados.

## O que foi entregue

`lib/i18n.ts` contém mensagens com chaves tipadas e tradução das notificações de
login/logout e dos estados de cadastro/recuperação/redefinição. `useLocale` assina uma preferência compartilhada com
`useSyncExternalStore`; não é necessário reinstanciar o controlador de sessão
quando o idioma muda. O HTML inicial permanece em português, inclusive se o
navegador tiver uma preferência salva, evitando divergência na hidratação.

A preferência fica em `localStorage` sob `obra-certa:locale`; mudanças sincronizam
abas abertas. Valores desconhecidos voltam ao português. Se o armazenamento
estiver bloqueado, a seleção funciona em memória até fechar/recarregar a página.
Não guarda informações de sessão nem credenciais.

Nesta etapa foram traduzidos:

- Menus principal, desktop e mobile, incluindo sair e selecionar idioma.
- Tela de login: campos, placeholders, botões, links e aviso de logout parcial.
- Notificações do controlador de login/logout, preservando seu tratamento de erros.
- Página inicial: apresentação, links, rótulos, placeholders e calculadora rápida.
  A área e o número de tijolos usam formatação do idioma com `Intl.NumberFormat`;
  as medidas aceitas e a regra de cálculo continuam iguais.
- Cadastro, recuperação e redefinição: formulários, validações, mensagens neutras
  de envio de e-mail, resultados incertos e confirmação de senha alterada.

A mudança de idioma não remonta formulários nem reinicia autenticação. Notificações
novas usam o idioma no momento de sua emissão; uma notificação já visível não é
retraduzida automaticamente, exceto o aviso persistente de desconexão, que é
atualizado no mesmo ID. Mensagens inline dos formulários mudam com a seleção,
sem reenviar requisições nem revalidar a sessão. Labels do login apontam para os inputs.

O idioma não altera senhas, nomes ou e-mails digitados, URLs de recuperação, regras
de confirmação nem os bloqueios após resultado incerto. Os e-mails disparados pelo
Supabase usam os templates configurados no serviço; esta etapa traduz o aplicativo,
sem configurar ou personalizar esses templates.

As regiões traduzidas declaram `lang` de acordo com a seleção, inclusive os avisos.
O servidor entrega `html lang="pt-BR"` e metadados em português. Após hidratar,
`DocumentLocale` acompanha a preferência local e atualiza o idioma do documento,
a descrição e o link do manifesto. A seleção não remonta telas nem muda URLs.
Avisos antigos em texto simples ficam em uma região explicitamente `pt-BR`;
avisos traduzidos declaram o idioma da mensagem, mesmo após nova troca.

Nesta etapa também foram traduzidos dashboard, perfil e listas paginadas de obras
e equipe, incluindo formulários, confirmações e rótulos acessíveis. O catálogo
`lib/private-i18n.ts` usa os textos originais como chaves tipadas e interpola dados
sem traduzir nomes ou cargos. Datas seguem o idioma; custos e diárias usam `Intl`
com moeda BRL. Valores digitados aceitam os mesmos formatos de antes e não são
reformatados durante a troca de idioma.

Avisos compartilhados de carregamento, gravação e bloqueio também acompanham a
preferência. Mensagens ainda não catalogadas mantêm o texto original com `lang="pt-BR"`.
No perfil, nome/e-mail ausentes recebem fallback apenas na apresentação: o campo
de edição não é preenchido com “Usuário” ou “User”.

A calculadora interna e os detalhes da obra também acompanham o idioma:

- Superfícies, tipos de materiais, medidas, resultado, unidades e validações.
- Orçamento, caixa, tarefas, confirmações, notificações e controles acessíveis.
- Custos exibidos em BRL e números da estimativa formatados conforme o idioma.
- Introdução, cabeçalho e encerramento do relatório para WhatsApp no idioma atual.
  O botão abre o WhatsApp com o texto preenchido; o envio continua sendo manual.

Os valores das opções da calculadora e o formato persistido das quantidades foram
preservados. Por exemplo, “Porcelain tile” salva `Porcelanato`; uma estimativa pode
continuar gravada como `13,20 m² (já c/ 10% de quebra) (~37 peças)`. Nos detalhes e
no WhatsApp, nomes e quantidades cadastrados são conteúdo literal, sem tradução
por reconhecimento de palavras. Não há migração dos dados existentes. Nomes,
descrições, tarefas e valores digitados permanecem intactos ao trocar o idioma.

## PWA, conexão e páginas auxiliares

- Tela offline e página 404 têm tradução e seletor de idioma próprios.
- O aviso offline permanece visível e muda de idioma no mesmo ID. Reconectar
  substitui esse aviso por uma confirmação temporária; trocar idioma não simula
  reconexão. Nenhuma gravação pendente é reenviada automaticamente.
- “Tentar novamente” na tela offline faz navegação completa para `/`, evitando
  reutilizar a resposta de fallback do roteador.
- Mensagens de verificação e mudança de sessão acompanham o idioma sem reiniciar
  o controlador. A resposta 503 do proxy é bilíngue: a preferência está em
  localStorage e não é enviada ao servidor.
- `/manifest.json` e `/manifest-en.json` contêm idioma e descrição correspondentes.
  Nome, ícones, escopo, entrada e identidade são os mesmos. `id: "/login"` mantém
  a identidade implícita anterior baseada no `start_url`, conforme a
  [documentação do manifesto](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id).
- O manifesto inglês é selecionado após hidratar. A apresentação e atualização
  dos metadados de um app já instalado precisam ser verificadas no navegador
  alvo; não há reinstalação automática nem promessa de atualização imediata.

## Limites e validação pendente

A tradução das telas do aplicativo está implementada. Ainda é necessário validar
visualmente no celular, com leitor de tela e no PWA instalado. Testes em jsdom não
substituem o navegador para service worker, instalação ou layout.

O HTML inicial e os metadados vistos sem JavaScript continuam em português; esta
etapa não cria URLs por idioma nem SEO bilíngue no servidor. Templates de e-mail
do Supabase, mensagens do navegador e conteúdo cadastrado não são traduzidos
pelo aplicativo. A tela offline não permite ler ou editar dados privados sem rede.

## Validação

`npm run test:i18n` verifica preferência, fallback, troca sem perda de campos,
storage bloqueado, sincronização entre abas, hidratação, menus e erro de login
durante mudança de idioma. Usa React/jsdom com autenticação simulada.
Inclui os fluxos públicos, preservação dos campos e requisições, mensagens dos
controladores e números/validações da calculadora rápida.
`npm run test:auth-actions` verifica que os contratos do controlador permanecem.
Os testes de cadastro, recuperação, redefinição e calculadora continuam exercitando
os fluxos em português. Nenhum teste automático desta etapa envia e-mails reais.

Roteiro manual:

1. Abra `/login` sem preferência salva. Deve aparecer em português.
2. Digite e-mail e senha; selecione **English**. Textos e atributos acessíveis
   devem mudar, preservando os campos. Confira o foco e a leitura pelo teclado.
3. Tente entrar com credenciais inválidas. A notificação deve aparecer em inglês.
4. Recarregue: inglês deve continuar selecionado. Abra outra aba, altere o idioma
   nela e confira a atualização da primeira aba.
5. Entre com uma conta de teste. Confira menus desktop e mobile em inglês e a
   navegação pelas URLs existentes. O conteúdo ainda não traduzido fica em português.
6. Saia e confira o login no mesmo idioma. Troque para português novamente.
7. No celular, confira que o seletor cabe no cabeçalho e não cobre a navegação.
8. Abra `/`, selecione inglês e confira os links e textos. Na calculadora rápida,
   digite largura `4,5` e altura `3.0`: deve mostrar `13.50 m²` e `338 units`.
   Troque para português: deve mostrar `13,50 m²` e `338 un.`, preservando os campos.
   Informe uma medida negativa e confira a mensagem nos dois idiomas.
9. Em `/cadastro`, preencha dados de teste e troque o idioma. Nome, e-mail e senha
   devem ser preservados. Ao enviar, a mensagem de confirmação deve ser neutra,
   sem afirmar que uma conta existe ou foi criada quando só o envio foi aceito.
10. Em `/recuperar`, solicite um link para uma conta de teste. Confira o aviso no
    idioma selecionado. Abra o link recebido e verifique os rótulos da nova senha,
    a validação de senhas diferentes e a confirmação após atualização bem-sucedida.
11. Com rede lenta, troque o idioma durante uma solicitação. No Network, confirme
    que isso não duplica o envio. Na redefinição, não deve consumir o callback
    novamente nem apagar as senhas durante uma troca de idioma.

12. Em `/home`, alterne os idiomas: títulos e avisos devem mudar sem nova consulta
    ao banco. O custo deve continuar em reais (ex.: `R$ 1.234,56` / `R$1,234.56`).
13. Em `/projetos`, avance para a segunda página, abra uma edição e digite um
    título. Troque o idioma: página e rascunho devem permanecer. Salve e confira
    o título original. Abra uma exclusão e confira o aviso nos dois idiomas;
    cancele sem excluir dados de produção.
14. Em `/equipe`, preencha nome, cargo e diária `150,50`. Troque para inglês antes
    de cadastrar: deve manter os campos e gravar 150,50 reais. Nomes e cargos
    cadastrados continuam no idioma em que foram escritos. Confira os rótulos
    dos botões de edição/exclusão e o foco ao cancelar a confirmação.
15. Em `/perfil`, alterne durante edição e envio com rede lenta: os campos não
    devem ser limpos nem ocorrer envio duplicado. Sucesso/erro inline acompanha
    o idioma. A troca não deve provocar nova leitura do perfil.
16. Simule falha de rede numa lista. Confira “Try again” e recuperação. Se uma
    gravação tiver resultado incerto, a troca de idioma deve manter a edição
    bloqueada até recarregar e conferir os dados.
17. No celular, confira cabeçalhos, formulários, paginação e confirmações nas
    quatro telas em inglês, com zoom e teclado. Testes jsdom não validam layout
    visual nem substituem este roteiro.

Os testes de dashboard, perfil, projetos e equipe incluem cenários bilíngues de
paginação, rascunho, foco, falha de leitura e gravação em andamento. As chamadas ao
Supabase são simuladas; não alteram dados reais.

18. Em `/calcular`, selecione piso/porcelanato, área de 3 x 4 m, peça de 60 x 60 cm
    e preço de `10,50`. Calcule e selecione uma obra de teste. Troque para inglês:
    deve manter os campos, a obra e o resultado, mostrando “Porcelain tile”,
    `13.20`, `37 units` e `R$138.60`. Salve uma única vez e confira na obra.
19. Informe altura negativa, dimensão de peça incompleta ou preço inválido.
    Confira as validações em inglês, sem oferecer salvar resultado inválido.
20. Nos detalhes da obra, selecione caixa no celular, digite descrição e valor
    e alterne o idioma: a aba e o rascunho devem permanecer. Com rede lenta,
    alterne durante um lançamento de teste; deve haver apenas um envio e a
    notificação final deve usar o idioma selecionado naquele momento.
21. Confira custos em BRL, nomes e tarefas originais, rótulos dos campos e botões.
    Abra a confirmação de excluir material, troque o idioma e cancele: o foco
    deve retornar ao botão correspondente, sem excluir o material.
22. Abra o relatório do WhatsApp em cada idioma. Confira apresentação traduzida,
    título, nome do profissional, contato, materiais e quantidades preservados.
    Não é necessário enviar a mensagem para validar o texto.

`npm run test:calculator`, `npm run test:deletions` e `npm run test:mutations`
cobrem os fluxos desta etapa, incluindo gravação em inglês, troca durante envio,
foco, abas e relatório para WhatsApp. As integrações são simuladas e não enviam
mensagens nem alteram dados reais.

23. Em inglês, abra o DevTools e confira `html lang="en"`, a descrição e o link
    `/manifest-en.json`. Volte ao português e confira a atualização. Navegue por
    várias telas e confirme que o idioma continua correto. Teste também outra aba.
24. Em uma compilação de produção (`npm run build` e `npm start`), aguarde a
    instalação/ativação do service worker. Desligue a rede: deve aparecer apenas
    um aviso de desconexão. Troque o idioma: o mesmo aviso deve ser traduzido.
    Reconecte: o aviso deve virar confirmação temporária sem reenviar gravações.
25. Com o service worker ativo e inglês salvo, desligue a rede e navegue/recarregue.
    O fallback offline deve carregar seus recursos públicos e mostrar inglês após
    hidratar. Teste o seletor sem rede; reconecte e use “Try again” para voltar.
    A primeira visita sem cache nem conexão não tem garantia de fallback.
26. Abra um endereço inexistente: confira a página 404 nos dois idiomas e o retorno
    ao início. Use teclado e leitor de tela nos avisos e nos seletores.
27. Antes de instalar em um navegador de teste, selecione inglês. Inspecione o
    manifesto: `lang: en`, descrição inglesa, nome Obra Certa, `id` e `start_url`
    iguais a `/login`. Teste também em português e em uma instalação já existente.
    Confira que dados privados continuam ausentes do cache de runtime.

`npm run test:i18n` inclui hidratação offline, documento/metadados, manifestos
bilíngues, eventos de conexão, limpeza de listeners e a página 404.
`npm run test:pwa` verifica as regras de cache; `npm run test:session` e
`npm run test:auth` cobrem a proteção de sessão e o proxy.

Nenhum SQL ou alteração de configuração do Supabase é necessário nesta etapa.
