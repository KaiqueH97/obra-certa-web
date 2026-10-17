import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'
const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const pages = loadTs(new URL('../lib/pagination.ts', import.meta.url), { './load-data': loads })
const { loadProjectPage, lastProjectPage } = loadTs(new URL('../lib/project-pagination.ts', import.meta.url), { './pagination': pages })
const rows = count => Array.from({ length: count }, (_, i) => ({ id: i + 1, titulo: `Obra ${i + 1}`, user_id: 'A', criado_em: '2026-01-01T00:00:00Z' }))
const signal = () => new AbortController().signal

test('lê somente 20 linhas e uma requisição mesmo com dez mil obras', async () => {
  const calls = []
  const result = await loadProjectPage(async (from, to) => { calls.push([from, to]); return { data: rows(20), count: 10000, error: null } }, 0, signal())
  assert.deepEqual(calls, [[0, 19]])
  assert.equal(result.total, 10000)
  assert.equal(result.rows.length, 20)
})

test('calcula faixa inclusiva da segunda página e aceita última página parcial', async () => {
  const calls = []
  const result = await loadProjectPage(async (from, to) => { calls.push([from, to]); return { data: rows(3), count: 23, error: null } }, 1, signal())
  assert.deepEqual(calls, [[20, 39]])
  assert.equal(result.page, 1)
  assert.equal(lastProjectPage(result.total), 1)
  assert.equal(lastProjectPage(20), 0)
  assert.equal(lastProjectPage(0), 0)
})

test('distingue lista vazia de página removida por exclusões', async () => {
  const empty = await loadProjectPage(async () => ({ data: [], count: 0, error: null }), 0, signal())
  assert.equal(empty.total, 0)
  const removed = await loadProjectPage(async () => ({ data: [], count: 20, error: null }), 1, signal())
  assert.equal(removed.page, 1)
  assert.equal(lastProjectPage(removed.total), 0)
})

for (const response of [
  { data: null, count: 0, error: null },
  { data: [], count: null, error: null },
  { data: [], count: -1, error: null },
  { data: [], count: 1.5, error: null },
  { data: [], count: 0 },
  { data: [], count: 0, error: { message: 'server error' } },
  { data: rows(10), count: 50, error: null },
  { data: rows(21), count: 50, error: null },
  { data: [rows(1)[0], rows(1)[0]], count: 2, error: null },
  { data: [null], count: 1, error: null },
]) {
  test(`rejeita página inconsistente: ${JSON.stringify(response)}`, async () => {
    await assert.rejects(loadProjectPage(async () => response, 0, signal()))
  })
}

test('rejeita índice inválido antes de consultar o servidor', async () => {
  let calls = 0
  for (const page of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER]) {
    await assert.rejects(loadProjectPage(async () => { calls++ }, page, signal()))
  }
  assert.equal(calls, 0)
})

test('cancelamento impede consulta e rejeita resposta tardia', async () => {
  const controller = new AbortController()
  controller.abort()
  let calls = 0
  await assert.rejects(loadProjectPage(async () => { calls++ }, 0, controller.signal))
  assert.equal(calls, 0)
  const late = new AbortController()
  await assert.rejects(loadProjectPage(async () => { late.abort(); return { data: rows(1), count: 1, error: null } }, 0, late.signal))
})

test('faixa removida no PostgREST confirma total com uma linha e permite ajustar a página', async () => {
  const calls = []
  const result = await loadProjectPage(async (from, to) => {
    calls.push([from, to])
    return from > 0 ? { data: null, count: null, error: { code: 'PGRST103' } } : { data: rows(1), count: 5, error: null }
  }, 2, signal())
  assert.deepEqual(calls, [[40, 59], [0, 0]])
  assert.equal(result.rows.length, 0)
  assert.equal(result.total, 5)
  assert.equal(result.page, 2)
})

test('falha ao confirmar total após 416 não é convertida em lista vazia', async () => {
  let calls = 0
  await assert.rejects(loadProjectPage(async () => ++calls === 1
    ? { data: null, count: null, error: { code: 'PGRST103' } }
    : { data: null, count: null, error: { message: 'offline' } }, 1, signal()))
  assert.equal(calls, 2)
})
