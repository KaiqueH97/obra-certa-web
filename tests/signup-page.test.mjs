import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'

const { act, createElement: h } = React
const { createSignup } = loadTs(new URL('../lib/signup.ts', import.meta.url))
const accepted = { data: { user: { id: 'A' }, session: null }, error: null }

async function mount(t, initial = accepted) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/cadastro' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = await import('react-dom/client')
  let response = initial
  const requests = [], destinations = []
  const { default: Page } = loadTs(new URL('../app/cadastro/page.tsx', import.meta.url), {
    react: React, 'react/jsx-runtime': jsx, 'next/link': { default: props => h('a', props) },
    '../../lib/supabase': { supabase: { auth: { signUp: input => { requests.push(input); return Promise.resolve(response) } } } },
    '@/lib/signup': { createSignup: deps => createSignup({ ...deps, navigate: path => destinations.push(path) }) },
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
  const fill = async (id, value) => act(() => {
    const node = document.getElementById(id)
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(node, value)
    node.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await fill('cadastro-nome', 'Carlos')
  await fill('cadastro-email', 'carlos@example.com')
  await fill('cadastro-senha', 'Senha123!')
  const submit = () => act(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  return { requests, destinations, submit, unmount, setResponse: value => { response = value } }
}

test('página sem sessão mostra mensagem neutra e links corretos com foco no aviso', async t => {
  const ui = await mount(t)
  await ui.submit()
  assert.equal(ui.requests.length, 1)
  assert.equal(ui.requests[0].options.data.nome, 'Carlos')
  assert.equal(document.querySelector('form'), null)
  assert.match(document.body.textContent, /Se o cadastro puder ser concluído/)
  assert.equal(document.activeElement, document.querySelector('[role="status"]'))
  assert.ok(document.querySelector('a[href="/login"]'))
  assert.ok(document.querySelector('a[href="/recuperar"]'))
  assert.deepEqual(ui.destinations, [])
})

test('envio desabilita os campos; rejeição libera correção preservando os valores', async t => {
  let resolve
  const ui = await mount(t, new Promise(done => { resolve = done }))
  await ui.submit()
  assert.equal([...document.querySelectorAll('input')].every(node => node.disabled), true)
  await ui.submit()
  assert.equal(ui.requests.length, 1)
  await act(async () => { resolve({ data: null, error: { code: 'weak_password', status: 422 } }) })
  assert.ok(document.querySelector('[role="alert"]'))
  assert.equal(document.getElementById('cadastro-senha').value, 'Senha123!')
  assert.equal(document.getElementById('cadastro-email').value, 'carlos@example.com')
  assert.equal(document.querySelector('button').disabled, false)
  ui.setResponse(accepted)
  await ui.submit()
  assert.equal(ui.requests.length, 2)
  assert.equal(document.querySelector('form'), null)
})

test('sessão correspondente navega a home sem timer e sem redirecionar à landing page', async t => {
  const ui = await mount(t, { data: { user: { id: 'A' }, session: { access_token: 'token-teste', user: { id: 'A' } } }, error: null })
  await ui.submit()
  assert.deepEqual(ui.destinations, ['/home'])
  assert.equal(document.querySelector('button').disabled, true)
  assert.equal(document.getElementById('cadastro-senha').value, '')
})

test('falha inconclusiva oferece saída do fluxo e não um botão para repetir cadastro', async t => {
  const ui = await mount(t, { data: null, error: { status: 503 } })
  await ui.submit()
  assert.match(document.querySelector('[role="alert"]').textContent, /confirmar o resultado/)
  assert.equal(document.querySelector('form'), null)
  assert.ok(document.querySelector('a[href="/login"]'))
  assert.deepEqual(ui.destinations, [])
})

test('sair da página durante cadastro não provoca redirecionamento após a resposta', async t => {
  let resolve
  const ui = await mount(t, new Promise(done => { resolve = done }))
  await ui.submit()
  await ui.unmount()
  await act(async () => { resolve({ data: { user: { id: 'A' }, session: { access_token: 'token', user: { id: 'A' } } }, error: null }) })
  assert.deepEqual(ui.destinations, [])
  assert.equal(document.body.textContent, '')
})
