import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'

const { createPasswordRecovery } = loadTs(new URL('../lib/password-recovery.ts', import.meta.url))
const accepted = { data: {}, error: null }
const { act, createElement: h } = React
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
function fixture(request = async () => accepted, timeoutMs = 1000) {
  const states = [], calls = []
  const recovery = createPasswordRecovery({
    request: email => { calls.push(email); return request(email) },
    onState: state => states.push(state),
  }, timeoutMs)
  return { recovery, states, calls }
}

test('aceita confirmação do Auth, normaliza e-mail e não permite reenvio na mesma instância', async () => {
  const f = fixture()
  await f.recovery.submit(' conta@example.com ')
  assert.deepEqual(f.calls, ['conta@example.com'])
  assert.equal(f.states.at(-1).status, 'accepted')
  await f.recovery.submit('conta@example.com')
  assert.equal(f.calls.length, 1)
})

test('e-mail vazio não envia requisição', async () => {
  const f = fixture()
  await f.recovery.submit(' ')
  assert.equal(f.calls.length, 0)
  assert.equal(f.states.at(-1).status, 'idle')
  assert.match(f.states.at(-1).error, /Informe/)
})

test('trava síncrona bloqueia clique duplicado antes do rerender', async () => {
  const d = deferred(), f = fixture(() => d.promise)
  const first = f.recovery.submit('conta@example.com')
  await f.recovery.submit('conta@example.com')
  assert.equal(f.calls.length, 1)
  d.resolve(accepted)
  await first
})

for (const response of [null, {}, { data: null, error: null }, { data: [], error: null }, { data: {}, error: { status: 503 } }, { data: null, error: { status: 0 } }]) {
  test(`resposta inconclusiva não vira sucesso: ${JSON.stringify(response)}`, async () => {
    const f = fixture(async () => response)
    await f.recovery.submit('conta@example.com')
    assert.equal(f.states.at(-1).status, 'uncertain')
    await f.recovery.submit('conta@example.com')
    assert.equal(f.calls.length, 1)
  })
}

test('exceção de rede encerra envio e orienta conferir caixa de entrada', async () => {
  const f = fixture(() => { throw new Error('rede') })
  await f.recovery.submit('conta@example.com')
  assert.equal(f.states.at(-1).status, 'uncertain')
  assert.match(f.states.at(-1).error, /caixa de entrada/)
})

test('rejeição e rate limit permitem tentativa explícita sem expor mensagem interna', async () => {
  let response = { data: null, error: { status: 429, message: 'internal details' } }
  const f = fixture(async () => response)
  await f.recovery.submit('conta@example.com')
  assert.match(f.states.at(-1).error, /Aguarde/)
  response = { data: null, error: { status: 422, message: 'internal details' } }
  await f.recovery.submit('conta@example.com')
  assert.equal(f.states.at(-1).status, 'idle')
  assert.doesNotMatch(f.states.at(-1).error, /internal/)
  response = accepted
  await f.recovery.submit('conta@example.com')
  assert.equal(f.states.at(-1).status, 'accepted')
})

test('timeout libera o feedback e resposta tardia não altera resultado incerto', async () => {
  const d = deferred(), f = fixture(() => d.promise, 10)
  await f.recovery.submit('conta@example.com')
  assert.equal(f.states.at(-1).status, 'uncertain')
  const count = f.states.length
  d.resolve(accepted)
  await Promise.resolve()
  assert.equal(f.states.length, count)
})

test('desmontagem encerra espera e reativação não autoriza resposta anterior', async () => {
  const d = deferred(), f = fixture(() => d.promise)
  const task = f.recovery.submit('conta@example.com')
  await Promise.resolve()
  f.recovery.deactivate()
  await task
  f.recovery.activate()
  d.resolve(accepted)
  await Promise.resolve()
  assert.equal(f.states.length, 1)
})

async function mount(t, initial = accepted) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/recuperar?next=https://other.example' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = await import('react-dom/client')
  let response = initial
  const requests = []
  const { default: Page } = loadTs(new URL('../app/recuperar/page.tsx', import.meta.url), {
    react: React, 'react/jsx-runtime': jsx, 'next/link': { default: props => h('a', props) },
    '@/lib/password-recovery': { createPasswordRecovery },
    '@/lib/supabase': { supabase: { auth: { resetPasswordForEmail: (email, options) => {
      requests.push({ email, options }); return Promise.resolve(response)
    } } } },
  })
  const root = createRoot(document.getElementById('root'))
  let mounted = true
  const unmount = async () => { if (mounted) { await act(() => root.unmount()); mounted = false } }
  t.after(async () => {
    await unmount()
    dom.window.close()
    delete globalThis.window
    delete globalThis.document
    delete globalThis.IS_REACT_ACT_ENVIRONMENT
  })
  await act(() => root.render(h(Page)))
  await act(() => {
    const input = document.getElementById('recuperar-email')
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'conta@example.com')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  return {
    requests, unmount, setResponse: value => { response = value },
    submit: () => act(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))),
  }
}

test('página usa destino fixo da origem atual e mostra aviso neutro com foco', async t => {
  const ui = await mount(t)
  await ui.submit()
  assert.equal(ui.requests[0].email, 'conta@example.com')
  assert.equal(ui.requests[0].options.redirectTo, 'https://app.example/redefinir-senha')
  assert.match(document.body.textContent, /Se houver uma conta elegível/)
  assert.doesNotMatch(document.body.textContent, /enviado com sucesso/)
  assert.equal(document.activeElement, document.querySelector('[role="status"]'))
  assert.equal(document.querySelector('form'), null)
  assert.ok(document.querySelector('a[href="/login"]'))
})

test('rejeição mantém e-mail e libera formulário; envio bloqueia campos e duplicatas', async t => {
  const d = deferred(), ui = await mount(t, d.promise)
  await ui.submit()
  await ui.submit()
  assert.equal(ui.requests.length, 1)
  assert.equal(document.querySelector('input').disabled, true)
  await act(async () => d.resolve({ data: null, error: { status: 422 } }))
  assert.equal(document.querySelector('input').value, 'conta@example.com')
  assert.equal(document.querySelector('button').disabled, false)
  assert.ok(document.querySelector('[role="alert"]'))
  ui.setResponse(accepted)
  await ui.submit()
  assert.equal(ui.requests.length, 2)
})

test('falha inconclusiva remove envio e mantém link de login', async t => {
  const ui = await mount(t, { data: null, error: { status: 503 } })
  await ui.submit()
  assert.ok(document.querySelector('[role="alert"]'))
  assert.equal(document.querySelector('form'), null)
  assert.ok(document.querySelector('a[href="/login"]'))
})

test('resposta depois da navegação não deixa feedback na tela desmontada', async t => {
  const d = deferred(), ui = await mount(t, d.promise)
  await ui.submit()
  await ui.unmount()
  await act(async () => d.resolve(accepted))
  assert.equal(document.body.textContent, '')
})
