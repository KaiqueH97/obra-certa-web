import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'

const { createPasswordReset } = loadTs(new URL('../lib/password-reset.ts', import.meta.url))
const user = { id: 'conta-a', email: 'a@example.com' }
const ok = { data: { user }, error: null }
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
function fixture(overrides = {}, timeoutMs = 1000) {
  const states = [], calls = []
  let cleared = 0
  const deps = {
    initialize: async () => ({ error: null }),
    hasPendingCallback: () => false,
    getUser: async () => ok,
    updatePassword: async password => { calls.push(password); return ok },
    clearPasswords: () => { cleared++ },
    onState: state => states.push(state),
    ...overrides,
  }
  const reset = createPasswordReset(deps, timeoutMs)
  return { reset, deps, states, calls, get cleared() { return cleared } }
}

test('aguarda inicialização e usuário verificado antes de aceitar uma senha', async () => {
  const init = deferred(), f = fixture({ initialize: () => init.promise })
  const task = f.reset.activate()
  await f.reset.submit('senha-nova', 'senha-nova')
  assert.equal(f.calls.length, 0)
  assert.equal(f.states.at(-1).status, 'checking')
  init.resolve({ error: null })
  await task
  assert.equal(f.states.at(-1).status, 'ready')
  assert.equal(f.states.at(-1).email, user.email)
  await f.reset.submit('senha-nova', 'senha-nova')
  assert.deepEqual(f.calls, ['senha-nova'])
  assert.equal(f.states.at(-1).status, 'success')
  assert.equal(f.cleared, 1)
  await f.reset.submit('senha-nova', 'senha-nova')
  assert.equal(f.calls.length, 1)
})

for (const [label, overrides] of [
  ['callback rejeitado mesmo com outra sessão válida', { initialize: async () => ({ error: { status: 400 } }) }],
  ['código sem verifier ou erro ainda presente na URL', { hasPendingCallback: () => true }],
  ['sem usuário', { getUser: async () => ({ data: { user: null }, error: null }) }],
  ['retorno incompleto', { getUser: async () => ({ data: { user } }) }],
  ['rede indisponível', { getUser: async () => { throw new Error('offline') } }],
]) {
  test(`bloqueia redefinição: ${label}`, async () => {
    const f = fixture(overrides)
    await f.reset.activate()
    await f.reset.submit('senha-nova', 'senha-nova')
    assert.equal(f.states.at(-1).status, 'invalid')
    assert.equal(f.states.at(-1).email, null)
    assert.equal(f.calls.length, 0)
  })
}

test('valida tamanho e confirmação sem alterar senha; trava duplicatas sincronamente', async () => {
  const d = deferred(), calls = []
  const f = fixture({ updatePassword: password => { calls.push(password); return d.promise } })
  await f.reset.activate()
  await f.reset.submit('123', '123')
  assert.match(f.states.at(-1).error, /6 caracteres/)
  await f.reset.submit('senha-nova', 'outra-senha')
  assert.match(f.states.at(-1).error, /não coincidem/)
  assert.equal(calls.length, 0)
  const task = f.reset.submit('senha-nova', 'senha-nova')
  await f.reset.submit('senha-nova', 'senha-nova')
  await Promise.resolve()
  assert.equal(calls.length, 1)
  d.resolve(ok)
  await task
})

for (const code of ['same_password', 'weak_password', 'over_request_rate_limit']) {
  test(`rejeição explícita permite correção: ${code}`, async () => {
    const f = fixture({ updatePassword: async () => ({ data: null, error: { status: code === 'over_request_rate_limit' ? 429 : 422, code, message: 'secret details' } }) })
    await f.reset.activate()
    await f.reset.submit('senha-nova', 'senha-nova')
    assert.equal(f.states.at(-1).status, 'ready')
    assert.doesNotMatch(f.states.at(-1).error, /secret/)
    f.deps.updatePassword = async () => ok
    await f.reset.submit('senha-nova', 'senha-nova')
    assert.equal(f.states.at(-1).status, 'success')
  })
}

