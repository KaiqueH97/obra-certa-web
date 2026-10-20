import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as icons from 'lucide-react'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'
import { createI18nDependencies } from './helpers/i18n.mjs'

const { act, createElement: h } = React
const user = { id: 'A', email: 'worker@example.com' }
const acceptedSignup = { data: { user, session: null }, error: null }
const acceptedRecovery = { data: {}, error: null }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function mount(t, route, initial, locale = 'en') {
  const dom = new JSDOM('<div id="root"></div>', { url: `https://app.example/${route}` })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.setItem('obra-certa:locale', locale)
  const { createRoot } = await import('react-dom/client')
  const deps = createI18nDependencies()
  const calls = [], notices = []
  let response = initial, initializations = 0
  const send = (...args) => { calls.push(args); return Promise.resolve(response) }
  const auth = {
    signUp: send, resetPasswordForEmail: send, updateUser: send,
    initialize: async () => { initializations++; return { error: null } },
    getUser: async () => ({ data: { user }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  }
  const money = loadTs(new URL('../lib/money.ts', import.meta.url))
  const { default: Page } = loadTs(new URL(route ? `../app/${route}/page.tsx` : '../app/page.tsx', import.meta.url), {
    ...deps, react: React, 'react/jsx-runtime': jsx, 'lucide-react': icons,
    'next/link': { default: props => h('a', props) },
    'react-hot-toast': { default: message => notices.push(message) },
    '../../lib/supabase': { supabase: { auth } }, '@/lib/supabase': { supabase: { auth } },
    '@/lib/signup': loadTs(new URL('../lib/signup.ts', import.meta.url)),
    '@/lib/password-recovery': loadTs(new URL('../lib/password-recovery.ts', import.meta.url)),
    '@/lib/password-reset': loadTs(new URL('../lib/password-reset.ts', import.meta.url)),
    '@/lib/material-calculation': loadTs(new URL('../lib/material-calculation.ts', import.meta.url), { './money': money }),
  })
  const root = createRoot(document.getElementById('root'))
  t.after(async () => {
    await act(() => root.unmount()); dom.window.close()
    delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT
  })
  await act(() => root.render(h(Page)))
  return {
    calls, notices, initializations: () => initializations, setResponse: value => { response = value },
    fill: (id, value) => act(() => {
      const input = document.getElementById(id)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
    }),
    select: value => act(() => {
      const select = document.querySelector('select'); select.value = value
      select.dispatchEvent(new window.Event('change', { bubbles: true }))
    }),
    submit: () => act(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))),
  }
}

test('página pública traduz textos, aviso e números preservando medidas e resultado', async t => {
  const ui = await mount(t, '')
  assert.equal(document.querySelector('main').lang, 'en')
  assert.match(document.querySelector('h1').textContent, /Smart management/)
  await ui.fill('simulacao-largura', '4,5')
  await ui.fill('simulacao-altura', '3.0')
  assert.match(document.body.textContent, /13\.50 m²/)
  assert.match(document.body.textContent, /338 units/)
  await act(() => document.querySelector('button').click())
  assert.equal(ui.notices[0].props.lang, 'en')
  assert.match(ui.notices[0].props.children, /Create a free account/)
  await ui.select('pt-BR')
  assert.equal(document.getElementById('simulacao-largura').value, '4,5')
  assert.match(document.body.textContent, /13,50 m²/)
  assert.match(document.body.textContent, /338 un\./)
  await ui.fill('simulacao-altura', '-3')
  await ui.select('en')
  assert.match(document.querySelector('[role="status"]').textContent, /Area 1: enter height and width/)
  assert.equal(document.querySelector('[role="status"]').lang, 'en')
})

test('cadastro troca idioma durante envio sem perder campos ou reenviar e mantém confirmação neutra', async t => {
  const d = deferred(), ui = await mount(t, 'cadastro', d.promise, 'pt-BR')
  await ui.fill('cadastro-nome', 'João')
  await ui.fill('cadastro-email', user.email)
  await ui.fill('cadastro-senha', 'Password123')
  await ui.submit()
  await ui.select('en')
  assert.equal(document.getElementById('cadastro-nome').value, 'João')
  assert.equal(document.getElementById('cadastro-senha').value, 'Password123')
  assert.match(document.querySelector('[role="status"]').textContent, /Creating your account/)
  assert.equal(ui.calls.length, 1)
  await act(() => d.resolve(acceptedSignup))
  assert.equal(ui.calls[0][0].options.data.nome, 'João')
  assert.match(document.querySelector('[role="status"]').textContent, /If registration can be completed/)
  assert.equal(document.activeElement, document.querySelector('[role="status"]'))
  assert.equal(document.querySelector('form'), null)
})

