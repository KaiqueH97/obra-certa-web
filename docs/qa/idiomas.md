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
retraduzida automaticamente. Mensagens inline dos formulários mudam com a seleção,
sem reenviar requisições nem revalidar a sessão. Labels do login apontam para os inputs.

O idioma não altera senhas, nomes ou e-mails digitados, URLs de recuperação, regras
de confirmação nem os bloqueios após resultado incerto. Os e-mails disparados pelo
Supabase usam os templates configurados no serviço; esta etapa traduz o aplicativo,
sem configurar ou personalizar esses templates.

As regiões traduzidas declaram `lang` de acordo com a seleção, inclusive os avisos.
O `html lang="pt-BR"` permanece correto para as regiões ainda em português. A
mudança global do idioma do documento será feita quando o conteúdo das demais
telas estiver traduzido. Não basta alterar apenas o `lang` para traduzir uma tela.

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

## Escopo pendente

O aplicativo ainda não está integralmente em inglês. Monitor de rede e tela offline
continuam em português.
Manifesto PWA e descrição de metadados também precisam ser tratados nas próximas etapas.

Próximos commits sugeridos:

1. Completar PWA/metadados e idioma global do documento; verificar telas mobile
   e fluxos completos em inglês e português.

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

Nenhum SQL ou alteração de configuração do Supabase é necessário nesta etapa.
