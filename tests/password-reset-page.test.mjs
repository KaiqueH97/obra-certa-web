import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'

const { createPasswordReset } = loadTs(new URL('../lib/password-reset.ts', import.meta.url))
const { act, createElement: h } = React
const user = { id: 'conta-a', email: 'a@example.com' }
const ok = { data: { user }, error: null }
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
async function mount(t, { url = 'https://app.example/redefinir-senha', authOverrides = {}, strict = false } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = await import('react-dom/client')
  const calls = [], listeners = new Set()
  const auth = {
    initialize: async () => ({ error: null }),
    getUser: async () => ok,
    updateUser: async input => { calls.push(input); return ok },
    onAuthStateChange: callback => {
      listeners.add(callback)
      return { data: { subscription: { unsubscribe() { listeners.delete(callback) } } } }
    },
    ...authOverrides,
  }
  const { default: Page } = loadTs(new URL('../app/redefinir-senha/page.tsx', import.meta.url), {
    react: React, 'react/jsx-runtime': jsx, 'next/link': { default: props => h('a', props) },
    '@/lib/password-reset': { createPasswordReset },
    '@/lib/supabase': { supabase: { auth } },
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
  await act(() => root.render(strict ? h(React.StrictMode, null, h(Page)) : h(Page)))
  return {
    calls, auth, listeners, unmount,
    fill: (password = 'senha-nova', confirmation = password) => act(() => {
      for (const [id, value] of [['nova-senha', password], ['confirmar-senha', confirmation]]) {
        const input = document.getElementById(id)
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new window.Event('input', { bubbles: true }))
      }
    }),
    submit: () => act(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))),
    emit: (event, session) => act(() => { for (const callback of listeners) callback(event, session) }),
  }
}

test('inicialização pendente oculta formulário; callback consumido libera conta verificada mesmo sem evento', async t => {
  const d = deferred()
  const ui = await mount(t, { url: 'https://app.example/redefinir-senha?code=exemplo', authOverrides: { initialize: () => d.promise } })
  assert.equal(document.querySelector('form'), null)
  assert.match(document.body.textContent, /Validando/)
  await act(() => {
    window.history.replaceState({}, '', '/redefinir-senha')
    d.resolve({ error: null })
  })
  assert.match(document.body.textContent, /a@example.com/)
  assert.ok(document.querySelector('label[for="nova-senha"]'))
  assert.equal(document.getElementById('nova-senha').autocomplete, 'new-password')
  await ui.fill()
  await ui.submit()
  assert.equal(ui.calls.length, 1)
  assert.equal(ui.calls[0].password, 'senha-nova')
  assert.equal(document.querySelector('form'), null)
  assert.match(document.body.textContent, /Senha alterada com sucesso/)
  assert.equal(document.activeElement, document.querySelector('[role="status"]'))
  assert.ok(document.querySelector('a[href="/home"]'))
  assert.equal(window.location.pathname, '/redefinir-senha')
})

for (const suffix of ['?code=sem-verifier', '#error=access_denied&error_code=otp_expired', '?error_description=expirado']) {
  test(`callback não consumido bloqueia outra sessão presente: ${suffix}`, async t => {
    const ui = await mount(t, { url: `https://app.example/redefinir-senha${suffix}` })
    assert.equal(document.querySelector('form'), null)
    assert.equal(ui.calls.length, 0)
    assert.doesNotMatch(document.body.textContent, /a@example.com/)
    assert.equal(document.activeElement, document.querySelector('[role="alert"]'))
    assert.ok(document.querySelector('a[href="/recuperar"]'))
  })
}

test('erro da inicialização impede uso da sessão anterior mesmo sem parâmetros na URL', async t => {
  await mount(t, { authOverrides: { initialize: async () => ({ error: { status: 400 } }) } })
  assert.equal(document.querySelector('form'), null)
  assert.ok(document.querySelector('[role="alert"]'))
})

test('valida confirmação e bloqueia campos e envios duplicados durante gravação', async t => {
  const d = deferred(), calls = []
  const ui = await mount(t, { authOverrides: { updateUser: input => { calls.push(input); return d.promise } } })
  await ui.fill('senha-nova', 'senha-outra')
  await ui.submit()
  assert.equal(calls.length, 0)
  assert.match(document.querySelector('[role="alert"]').textContent, /não coincidem/)
  await ui.fill()
  await ui.submit()
  await ui.submit()
  assert.equal(calls.length, 1)
  assert.equal(document.querySelector('button').disabled, true)
  assert.ok([...document.querySelectorAll('input')].every(input => input.disabled))
  await act(() => d.resolve({ data: null, error: { status: 422, code: 'weak_password' } }))
  assert.equal(document.querySelector('button').disabled, false)
  assert.equal(document.getElementById('nova-senha').value, 'senha-nova')
  assert.ok(document.querySelector('[role="alert"]'))
})

test('erro inconclusivo remove senhas e formulário, sem falso sucesso', async t => {
  const ui = await mount(t, { authOverrides: { updateUser: async () => { throw new Error('rede') } } })
  await ui.fill()
  await ui.submit()
  assert.equal(document.querySelector('input'), null)
  assert.match(document.querySelector('[role="alert"]').textContent, /pode ter sido processado/)
  assert.doesNotMatch(document.body.textContent, /sucesso/)
})

test('evento da mesma conta preserva senha; troca de conta remove formulário e assinatura é limpa', async t => {
  const ui = await mount(t, { strict: true })
  assert.equal(ui.listeners.size, 1)
  await ui.fill()
  await ui.emit('TOKEN_REFRESHED', { user })
  assert.equal(document.getElementById('nova-senha').value, 'senha-nova')
  await ui.emit('SIGNED_IN', { user: { id: 'conta-b' } })
  assert.equal(document.querySelector('form'), null)
  assert.match(document.body.textContent, /conta conectada mudou/)
  await ui.unmount()
  assert.equal(ui.listeners.size, 0)
})

test('logout durante envio não é sobrescrito pelo sucesso tardio', async t => {
  const d = deferred()
  const ui = await mount(t, { authOverrides: { updateUser: () => d.promise } })
  await ui.fill()
  await ui.submit()
  await ui.emit('SIGNED_OUT', null)
  assert.match(document.body.textContent, /sessão mudou durante o envio/)
  await act(() => d.resolve(ok))
  assert.doesNotMatch(document.body.textContent, /sucesso/)
  assert.equal(document.querySelector('form'), null)
})

test('navegar durante envio remove assinatura e ignora o resultado da página anterior', async t => {
  const d = deferred()
  const ui = await mount(t, { authOverrides: { updateUser: () => d.promise } })
  await ui.fill()
  await ui.submit()
  await ui.unmount()
  await act(() => d.resolve(ok))
  assert.equal(ui.listeners.size, 0)
  assert.equal(document.body.textContent, '')
})