test('cadastro traduz senha fraca e resultado incerto sem oferecer reenvio', async t => {
  const ui = await mount(t, 'cadastro', { data: null, error: { status: 422, code: 'weak_password' } })
  await ui.fill('cadastro-nome', 'João')
  await ui.fill('cadastro-email', user.email)
  await ui.fill('cadastro-senha', 'Password123')
  await ui.submit()
  assert.match(document.querySelector('[role="alert"]').textContent, /Choose a stronger password/)
  ui.setResponse({ data: null, error: { status: 500 } })
  await ui.submit()
  assert.equal(document.querySelector('form'), null)
  assert.match(document.querySelector('[role="alert"]').textContent, /before submitting another registration/)
  await ui.select('pt-BR')
  assert.match(document.querySelector('[role="alert"]').textContent, /antes de enviar outro cadastro/)
  assert.equal(ui.calls.length, 2)
})

test('recuperação traduz solicitação e confirmação sem mudar callback ou repetir pedido', async t => {
  const d = deferred(), ui = await mount(t, 'recuperar', d.promise)
  await ui.fill('recuperar-email', user.email)
  await ui.submit()
  assert.match(document.querySelector('[role="status"]').textContent, /Requesting a recovery link/)
  assert.equal(ui.calls[0][1].redirectTo, 'https://app.example/redefinir-senha')
  await ui.select('pt-BR')
  assert.equal(document.getElementById('recuperar-email').value, user.email)
  assert.equal(ui.calls.length, 1)
  await act(() => d.resolve(acceptedRecovery))
  await ui.select('en')
  assert.match(document.querySelector('[role="status"]').textContent, /If there is an eligible account/)
  assert.equal(document.querySelector('form'), null)
})

test('recuperação traduz limite de tentativas e falha inconclusiva', async t => {
  const ui = await mount(t, 'recuperar', { data: null, error: { status: 429 } })
  await ui.fill('recuperar-email', user.email)
  await ui.submit()
  assert.match(document.querySelector('[role="alert"]').textContent, /Too many requests/)
  ui.setResponse({ data: null, error: { status: 500 } })
  await ui.submit()
  assert.match(document.querySelector('[role="alert"]').textContent, /before requesting another link/)
  assert.equal(document.querySelector('form'), null)
})

test('redefinição preserva senhas e sessão na troca de idioma e traduz confirmação/sucesso', async t => {
  const ui = await mount(t, 'redefinir-senha', { data: { user }, error: null })
  await ui.fill('nova-senha', 'Password123')
  await ui.fill('confirmar-senha', 'Different123')
  await ui.submit()
  assert.match(document.querySelector('[role="alert"]').textContent, /passwords do not match/)
  await ui.select('pt-BR')
  assert.equal(document.getElementById('nova-senha').value, 'Password123')
  assert.equal(ui.initializations(), 1)
  assert.equal(ui.calls.length, 0)
  await ui.fill('confirmar-senha', 'Password123')
  await ui.select('en')
  await ui.submit()
  assert.equal(ui.calls.length, 1)
  assert.equal(ui.calls[0][0].password, 'Password123')
  assert.equal(document.querySelector('form'), null)
  assert.match(document.querySelector('[role="status"]').textContent, /Password changed successfully/)
  assert.ok(document.querySelector('a[href="/home"]'))
})

test('todas as mensagens dos controladores públicos têm tradução inglesa', () => {
  const i18n = loadTs(new URL('../lib/i18n.ts', import.meta.url))
  for (const file of ['signup', 'password-recovery', 'password-reset']) {
    const source = ts.createSourceFile(file, readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
    let count = 0
    function visit(node) {
      if (ts.isStringLiteral(node) && node.text.includes(' ') && /[.!]$/.test(node.text)) {
        count++
        const result = i18n.translateAuthMessage('en', node.text)
        assert.equal(result.lang, 'en', `${file}: ${node.text}`)
        assert.notEqual(result.text, node.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    assert.ok(count > 0)
  }
})
