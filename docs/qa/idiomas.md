# Idiomas — primeira etapa

## Decisões

- Português (`pt-BR`) é o padrão; inglês (`en`) pode ser selecionado no login e
  nos menus desktop/mobile.
- Todos os valores financeiros continuam em reais (BRL). Idioma não converte
  moeda, muda valores gravados nem altera a unidade das medidas.
- Nome **Obra Certa**, URLs, tabelas e dados cadastrados pelo usuário são preservados.

## O que foi entregue

`lib/i18n.ts` contém mensagens com chaves tipadas e tradução das notificações de
login/logout. `useLocale` assina uma preferência compartilhada com
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

A mudança de idioma não remonta formulários nem reinicia autenticação. Notificações
novas usam o idioma no momento de sua emissão; uma notificação já visível não é
retraduzida automaticamente. Labels do login agora apontam para os inputs.

As regiões traduzidas declaram `lang` de acordo com a seleção, inclusive os avisos.
O `html lang="pt-BR"` permanece correto para as regiões ainda em português. A
mudança global do idioma do documento será feita quando o conteúdo das demais
telas estiver traduzido. Não basta alterar apenas o `lang` para traduzir uma tela.

## Escopo pendente

O aplicativo ainda não está integralmente em inglês. Página pública, cadastro,
recuperação/redefinição de senha, dashboard, perfil, calculadora, listas e detalhes
da obra, confirmações gerais, monitor de rede e tela offline continuam em português.
Manifesto PWA e descrição de metadados também precisam ser tratados nas próximas etapas.

Próximos commits sugeridos:

1. Completar telas públicas e demais fluxos de autenticação.
2. Traduzir dashboard, perfil e listas de obras/equipe.
3. Traduzir calculadora e detalhes da obra, incluindo mensagens compartilhadas,
   textos gerados para WhatsApp, datas e números com `Intl` mantendo BRL.
4. Completar PWA/metadados e idioma global do documento; verificar telas mobile
   e fluxos completos em inglês e português.

## Validação

`npm run test:i18n` verifica preferência, fallback, troca sem perda de campos,
storage bloqueado, sincronização entre abas, hidratação, menus e erro de login
durante mudança de idioma. Usa React/jsdom com autenticação simulada.
`npm run test:auth-actions` verifica que os contratos do controlador permanecem.

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

Nenhum SQL ou alteração de configuração do Supabase é necessário nesta etapa.
