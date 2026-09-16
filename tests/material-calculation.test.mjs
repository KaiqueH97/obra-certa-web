import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'

const money = loadTs(new URL('../lib/money.ts', import.meta.url))
const { parseMeasurement, calculateArea, calculateMaterial } = loadTs(new URL('../lib/material-calculation.ts', import.meta.url), { './money': money })
const input = overrides => ({ superficie: 'piso', medidas: [{ altura: '3', largura: '4' }], comprimentoPiso: '', larguraPiso: '', precoUnitario: '', ...overrides })

test('medidas aceitam decimais completos com vírgula, ponto e espaços externos', () => {
  for (const text of ['3,50', '3.50', ' 3,50 ']) assert.equal(parseMeasurement(text), 3.5)
})

for (const text of ['', '0', '-3', '-0,5', '3abc', '3m', '1e3', 'Infinity', 'NaN', '1,2,3', '1.000,50', '3.', '0x10', '9'.repeat(400)]) {
  test(`recusa medida inválida: ${text.slice(0, 30) || 'vazia'}`, () => assert.equal(parseMeasurement(text), null))
}

test('valida cada área, soma medidas e impede duas negativas de produzir área positiva', () => {
  assert.equal(calculateArea([{ altura: '3,5', largura: '4' }, { altura: '2', largura: '1.5' }]).value, 17)
  assert.equal(calculateArea([{ altura: '-3', largura: '-4' }]).ok, false)
  assert.match(calculateArea([{ altura: '3', largura: '4' }, { altura: '2abc', largura: '1' }]).error, /Área 2/)
  assert.equal(calculateArea([]).ok, false)
})

test('recusa overflow, subfluxo e área que apareceria como zero', () => {
  for (const measure of ['9'.repeat(200), '0.' + '0'.repeat(200) + '1', '0.01']) {
    assert.equal(calculateArea([{ altura: measure, largura: measure }]).ok, false)
  }
  assert.equal(calculateArea([{ altura: '1', largura: '0.01' }]).value, 0.01)
})

test('mantém margem, converte cm para m e calcula custo por m², não por peça', () => {
  const result = calculateMaterial(input({ comprimentoPiso: '60,5', larguraPiso: '60.5', precoUnitario: '10,00' }))
  assert.equal(result.ok, true)
  assert.equal(result.value.area, '12,00')
  assert.equal(result.value.quantidade, '13,20')
  assert.equal(result.value.totalPecas, 37)
  assert.equal(result.value.precoTotalEstimado, 132)
})

for (const [length, width] of [['0', '60'], ['-1', '60'], ['60', ''], ['', '60'], ['60abc', '60'], ['1e3', '60'], ['0.' + '0'.repeat(200) + '1', '0.1'], ['9'.repeat(200), '9'.repeat(200)]]) {
  test(`peça inválida não produz estimativa salvável: ${length.slice(0, 15)}/${width.slice(0, 15)}`, () => {
    assert.equal(calculateMaterial(input({ comprimentoPiso: length, larguraPiso: width })).ok, false)
  })
}

test('peças são opcionais somente quando os dois campos estão vazios', () => {
  const result = calculateMaterial(input({ comprimentoPiso: ' ', larguraPiso: ' ' }))
  assert.equal(result.ok, true)
  assert.equal(result.value.totalPecas, undefined)
  assert.equal(result.value.precoTotalEstimado, 0)
})

test('preserva regras das dez superfícies e ignora dimensões de piso em outra superfície', () => {
  for (const superficie of ['piso', 'contrapiso', 'laje', 'telhado', 'impermeabilizacao']) {
    assert.equal(calculateMaterial(input({ superficie })).value.quantidade, '13,20')
  }
  for (const superficie of ['parede', 'reboco', 'revestimento', 'forro', 'pintura']) {
    assert.equal(calculateMaterial(input({ superficie, comprimentoPiso: '0' })).value.quantidade, '12,00')
  }
  assert.equal(calculateMaterial(input({ superficie: '' })).ok, false)
})

test('validação financeira anterior permanece ativa', () => {
  assert.equal(calculateMaterial(input({ precoUnitario: '10abc' })).ok, false)
  assert.equal(calculateMaterial(input({ precoUnitario: '99.999.999,99' })).ok, false)
  assert.equal(calculateMaterial(input({ precoUnitario: '0,29', superficie: 'parede', medidas: [{ altura: '3,5', largura: '1' }] })).value.precoTotalEstimado, 1.02)
})
