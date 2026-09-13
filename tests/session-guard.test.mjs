import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'

const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const { createSessionGuard } = loadTs(new URL('../lib/session-guard.ts', import.meta.url), { './load-data': loads })
const { createAuthActions } = loadTs(new URL('../lib/auth-actions.ts', import.meta.url))
const tick = () => new Promise(resolve => setTimeout(resolve, 15))
const user = id => ({ data: { user: id ? { id } : null }, error: null })
const deferred = () => {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
function fixture(overrides = {}, timeout = 1000) {
  const views = [], destinations = []
  let hidden = 0, calls = 0
  const guard = createSessionGuard({
    getUser: async () => { calls++; return user('A') },
    isLoggingOut: () => false,
    hide: () => { hidden++ },
    onState: state => views.push(state),
    navigate: path => destinations.push(path),
    ...overrides,
  }, timeout)
  return { guard, views, destinations, hidden: () => hidden, calls: () => calls }
}

test('só libera conteúdo depois de confirmar usuário com o Auth', async () => {
  const response = deferred(), f = fixture({ getUser: () => response.promise })
  const run = f.guard.check()
  assert.equal(f.views.at(-1).status, 'checking')
  assert.equal(f.views.at(-1).userId, null)
  response.resolve(user('A'))
  await run
  assert.equal(f.views.at(-1).status, 'ready')
  assert.equal(f.views.at(-1).userId, 'A')
  f.guard.dispose()
})

test('eventos repetidos do mesmo usuário não recarregam a tela nem consultam Auth', async () => {
  const f = fixture()
  await f.guard.check()
  const count = f.views.length
  for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'SIGNED_IN']) f.guard.onAuthEvent(event, 'A')
  await tick()
  assert.equal(f.calls(), 1)
  assert.equal(f.views.length, count)
  assert.equal(f.destinations.length, 0)
  f.guard.dispose()
})

test('saída em outra aba bloqueia imediatamente e navega uma única vez', async () => {
  const f = fixture()
  await f.guard.check()
  f.guard.onAuthEvent('SIGNED_OUT', null)
  assert.equal(f.views.at(-1).status, 'blocked')
  assert.equal(f.views.at(-1).userId, null)
  assert.equal(f.destinations.length, 0)
  f.guard.onAuthEvent('SIGNED_OUT', null)
  await tick()
  assert.deepEqual(f.destinations, ['/login'])
  f.guard.dispose()
})

test('troca de conta descarta a identidade antiga antes de navegar', async () => {
  const f = fixture()
  await f.guard.check()
  f.guard.onAuthEvent('SIGNED_IN', 'B')
  assert.equal(f.views.at(-1).userId, null)
  await tick()
  assert.deepEqual(f.destinations, ['/home'])
  f.guard.dispose()
})

test('restauração/foco detecta troca de conta mesmo sem evento de broadcast', async () => {
  let id = 'A'
  const f = fixture({ getUser: async () => user(id) })
  await f.guard.check()
  f.guard.suspend()
  id = 'B'
  f.guard.resume()
  await tick()
  assert.equal(f.views.at(-1).status, 'blocked')
  assert.deepEqual(f.destinations, ['/home'])
  f.guard.dispose()
})

test('mesma conta ao retornar preserva identidade e não navega', async () => {
  const f = fixture()
  await f.guard.check()
  f.guard.suspend()
  assert.equal(f.views.at(-1).status, 'checking')
  assert.equal(f.views.at(-1).userId, 'A')
  f.guard.resume()
  f.guard.resume()
  await tick()
  assert.equal(f.views.at(-1).status, 'ready')
  assert.equal(f.calls(), 2)
  assert.equal(f.destinations.length, 0)
  f.guard.dispose()
})

test('sessão ausente ou inválida redireciona ao login', async () => {
  for (const result of [user(null), { data: { user: null }, error: { status: 401 } }]) {
    const f = fixture({ getUser: async () => result })
    await f.guard.check()
    await tick()
    assert.deepEqual(f.destinations, ['/login'])
    f.guard.dispose()
  }
})

