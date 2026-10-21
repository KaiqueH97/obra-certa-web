import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'
const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const { readProfile, profileInitials, createProfileSaver } = loadTs(new URL('../lib/profile.ts', import.meta.url), { './load-data': loads })
const response = (data = { nome: 'Ana', telefone: '11999999999' }, id = 'A') => ({ data: { user: { id, email: 'ana@example.com', user_metadata: data } }, error: null })
const input = { nome: 'Ana', telefone: '11999999999' }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture(overrides = {}, timeoutMs = 1000) {
  const states = [], confirmed = [], requests = []
  const deps = {
    getUser: async () => response(),
    update: async data => { requests.push(data); return response(data) },
    isAuthBusy: () => false,
    onState: state => states.push(state),
    onConfirmed: data => confirmed.push(data),
    ...overrides,
  }
  return { saver: createProfileSaver(deps, timeoutMs), deps, states, confirmed, requests }
}

test('perfil tolera metadados antigos/inválidos sem quebrar render ou avatar', () => {
  for (const metadata of [undefined, null, [], { nome: { invalid: true }, telefone: 123 }]) {
    const source = response()
    source.data.user.user_metadata = metadata
    const result = readProfile(source)
    assert.equal(result.nome, '')
    assert.equal(result.telefone, '')
    assert.equal(profileInitials(result.nome), 'OC')
  }
  assert.equal(profileInitials('  Ana   Maria  '), 'AM')
  assert.equal(profileInitials('Ana'), 'AN')
  assert.equal(profileInitials('  '), 'OC')
})

for (const value of [null, {}, { data: { user: null }, error: null }, { data: { user: { id: 'A' } } }, { ...response(), error: { status: 503 } }]) {
  test(`carregamento incompleto não é perfil válido: ${JSON.stringify(value)}`, () => {
    assert.throws(() => readProfile(value), /carregar seu perfil/)
  })
}

test('confirma identidade e metadados retornados, normaliza espaços e bloqueia reenvio até nova edição', async () => {
  const f = fixture()
  await f.saver.save('A', { nome: ' Ana ', telefone: ' 11999999999 ' })
  assert.equal(f.requests[0].nome, input.nome)
  assert.equal(f.requests[0].telefone, input.telefone)
  assert.equal(f.confirmed[0].email, 'ana@example.com')
  assert.equal(f.states.at(-1).status, 'success')
  await f.saver.save('A', input)
  assert.equal(f.requests.length, 1)
  f.saver.reset()
  await f.saver.save('A', input)
  assert.equal(f.requests.length, 2)
})

test('nome vazio e autenticação ocupada não enviam gravação', async () => {
  const f = fixture()
  await f.saver.save('A', { ...input, nome: '  ' })
  assert.match(f.states.at(-1).message, /vazio/)
  f.deps.isAuthBusy = () => true
  await f.saver.save('A', input)
  assert.equal(f.requests.length, 0)
})

test('duplo envio é bloqueado antes de React renderizar', async () => {
  const d = deferred(), f = fixture({ getUser: () => d.promise })
  const task = f.saver.save('A', input)
  await f.saver.save('A', input)
  d.resolve(response())
  await task
  assert.equal(f.requests.length, 1)
})

test('troca de conta ou logout iniciado durante validação bloqueia a gravação', async () => {
  const f = fixture({ getUser: async () => response(input, 'B') })
  await f.saver.save('A', input)
  assert.equal(f.states.at(-1).status, 'blocked')
  assert.equal(f.requests.length, 0)
  const d = deferred(), g = fixture({ getUser: () => d.promise })
  const task = g.saver.save('A', input)
  await Promise.resolve()
  g.deps.isAuthBusy = () => true
  d.resolve(response())
  await task
  assert.equal(g.states.at(-1).status, 'blocked')
  assert.equal(g.requests.length, 0)
})

test('falha antes de iniciar PUT permite nova tentativa sem falso sucesso', async () => {
  const f = fixture({ getUser: async () => { throw new Error('offline') } })
  await f.saver.save('A', input)
  assert.equal(f.states.at(-1).status, 'idle')
  assert.equal(f.requests.length, 0)
  f.deps.getUser = async () => response()
  await f.saver.save('A', input)
  assert.equal(f.states.at(-1).status, 'success')
})

for (const value of [null, {}, { data: null, error: null }, response(input, 'B'), response({ nome: 'Outra', telefone: input.telefone }), response({ nome: input.nome }), { ...response(), error: { status: 503 } }]) {
  test(`resposta inconclusiva não confirma gravação nem permite reenviar: ${JSON.stringify(value)}`, async () => {
    let calls = 0
    const f = fixture({ update: async () => { calls++; return value } })
    await f.saver.save('A', input)
    assert.equal(f.states.at(-1).status, 'uncertain')
    assert.equal(f.confirmed.length, 0)
    f.saver.reset()
    await f.saver.save('A', input)
    assert.equal(calls, 1)
  })
}

test('rede cai depois de iniciar PUT: resultado incerto', async () => {
  const f = fixture({ update: async () => { throw new Error('offline') } })
  await f.saver.save('A', input)
  assert.equal(f.states.at(-1).status, 'uncertain')
})

test('rejeição explícita permite corrigir; sessão inválida exige recarregar', async () => {
  const f = fixture({ update: async () => ({ data: null, error: { status: 422, message: 'internal' } }) })
  await f.saver.save('A', input)
  assert.equal(f.states.at(-1).status, 'idle')
  assert.doesNotMatch(f.states.at(-1).message, /internal/)
  f.deps.update = async () => ({ data: null, error: { status: 429 } })
  await f.saver.save('A', input)
  assert.match(f.states.at(-1).message, /Aguarde/)
  f.deps.update = async () => ({ data: null, error: { status: 401 } })
  await f.saver.save('A', input)
  assert.equal(f.states.at(-1).status, 'blocked')
})

test('timeout antes do envio não permite que validação atrasada dispare PUT', async () => {
  const d = deferred(), f = fixture({ getUser: () => d.promise }, 10)
  await f.saver.save('A', input)
  assert.equal(f.states.at(-1).status, 'idle')
  d.resolve(response())
  await Promise.resolve()
  assert.equal(f.requests.length, 0)
})

test('timeout após envio não vira sucesso com resposta tardia', async () => {
  const d = deferred(), f = fixture({ update: () => d.promise }, 10)
  await f.saver.save('A', input)
  assert.equal(f.states.at(-1).status, 'uncertain')
  const count = f.states.length
  d.resolve(response())
  await Promise.resolve()
  assert.equal(f.states.length, count)
  assert.equal(f.confirmed.length, 0)
})

test('desmontagem cancela espera e ignora retorno anterior mesmo após reativação', async () => {
  const d = deferred(), f = fixture({ update: () => d.promise })
  const task = f.saver.save('A', input)
  await Promise.resolve()
  await Promise.resolve()
  f.saver.deactivate()
  await task
  f.saver.activate()
  assert.equal(f.states.at(-1).status, 'uncertain')
  const count = f.states.length
  d.resolve(response())
  await Promise.resolve()
  assert.equal(f.states.length, count)
  assert.equal(f.confirmed.length, 0)
})