for (const response of [null, {}, { data: null, error: null }, { data: { user: { id: 'conta-b' } }, error: null }, { data: { user } }, { data: null, error: { status: 503 } }]) {
  test(`gravação inconclusiva não anuncia sucesso: ${JSON.stringify(response)}`, async () => {
    let sent = 0
    const f = fixture({ updatePassword: async () => { sent++; return response } })
    await f.reset.activate()
    await f.reset.submit('senha-nova', 'senha-nova')
    assert.equal(f.states.at(-1).status, 'uncertain')
    assert.equal(f.cleared, 1)
    await f.reset.submit('senha-nova', 'senha-nova')
    assert.equal(sent, 1)
  })
}

test('exceção durante gravação termina espera com resultado incerto', async () => {
  const f = fixture({ updatePassword: async () => { throw new Error('offline') } })
  await f.reset.activate()
  await f.reset.submit('senha-nova', 'senha-nova')
  assert.equal(f.states.at(-1).status, 'uncertain')
})

test('sessão expirada no servidor invalida o formulário', async () => {
  const f = fixture({ updatePassword: async () => ({ data: null, error: { status: 401 } }) })
  await f.reset.activate()
  await f.reset.submit('senha-nova', 'senha-nova')
  assert.equal(f.states.at(-1).status, 'invalid')
})

test('revalida identidade antes do envio mesmo sem notificação de outra aba', async () => {
  const f = fixture()
  await f.reset.activate()
  f.deps.getUser = async () => ({ data: { user: { id: 'conta-b' } }, error: null })
  await f.reset.submit('senha-nova', 'senha-nova')
  assert.equal(f.states.at(-1).status, 'invalid')
  assert.equal(f.calls.length, 0)
})

test('renovação da mesma conta preserva formulário; logout e troca bloqueiam envio', async () => {
  for (const nextId of [null, 'conta-b']) {
    const f = fixture()
    await f.reset.activate()
    f.reset.sessionChanged(user.id)
    assert.equal(f.states.at(-1).status, 'ready')
    f.reset.sessionChanged(nextId)
    await f.reset.submit('senha-nova', 'senha-nova')
    assert.equal(f.states.at(-1).status, 'invalid')
    assert.equal(f.calls.length, 0)
  }
})

test('troca durante validação pendente impede envio posterior', async () => {
  const d = deferred(), f = fixture()
  await f.reset.activate()
  f.deps.getUser = () => d.promise
  const task = f.reset.submit('senha-nova', 'senha-nova')
  await Promise.resolve()
  f.reset.sessionChanged('conta-b')
  await task
  d.resolve(ok)
  await Promise.resolve()
  assert.equal(f.calls.length, 0)
  assert.equal(f.states.at(-1).status, 'invalid')
})

test('timeout de validação não inicia gravação quando usuário chega atrasado', async () => {
  const d = deferred(), f = fixture({}, 10)
  await f.reset.activate()
  f.deps.getUser = () => d.promise
  await f.reset.submit('senha-nova', 'senha-nova')
  assert.equal(f.states.at(-1).status, 'invalid')
  d.resolve(ok)
  await Promise.resolve()
  assert.equal(f.calls.length, 0)
})

test('timeout de inicialização não libera formulário por retorno tardio', async () => {
  const d = deferred(), f = fixture({ initialize: () => d.promise }, 10)
  await f.reset.activate()
  assert.equal(f.states.at(-1).status, 'invalid')
  const count = f.states.length
  d.resolve({ error: null })
  await Promise.resolve()
  assert.equal(f.states.length, count)
})

test('timeout de gravação mantém aviso incerto mesmo depois do sucesso tardio', async () => {
  const d = deferred(), f = fixture({ updatePassword: () => d.promise }, 10)
  await f.reset.activate()
  await f.reset.submit('senha-nova', 'senha-nova')
  assert.equal(f.states.at(-1).status, 'uncertain')
  const count = f.states.length
  d.resolve(ok)
  await Promise.resolve()
  assert.equal(f.states.length, count)
})

test('desmontagem cancela espera; nova ativação não recebe resultado da anterior', async () => {
  const d = deferred(), f = fixture({ updatePassword: () => d.promise })
  await f.reset.activate()
  const task = f.reset.submit('senha-nova', 'senha-nova')
  await Promise.resolve()
  f.reset.deactivate()
  await task
  await f.reset.activate()
  const count = f.states.length
  d.resolve(ok)
  await Promise.resolve()
  assert.equal(f.states.length, count)
  assert.equal(f.states.at(-1).status, 'ready')
})
