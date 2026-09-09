import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
const { outputText } = ts.transpileModule(
  readFileSync(new URL("../lib/money.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
);
vm.runInNewContext(outputText, { exports });
const { parseMoney, calculateMoneyTotal, MAX_MONEY_CENTS } = exports;

for (const [input, cents] of [
  ["150,50", 15050], ["150.50", 15050], ["150", 15000],
  ["150,5", 15050], ["150.5", 15050], ["1.500,50", 150050],
  ["1.500,00", 150000], ["1.234.567,89", 123456789],
  [" 150,50 ", 15050], ["0,01", 1], ["0.29", 29],
  ["000150.50", 15050], ["0", 0], ["0,00", 0],
  ["99999999.99", MAX_MONEY_CENTS], ["99.999.999,99", MAX_MONEY_CENTS],
]) {
  test(`converte ${JSON.stringify(input)} para ${cents} centavos`, () => {
    const result = parseMoney(input);
    assert.equal(result.ok, true);
    assert.equal(result.cents, cents);
    assert.equal(result.value, cents / 100);
  });
}

for (const input of [
  "", "   ", "-1", "-0,01", "+1", "1e3", "NaN", "Infinity", "R$ 150,50",
  "150abc", "150,50abc", "1 500,50", "150,", "150.", ",50", ".50",
  "150.501", "150,501", "1.500", "1,500", "1.000.000", "1,500.50",
  "15.00,50", "1..500,50", "1.500,,50", "0.150,50", "100000000", "100.000.000,00",
  "9999999999999999999999999999999999999999999",
]) {
  test(`recusa entrada inválida, ambígua ou fora do limite: ${JSON.stringify(input)}`, () => {
    const result = parseMoney(input);
    assert.equal(result.ok, false);
    assert.equal(typeof result.error, "string");
    assert.equal("value" in result, false);
  });
}

test("campos opcionais aceitam vazio como zero, mas não texto inválido", () => {
  assert.equal(parseMoney(" ", { allowEmpty: true }).value, 0);
  assert.equal(parseMoney("abc", { allowEmpty: true }).ok, false);
});

test("lançamentos exigem um valor positivo mesmo com allowEmpty", () => {
  for (const input of ["", "0", "0.00", "0,0"]) {
    assert.equal(parseMoney(input, { allowEmpty: true, allowZero: false }).ok, false);
  }
  assert.equal(parseMoney("0,01", { allowZero: false }).value, 0.01);
});

test("valores com centavos sobrevivem ao ciclo texto → banco → edição", () => {
  for (const cents of [1, 7, 29, 101, 15050, 123456789, MAX_MONEY_CENTS]) {
    const value = cents / 100;
    const edited = value.toString().replace(".", ",");
    assert.equal(parseMoney(edited).cents, cents);
    assert.equal(JSON.parse(JSON.stringify({ valor: parseMoney(edited).value })).valor, value);
  }
});

for (const [unitCents, quantity, expectedCents] of [
  [15050, 2, 30100], [29, 3.5, 102], [100, 1.005, 101],
  [100, 1.0049, 100], [100, 1.0051, 101], [1, 0.5, 1],
  [1, 0.49, 0], [0, 100, 0], [MAX_MONEY_CENTS, 1, MAX_MONEY_CENTS],
]) {
  test(`custo de ${unitCents} centavos × ${quantity} arredonda para ${expectedCents}`, () => {
    const result = calculateMoneyTotal(unitCents, quantity);
    assert.equal(result.ok, true);
    assert.equal(result.cents, expectedCents);
    assert.equal(result.value, expectedCents / 100);
  });
}

test("custos inválidos não produzem um valor gravável", () => {
  for (const [unit, quantity] of [
    [1, 0], [1, -1], [1, NaN], [1, Infinity], [0, Infinity],
    [-1, 2], [0.5, 2], [NaN, 2], [Infinity, 2],
    [MAX_MONEY_CENTS + 1, 1], [MAX_MONEY_CENTS, 2], [1, Number.MAX_VALUE],
  ]) {
    assert.equal(calculateMoneyTotal(unit, quantity).ok, false);
  }
});

test("estimativa usa o preço convertido e persiste o mesmo custo exibido", () => {
  for (const input of ["150.50", "150,50"]) {
    const price = parseMoney(input);
    const cost = calculateMoneyTotal(price.cents, 2.35);
    assert.equal(cost.value, 353.68);
    assert.equal(cost.value.toFixed(2), "353.68");
    assert.equal(JSON.parse(JSON.stringify({ preco_total: cost.value })).preco_total, 353.68);
  }
});
