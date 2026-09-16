# Validação das medidas da calculadora

## Problemas corrigidos

`parseFloat` aceitava o começo de valores como `3abc`, calculando com `3` sem
avisar. As dimensões opcionais de piso não exigiam um par válido: zero podia
gerar quantidade infinita de peças, e um campo isolado era ignorado. Os campos
numéricos da peça também dificultavam decimais com vírgula.

Na simulação pública, duas dimensões negativas podiam produzir uma área positiva.
Na calculadora privada, áreas criadas rapidamente usavam `Date.now()` como ID e
atualizações com estado capturado, permitindo colisões ou perda de uma inclusão.

## Implementação

`lib/material-calculation.ts` reúne validação de medidas, soma de áreas e cálculo
do material em funções sem acesso ao banco ou à interface. A calculadora privada
usa esse resultado para exibir e salvar; a simulação pública reutiliza a validação
e a soma de áreas.

- Aceita números positivos completos, como `3`, `3,50` e `3.50`, com espaços
  externos opcionais. Não aceita unidades, separador de milhar, notação científica,
  zeros, negativos ou texto parcial. `1.500` significa **1,5**, não mil e quinhentos;
  para mil e quinhentos, digite `1500`.
- Verifica cada área e identifica a linha inválida na mensagem. Exige ao menos
  uma área. O total mínimo é **0,01 m²**, compatível com a exibição de duas casas.
  Totais não finitos ou acima do intervalo numérico usado na exibição são recusados.
- Para piso, os dois campos da peça podem ficar vazios. Se um for preenchido,
  ambos devem ser positivos e válidos, em **centímetros**. A estimativa deve ser
  um inteiro positivo com precisão segura; valores infinitos não podem ser salvos.
- Campos de medidas usam teclado decimal e têm rótulos associados. O resultado
  anterior desaparece quando o formulário muda e só volta após cálculo válido.
- Novas áreas recebem IDs sequenciais por montagem; atualizações funcionais
  preservam inclusões rápidas. O reset após salvar também usa um novo ID.
- A exibição condicional de custo usa uma condição booleana, evitando um `0`
  solto na tela quando o preço opcional não é informado.

As regras de estimativa existentes foram mantidas: margem de 10% para piso,
contrapiso, laje, telhado e impermeabilização; demais superfícies usam a área sem
essa margem. Peças são arredondadas para cima. O preço é **por m²**, multiplicado
pela área calculada, mesmo quando uma estimativa de peças é exibida. Os cálculos
continuam usando números JavaScript e as regras monetárias da etapa anterior.

O texto da interface agora esclarece que salvar registra o custo em materiais;
não cria um lançamento em `financeiro_obra`. Nenhuma fórmula de consumo por
fabricante, espessura ou rendimento foi adicionada nesta etapa.

## Validação automatizada

`npm run test:calculator` executa 33 testes: 29 das funções e quatro das páginas
React em jsdom. Cobrem formatos, extremos, regras das superfícies, preço,
dimensões opcionais, bloqueio de resultados inválidos, invalidação após edição,
payload salvo, inclusões rápidas e simulação pública. O Supabase é simulado;
nenhum material é gravado no ambiente remoto pelos testes.

Em 15/09/2026, passaram os 33 testes novos, os 100 testes de regressão monetária,
gravações e carregamento, o lint dos arquivos de código alterados,
`npx tsc --noEmit` e `npm run build`.

## Conferência manual pendente

1. Em `/calcular`, selecione Piso / Porcelanato. Use área de **3 × 4 m**, peça de
   **60,5 × 60,5 cm** e preço **10,00 por m²**. Esperado: área 12,00 m², quantidade
   13,20 m² com margem, 37 peças estimadas e custo R$ 132,00.
2. Salve em uma obra de teste e confira quantidade e custo ao abrir a obra.
3. Experimente `3abc`, `-3` e `0` nas medidas: deve aparecer erro sem opção de salvar
   o resultado. Na peça, teste zero e somente uma dimensão preenchida.
4. Deixe ambos os campos da peça vazios: deve calcular por área sem estimar peças.
   Troque para uma superfície sem margem e confira a quantidade correspondente.
5. Calcule, depois altere uma medida, material ou preço. O resultado deve desaparecer
   até calcular novamente. Adicione áreas rapidamente e remova uma delas: as
   demais devem conservar seus valores.
6. Na página inicial pública, use 4,5 × 3 m: esperado 13,50 m² e 338 tijolos pela
   regra existente da simulação. Duas medidas negativas devem mostrar aviso e
   nenhum resultado numérico. Confira o teclado decimal no celular.

Nenhum SQL, migration, pacote ou variável de ambiente é necessário. Registros
antigos não são recalculados; a validação se aplica aos novos cálculos na interface.
