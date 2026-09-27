import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'

const { createSignup } = loadTs(new URL('../lib/signup.ts', import.meta.url))
const credentials = { nome: ' Carlos ', email: ' carlos@example.com ', password: ' senha123 ' }
const emailResponse = { data: { user: { id: 'A' }, session: null }, error: null }
const sessionResponse = { data: { user: { id: 'A' }, session: { access_token: 'token-teste', user: { id: 'A' } } }, error: null }
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
function fixture(request = async () => emailResponse, timeout = 1000) {
  const states = [], destinations = [], requests = []
  let cleared = 0
  const signup = createSignup({
    request: input => { requests.push(input); return request(input) },
    onState: state => states.push(state), clearPassword: () => cleared++,
    navigate: path => destinations.push(path),
  }, timeout)
  return { signup, states, destinations, requests, cleared: () => cleared }
}

test('cadastro sem sessão permanece no aviso de e-mail, sem afirmar criação de conta', async () => {
  const f = fixture()
  await f.signup.submit(credentials)
  assert.equal(f.states.at(-1).status, 'email')
  assert.equal(f.cleared(), 1)
  assert.equal(f.destinations.length, 0)
  assert.equal(f.requests[0].nome, 'Carlos')
  assert.equal(f.requests[0].email, 'carlos@example.com')
  assert.equal(f.requests[0].password, ' senha123 ')
  await f.signup.submit(credentials)
  assert.equal(f.requests.length, 1)
})

test('usuário ofuscado recebe o mesmo estado neutro sem consultar existência de conta', async () => {
  const f = fixture(async () => ({ data: { user: { id: 'obfuscated', identities: [] }, session: null }, error: null }))
  await f.signup.submit(credentials)
  assert.equal(f.states.at(-1).status, 'email')
  assert.equal(f.destinations.length, 0)
})

test('sessão válida leva a home uma única vez e mantém envio bloqueado', async () => {
  const f = fixture(async () => sessionResponse)
  await f.signup.submit(credentials)
  await f.signup.submit(credentials)
  assert.deepEqual(f.destinations, ['/home'])
  assert.equal(f.states.at(-1).status, 'redirecting')
  assert.equal(f.requests.length, 1)
})

for (const [name, response] of [
  ['dados nulos', { data: null, error: null }],
  ['usuário nulo', { data: { user: null, session: null }, error: null }],
  ['usuário vazio', { data: { user: { id: '' }, session: null }, error: null }],
  ['sessão omitida', { data: { user: { id: 'A' } }, error: null }],
  ['token vazio', { data: { user: { id: 'A' }, session: { access_token: '', user: { id: 'A' } } }, error: null }],
  ['usuários diferentes', { data: { user: { id: 'A' }, session: { access_token: 'token', user: { id: 'B' } } }, error: null }],
  ['falha de servidor com dados', { ...sessionResponse, error: { status: 503 } }],
]) {
  test(`${name}: não anuncia sucesso nem navega ou reenvia automaticamente`, async () => {
    const f = fixture(async () => response)
    await f.signup.submit(credentials)
    assert.equal(f.states.at(-1).status, 'uncertain')
    assert.equal(f.destinations.length, 0)
    await f.signup.submit(credentials)
    assert.equal(f.requests.length, 1)
  })
}

test('rejeição explícita permite correção e uma nova tentativa manual', async () => {
  let response = { data: null, error: { status: 422, code: 'weak_password' } }
  const f = fixture(async () => response)
  await f.signup.submit(credentials)
  assert.equal(f.states.at(-1).status, 'idle')
  assert.match(f.states.at(-1).error, /senha mais forte/)
  assert.equal(f.cleared(), 0)
  response = emailResponse
  await f.signup.submit(credentials)
  assert.equal(f.states.at(-1).status, 'email')
})

test('limite de requisições não revela mensagem bruta do servidor', async () => {
  const f = fixture(async () => ({ data: null, error: { status: 429, message: 'sensitive details' } }))
  await f.signup.submit(credentials)
  assert.match(f.states.at(-1).error, /Aguarde/)
  assert.doesNotMatch(f.states.at(-1).error, /sensitive/)
})

test('clique duplicado antes do rerender envia uma requisição', async () => {
  const d = deferred(), f = fixture(() => d.promise)
  const first = f.signup.submit(credentials)
  await f.signup.submit(credentials)
  assert.equal(f.requests.length, 1)
  d.resolve(emailResponse)
  await first
})

test('exceção de rede encerra envio com resultado incerto e sem repetição', async () => {
  const f = fixture(() => { throw new Error('network') })
  await f.signup.submit(credentials)
  assert.equal(f.states.at(-1).status, 'uncertain')
  assert.equal(f.cleared(), 1)
  assert.equal(f.requests.length, 1)
})

test('timeout ignora resposta tardia e mantém opção de conferir acesso sem reenviar', async () => {
  const d = deferred(), f = fixture(() => d.promise, 10)
  await f.signup.submit(credentials)
  assert.equal(f.states.at(-1).status, 'uncertain')
  d.resolve(sessionResponse)
  await Promise.resolve()
  await f.signup.submit(credentials)
  assert.equal(f.destinations.length, 0)
  assert.equal(f.requests.length, 1)
})

test('desmontagem encerra espera e não permite feedback ou navegação tardia após reativação', async () => {
  const d = deferred(), f = fixture(() => d.promise)
  const task = f.signup.submit(credentials)
  await Promise.resolve()
  f.signup.deactivate()
  await task
  f.signup.activate()
  d.resolve(sessionResponse)
  await Promise.resolve()
  assert.equal(f.destinations.length, 0)
  assert.equal(f.states.length, 1)
  assert.equal(f.cleared(), 0)
})

test('campos inválidos não chegam ao Auth', async () => {
  const f = fixture()
  for (const input of [{ ...credentials, nome: ' ' }, { ...credentials, email: '' }, { ...credentials, password: '123' }]) {
    await f.signup.submit(input)
    assert.equal(f.states.at(-1).status, 'idle')
  }
  assert.equal(f.requests.length, 0)
})
