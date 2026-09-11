import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const exports = {}
const { outputText } = ts.transpileModule(
  readFileSync(new URL('../lib/auth-actions.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
)
vm.runInNewContext(outputText, { exports })
const { createAuthActions } = exports
const session = { access_token: 'test-token', user: { id: 'user-a' } }
const success = { data: { user: session.user, session }, error: null }
const credentials = { email: 'test@example.com', password: 'test-password' }

function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

function fixture(overrides = {}) {
  const notices = [], pending = [], destinations = [], calls = []
  const actions = createAuthActions({
    signIn: async input => { calls.push(['login', input]); return success },
    signOut: async () => { calls.push(['logout']); return { error: null } },
    getSession: async () => ({ data: { session: null }, error: null }),
    navigate: path => destinations.push(path),
    onPendingChange: value => pending.push(value),
    notices: {
      loading(message) { notices.push({ type: 'loading', message, id: 'own-toast' }); return 'own-toast' },
      success(message, id) { notices.push({ type: 'success', message, id }) },
      error(message, id) { notices.push({ type: 'error', message, id }) },
      dismiss(id) { notices.push({ type: 'dismiss', id }) },
    },
    ...overrides,
  })
  return { actions, notices, pending, destinations, calls }
}

test('login só navega após sessão confirmada, sem timer, e mantém trava até a navegação', async () => {
  const response = deferred()
  const f = fixture({ signIn: () => response.promise })
  const operation = f.actions.login(credentials)
  assert.deepEqual(f.destinations, [])
  assert.deepEqual(f.pending, ['login'])
  response.resolve(success)
  await operation
  assert.deepEqual(f.destinations, ['/home'])
  assert.deepEqual(f.notices.map(n => n.type), ['loading', 'success'])
  await f.actions.login(credentials)
  assert.equal(f.destinations.length, 1)
  assert.deepEqual(f.pending, ['login'])
})

for (const [name, result] of [
  ['resposta nula', { data: null, error: null }],
  ['sem usuário', { data: { user: null, session }, error: null }],
  ['sem sessão', { data: { user: session.user, session: null }, error: null }],
  ['token vazio', { data: { user: session.user, session: { ...session, access_token: '' } }, error: null }],
  ['usuários divergentes', { data: { user: { id: 'user-b' }, session }, error: null }],
  ['sessão acompanhada de erro', { ...success, error: { message: 'secret backend detail' } }],
]) {
  test(`login ${name}: não navega e libera formulário sem sucesso`, async () => {
    const f = fixture({ signIn: async () => result })
    await f.actions.login(credentials)
    assert.deepEqual(f.destinations, [])
    assert.deepEqual(f.pending, ['login', null])
    assert.deepEqual(f.notices.map(n => n.type), ['loading', 'error'])
    assert.equal(f.notices[1].id, 'own-toast')
    assert.doesNotMatch(f.notices[1].message, /secret backend/)
  })
}

for (const [code, message] of [
  ['invalid_credentials', 'E-mail ou senha incorretos.'],
  ['email_not_confirmed', 'Confirme seu e-mail antes de entrar.'],
]) {
  test(`login exibe mensagem para ${code}`, async () => {
    const f = fixture({ signIn: async () => ({ data: null, error: { code, message: 'internal' } }) })
    await f.actions.login(credentials)
    assert.equal(f.notices.at(-1).message, message)
    assert.deepEqual(f.destinations, [])
  })
}

test('exceção de rede no login encerra carregamento e permite uma nova tentativa explícita', async () => {
  let attempts = 0
  const f = fixture({ signIn: async () => {
    if (++attempts === 1) throw new TypeError('Failed to fetch')
    return success
  } })
  await f.actions.login(credentials)
  assert.equal(attempts, 1)
  assert.equal(f.pending.at(-1), null)
  assert.deepEqual(f.destinations, [])
  await f.actions.login(credentials)
  assert.equal(attempts, 2)
  assert.deepEqual(f.destinations, ['/home'])
})

test('logout confirmado com sessão local removida navega para login', async () => {
  const f = fixture()
  await f.actions.logout()
  assert.deepEqual(f.destinations, ['/login'])
  assert.deepEqual(f.notices.map(n => n.type), ['loading', 'success'])
})

for (const throws of [false, true]) {
  test(`logout com falha ${throws ? 'lançada' : 'retornada'} e sessão preservada não anuncia saída`, async () => {
    const f = fixture({
      signOut: async () => { if (throws) throw new Error('offline'); return { error: { message: 'offline' } } },
      getSession: async () => ({ data: { session }, error: null }),
    })
    await f.actions.logout()
    assert.deepEqual(f.destinations, [])
    assert.deepEqual(f.pending, ['logout', null])
    assert.deepEqual(f.notices.map(n => n.type), ['loading', 'error'])
  })

  test(`logout com falha ${throws ? 'lançada' : 'retornada'} e sessão já removida informa saída parcial`, async () => {
    const f = fixture({
      signOut: async () => { if (throws) throw new Error('offline'); return { error: { message: 'offline' } } },
    })
    await f.actions.logout()
    assert.deepEqual(f.destinations, ['/login?saida=parcial'])
    assert.deepEqual(f.notices.map(n => n.type), ['loading', 'dismiss'])
    assert.equal(f.notices.at(-1).id, 'own-toast')
  })
}

for (const [name, getSession] of [
  ['sessão ainda presente', async () => ({ data: { session }, error: null })],
  ['erro ao ler sessão', async () => ({ data: { session: null }, error: { message: 'failed' } })],
  ['exceção ao ler sessão', async () => { throw new Error('failed') }],
]) {
  test(`logout: ${name} não é confirmação`, async () => {
    const f = fixture({ getSession })
    await f.actions.logout()
    assert.deepEqual(f.destinations, [])
    assert.equal(f.pending.at(-1), null)
    assert.equal(f.notices.at(-1).type, 'error')
  })
}

test('cliques de dois botões de logout compartilham uma única requisição', async () => {
  let calls = 0
  const response = deferred()
  const f = fixture({ signOut: () => { calls++; return response.promise } })
  const first = f.actions.logout()
  await f.actions.logout()
  await f.actions.login(credentials)
  assert.equal(calls, 1)
  assert.equal(f.calls.length, 0)
  response.resolve({ error: null })
  await first
  assert.deepEqual(f.destinations, ['/login'])
})

test('clique duplicado no login não envia senha duas vezes', async () => {
  const response = deferred()
  let calls = 0
  const f = fixture({ signIn: () => { calls++; return response.promise } })
  const first = f.actions.login(credentials)
  await f.actions.login(credentials)
  assert.equal(calls, 1)
  response.resolve(success)
  await first
})

test('desmontagem evita navegação tardia e encerra apenas o próprio toast', async () => {
  const response = deferred()
  const f = fixture({ signIn: () => response.promise })
  const operation = f.actions.login(credentials)
  f.actions.deactivate()
  response.resolve(success)
  await operation
  assert.deepEqual(f.destinations, [])
  assert.deepEqual(f.pending, ['login'])
  assert.deepEqual(f.notices.at(-1), { type: 'dismiss', id: 'own-toast' })
  await f.actions.logout()
  assert.equal(f.calls.length, 0)
})

test('falha síncrona de navegação libera a trava sem anunciar sucesso', async () => {
  const f = fixture({ navigate: () => { throw new Error('navigation blocked') } })
  await f.actions.login(credentials)
  assert.equal(f.pending.at(-1), null)
  assert.deepEqual(f.notices.map(n => n.type), ['loading', 'error'])
})
