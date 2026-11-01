# Acessibilidade do formulário do caixa

O tipo de lançamento, a descrição e o valor agora possuem rótulos visíveis
associados aos controles. Eles permanecem visíveis após preencher os campos.
Os rótulos acompanham o idioma; a moeda continua sendo real (BRL).
O foco do teclado e os exemplos nos campos receberam cores mais escuras.

Não há migration nem alteração das regras financeiras nesta etapa.

## Verificação manual

1. Abra uma obra de teste e acesse Caixa. Confira os rótulos “Tipo de lançamento”,
   “Descrição” e “Valor em reais” antes e depois de preencher os campos.
2. Clique nos rótulos: o controle correspondente deve receber foco. Use Tab para
   navegar e confira o foco visível, inclusive no botão “Lançar no Caixa”.
3. Preencha descrição e valor; troque para inglês. Confira “Transaction type”,
   “Description” e “Amount in BRL”, preservando os dados digitados.
4. Em uma obra de teste, registre uma entrada e um pagamento a um profissional.
   Confira o valor em reais e a atualização dos totais após confirmação.
5. Em celular, PWA e desktop, confira se os campos e rótulos cabem na coluna.
   Verifique também zoom de 200%, leitor de tela e legibilidade ao ar livre.
6. Com rede lenta, confira o bloqueio do formulário durante a gravação. Em caso
   de resultado incerto, siga a orientação de recarga antes de tentar novamente.

## Validação local

O teste existente de lançamento com troca de idioma também verifica a associação
entre os rótulos e os controles antes, durante e depois do preenchimento. As APIs
são simuladas. jsdom não mede contraste, layout ou o comportamento de um leitor de
tela real; esses pontos continuam na verificação manual.
