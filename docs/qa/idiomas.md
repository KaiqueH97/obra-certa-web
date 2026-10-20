# Idiomas — navegação e telas públicas

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

## Escopo pendente

O aplicativo ainda não está integralmente em inglês. Dashboard, perfil, calculadora interna, listas e detalhes
da obra, confirmações gerais, monitor de rede e tela offline continuam em português.
Manifesto PWA e descrição de metadados também precisam ser tratados nas próximas etapas.

Próximos commits sugeridos:

1. Traduzir dashboard, perfil e listas de obras/equipe.
2. Traduzir calculadora e detalhes da obra, incluindo mensagens compartilhadas,
   textos gerados para WhatsApp, datas e números com `Intl` mantendo BRL.
3. Completar PWA/metadados e idioma global do documento; verificar telas mobile
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

Nenhum SQL ou alteração de configuração do Supabase é necessário nesta etapa.
