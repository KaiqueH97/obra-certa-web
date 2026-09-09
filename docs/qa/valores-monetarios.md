# Conversão e validação monetária

## Correção

O código anterior removia todos os pontos e depois chamava `parseFloat`. A entrada
`150.50` virava `15050`; textos como `150abc` podiam ser aceitos parcialmente, e
alguns valores inválidos eram substituídos por zero.

`lib/money.ts` centraliza a leitura dos valores digitados, usada na criação/edição
de diárias, no preço dos materiais, nos lançamentos de caixa e na calculadora.
A validação ocorre antes da requisição. As gravações continuam usando o executor
de confirmação da etapa anterior.

| Entrada | Resultado |
| --- | --- |
| `150`, `150,5`, `150.50` | R$ 150,00 / R$ 150,50 / R$ 150,50 |
| `1.500,50` | R$ 1.500,50 |
| `1.500` ou `1,500` | Recusada por ambiguidade; usar `1500` ou `1.500,00` para mil e quinhentos |
| `150,501`, `-10`, `150abc`, `1e3`, `R$ 150,50` | Recusada, sem gravação |
| Vazio em diária, preço de material ou preço unitário | Zero, mantendo esses campos opcionais |
| Vazio ou zero em lançamento de caixa | Recusado; entradas e saídas devem ser positivas |

Espaços no começo/fim são aceitos. A interface limita cada valor e custo estimado
a R$ 99.999.999,99, compatível com os campos `numeric(10, 2)` de diárias e caixa.
Esse limite também é aplicado pela interface aos materiais, embora sua coluna
`numeric` não tenha a mesma restrição no esquema fornecido.

A leitura compõe centavos inteiros a partir do texto. Somente a conversão final
para o payload divide por 100. Na estimativa, o preço em centavos é multiplicado
pela quantidade; o custo final arredonda ao centavo mais próximo, com meio centavo
para cima e uma tolerância para ruído de ponto flutuante. As medidas e quantidades
continuam sendo estimativas em `number`, não aritmética decimal arbitrária.

O custo salvo é o mesmo custo arredondado exibido. Alterar o formulário da
calculadora ou adicionar/remover uma medida invalida o resultado anterior e exige
calcular novamente. Quantidades não finitas ou não positivas não geram custo.

Em entradas inválidas, os formulários de equipe e caixa ficam preenchidos para
correção. O preço do material, salvo ao perder o foco, volta ao último confirmado.

## Testes

`npm run test:money` executa 59 testes unitários do módulo real: formatos aceitos,
ambiguidade, entradas inválidas, limites, zero/vazio, preservação de centavos no
ciclo de edição e payload, arredondamento e custos fora do intervalo.
Esses testes não acessam o Supabase nem executam os componentes em um navegador.

Validação manual com registros de teste:

1. Cadastre/edite uma diária com `150.50`; recarregue e confira R$ 150,50.
2. Informe `1.500,50` no preço de um material; confira o preço e o total após
   recarregar. Tente `150abc` e `1.500`: não deve haver gravação, e o preço anterior
   deve continuar registrado.
3. Registre um recebimento com `150.50` e um pagamento com `150,50`. Cada lançamento
   deve mostrar R$ 150,50. Zero e valores negativos devem ser recusados.
4. Na calculadora, escolha parede, medidas 1 × 3,5 e preço `0.29`. O custo deve ser
   R$ 1,02 antes e depois de salvar. Altere o preço: o botão para salvar o resultado
   anterior deve desaparecer até um novo cálculo.
5. Tente preço unitário inválido e custo superior ao limite: não deve existir
   resultado disponível para salvar.

## Banco e dados existentes

Não há migration nesta etapa. São validações do aplicativo; não substituem
constraints no banco para requisições feitas fora da interface. Valores históricos
não são reescritos automaticamente, pois não é possível inferir com segurança se
um valor alto foi digitado corretamente ou gerado pelo erro anterior.
