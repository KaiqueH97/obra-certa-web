import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const exports = {}
const { outputText } = ts.transpileModule(
  readFileSync(new URL('../lib/load-data.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
)
vm.runInNewContext(outputText, { exports, AbortController, setTimeout, clearTimeout })
const { createDataLoader, loadAllRows, requireData, LoadError } = exports
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => Promise.resolve()
function fixture(timeout = 1000) {
  const states = [], loaded = []
  return { states, loaded, loader: createDataLoader(state => states.push(state), timeout), apply: data => loaded.push(data) }
}

test('lista vazia confirmada é sucesso, retorno nulo ou erro não é lista vazia', () => {
  assert.equal(requireData({ data: [], error: null }).length, 0)
  for (const response of [{ data: null, error: null }, { data: [], error: { message: 'denied' } }]) {
    assert.throws(() => requireData(response), LoadError)
  }
  assert.throws(() => requireData({ data: null, error: null }, 'Obra não encontrada ou sem acesso.'), /Obra não encontrada/)
})

test('publica os dados somente após todas as consultas necessárias terminarem', async () => {
  const f = fixture(), a = deferred(), b = deferred()
  const running = f.loader.run(() => Promise.all([a.promise, b.promise]), f.apply)
  await flush()
  a.resolve(['materiais'])
  await flush()
  assert.equal(f.loaded.length, 0)
  assert.equal(f.states.at(-1).status, 'loading')
  b.resolve(['financeiro'])
  await running
  assert.equal(f.loaded.length, 1)
  assert.equal(f.states.at(-1).status, 'ready')
})

test('falha parcial não publica totais e aborta consultas restantes', async () => {
  const f = fixture(), failure = deferred()
  let signal
  const running = f.loader.run(s => { signal = s; return Promise.all([Promise.resolve(['materiais']), failure.promise]) }, f.apply)
  await flush()
  failure.reject(new Error('network failed'))
  await running
  assert.equal(f.loaded.length, 0)
  assert.equal(f.states.at(-1).status, 'error')
  assert.equal(signal.aborted, true)
})

test('uma tentativa explícita recupera de erro e limpa a mensagem', async () => {
  const f = fixture()
  await f.loader.run(async () => { throw new Error('offline') }, f.apply)
  assert.equal(f.states.at(-1).status, 'error')
  await f.loader.run(async () => [], f.apply)
  assert.equal(f.loaded.length, 1)
  assert.equal(f.states.at(-1).status, 'ready')
  assert.equal(f.states.at(-1).error, null)
})

test('resposta antiga não sobrescreve a tentativa mais recente, mesmo ignorando abort', async () => {
  const f = fixture(), old = deferred()
  let oldSignal
  const first = f.loader.run(signal => { oldSignal = signal; return old.promise }, f.apply)
  await flush()
  await f.loader.run(async () => 'novo', f.apply)
  old.resolve('antigo')
  await first
  assert.equal(oldSignal.aborted, true)
  assert.deepEqual(f.loaded, ['novo'])
  assert.equal(f.states.at(-1).status, 'ready')
})

test('erro antigo não substitui sucesso de uma consulta nova', async () => {
  const f = fixture(), old = deferred()
  const first = f.loader.run(() => old.promise, f.apply)
  await flush()
  await f.loader.run(async () => 'novo', f.apply)
  old.reject(new Error('erro antigo'))
  await first
  assert.deepEqual(f.loaded, ['novo'])
  assert.equal(f.states.at(-1).status, 'ready')
})

test('desmontagem cancela requisição e impede qualquer atualização posterior', async () => {
  const f = fixture(), response = deferred()
  const running = f.loader.run(() => response.promise, f.apply)
  await flush()
  f.loader.cancel()
  response.resolve('antigo')
  await running
  assert.equal(f.loaded.length, 0)
  assert.equal(f.states.length, 1)
  await f.loader.run(async () => 'inativo', f.apply)
  assert.equal(f.loaded.length, 0)
})

test('reinicialização do efeito permite carregar após cancelamento', async () => {
  const f = fixture()
  const first = f.loader.run(async () => 'antigo', f.apply)
  f.loader.cancel()
  f.loader.activate()
  await f.loader.run(async () => 'atual', f.apply)
  await first
  assert.deepEqual(f.loaded, ['atual'])
})

test('timeout encerra carregamento, aborta a consulta e ignora resposta tardia', async () => {
  const f = fixture(10), response = deferred()
  let signal
  await f.loader.run(s => { signal = s; return response.promise }, f.apply)
  assert.equal(f.states.at(-1).status, 'error')
  assert.match(f.states.at(-1).error, /demorou demais/)
  assert.equal(signal.aborted, true)
  response.resolve('tardio')
  await flush()
  assert.equal(f.loaded.length, 0)
})

test('exceção síncrona é tratada sem deixar a tela carregando', async () => {
  const f = fixture()
  await f.loader.run(() => { throw new Error('internal detail') }, f.apply)
  assert.equal(f.states.at(-1).status, 'error')
  assert.doesNotMatch(f.states.at(-1).error, /internal detail/)
})

test('não há repetição automática de consultas com erro', async () => {
  const f = fixture()
  let calls = 0
  await f.loader.run(async () => { calls++; throw new Error('offline') }, f.apply)
  assert.equal(calls, 1)
})

test('pagina até a contagem exata, incluindo totais além de 1000 linhas', async () => {
  const requests = []
  const all = Array.from({ length: 1205 }, (_, id) => ({ id, preco_total: 1 }))
  const rows = await loadAllRows(async (from, to) => {
    requests.push([from, to])
    return { data: all.slice(from, to + 1), error: null, count: all.length }
  }, new AbortController().signal)
  assert.equal(rows.length, 1205)
  assert.equal(rows.reduce((sum, row) => sum + row.preco_total, 0), 1205)
  assert.deepEqual(requests, [[0, 499], [500, 999], [1000, 1499]])
})

test('limite do servidor menor que a página não trunca a lista', async () => {
  const all = Array.from({ length: 5 }, (_, id) => ({ id }))
  const offsets = []
  const rows = await loadAllRows(async from => {
    offsets.push(from)
    return { data: all.slice(from, from + 2), count: 5, error: null }
  }, new AbortController().signal)
  assert.equal(rows.length, 5)
  assert.deepEqual(offsets, [0, 2, 4])
})

test('zero registros confirmado não pede uma página extra', async () => {
  let calls = 0
  const rows = await loadAllRows(async () => { calls++; return { data: [], count: 0, error: null } }, new AbortController().signal)
  assert.equal(rows.length, 0)
  assert.equal(calls, 1)
})

for (const [name, response] of [
  ['sem contagem', { data: [], count: null, error: null }],
  ['contagem inválida', { data: [], count: -1, error: null }],
  ['dados nulos', { data: null, count: 0, error: null }],
  ['erro do Supabase', { data: [], count: 0, error: { message: 'failed' } }],
  ['resposta sem linhas antes do total', { data: [], count: 2, error: null }],
  ['IDs duplicados', { data: [{ id: 1 }, { id: 1 }], count: 2, error: null }],
  ['contagem menor que os dados', { data: [{ id: 1 }], count: 0, error: null }],
]) {
  test(`recusa lista incompleta ou inconsistente: ${name}`, async () => {
    await assert.rejects(loadAllRows(async () => response, new AbortController().signal), LoadError)
  })
}

test('mudança na contagem entre páginas exige nova tentativa', async () => {
  let page = 0
  await assert.rejects(loadAllRows(async () => ({ data: [{ id: ++page }], count: page === 1 ? 2 : 3, error: null }), new AbortController().signal), /mudaram/)
})

test('erro na segunda página não retorna a primeira como lista completa', async () => {
  let page = 0
  await assert.rejects(loadAllRows(async () => ++page === 1
    ? { data: [{ id: 1 }], count: 2, error: null }
    : { data: null, count: null, error: { message: 'network' } }, new AbortController().signal), LoadError)
})

test('cancelamento impede buscar a próxima página', async () => {
  const controller = new AbortController()
  let calls = 0
  await assert.rejects(loadAllRows(async () => {
    calls++; controller.abort()
    return { data: [{ id: 1 }], count: 2, error: null }
  }, controller.signal))
  assert.equal(calls, 1)
})