test('falha de rede oculta conteúdo e permite nova tentativa sem forçar logout', async () => {
  let fail = false
  const f = fixture({ getUser: async () => { if (fail) throw new Error('offline'); return user('A') } })
  await f.guard.check()
  fail = true
  await f.guard.check()
  assert.equal(f.views.at(-1).status, 'error')
  assert.equal(f.views.at(-1).userId, 'A')
  assert.equal(f.destinations.length, 0)
  fail = false
  await f.guard.check()
  assert.equal(f.views.at(-1).status, 'ready')
  f.guard.dispose()
})

test('429 e 503 não são tratados como sessão encerrada', async () => {
  for (const status of [429, 503]) {
    const f = fixture({ getUser: async () => ({ data: { user: null }, error: { status } }) })
    await f.guard.check()
    assert.equal(f.views.at(-1).status, 'error')
    assert.equal(f.destinations.length, 0)
    f.guard.dispose()
  }
})

test('resposta anterior ao logout não volta a liberar dados', async () => {
  const response = deferred(), f = fixture({ getUser: () => response.promise })
  const checking = f.guard.check()
  f.guard.onAuthEvent('SIGNED_OUT', null)
  response.resolve(user('A'))
  await checking
  await tick()
  assert.equal(f.views.at(-1).status, 'blocked')
  assert.deepEqual(f.destinations, ['/login'])
  f.guard.dispose()
})

test('conta observada durante a consulta inicial não é substituída por resposta antiga', async () => {
  const response = deferred(), f = fixture({ getUser: () => response.promise })
  const checking = f.guard.check()
  f.guard.onAuthEvent('SIGNED_IN', 'B')
  response.resolve(user('A'))
  await checking
  await tick()
  assert.equal(f.views.some(v => v.status === 'ready'), false)
  assert.deepEqual(f.destinations, ['/home'])
  f.guard.dispose()
})

test('suspensão impede resposta tardia ou evento inicial de reexibir conteúdo oculto', async () => {
  const response = deferred(), f = fixture({ getUser: () => response.promise })
  const checking = f.guard.check()
  f.guard.suspend()
  f.guard.onAuthEvent('INITIAL_SESSION', 'A')
  response.resolve(user('A'))
  await checking
  await tick()
  assert.equal(f.views.at(-1).status, 'checking')
  assert.equal(f.views.at(-1).userId, null)
  f.guard.dispose()
})

test('timeout libera opção de tentar novamente sem renderizar conteúdo privado', async () => {
  const f = fixture({ getUser: () => new Promise(() => {}) }, 10)
  await f.guard.check()
  assert.equal(f.views.at(-1).status, 'error')
  assert.equal(f.views.at(-1).userId, null)
  f.guard.dispose()
})

test('desmontagem cancela verificação e navegações agendadas', async () => {
  const f = fixture()
  await f.guard.check()
  f.guard.onAuthEvent('SIGNED_OUT', null)
  const count = f.views.length
  f.guard.dispose()
  await tick()
  await f.guard.check()
  f.guard.onAuthEvent('SIGNED_IN', 'B')
  assert.equal(f.views.length, count)
  assert.equal(f.destinations.length, 0)
})

test('guard não antecipa o redirect do executor de logout parcial da própria aba', async () => {
  const paths = [], notices = []
  let guard
  const actions = createAuthActions({
    signIn: async () => ({ data: null, error: null }),
    signOut: async () => { guard.onAuthEvent('SIGNED_OUT', null); return { error: { message: 'remote failed' } } },
    getSession: async () => ({ data: { session: null }, error: null }),
    navigate: path => paths.push(path),
    onPendingChange: () => {},
    notices: { loading: () => 'toast', success: () => notices.push('success'), error: () => notices.push('error'), dismiss: () => {} },
  })
  const f = fixture({ isLoggingOut: () => actions.getPending() === 'logout', navigate: path => paths.push(path) })
  guard = f.guard
  await guard.check()
  await actions.logout()
  await tick()
  assert.equal(f.views.at(-1).status, 'blocked')
  assert.deepEqual(paths, ['/login?saida=parcial'])
  assert.deepEqual(notices, [])
  guard.dispose()
})
