import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'
const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const profile = loadTs(new URL('../lib/profile.ts', import.meta.url), { './load-data': loads })
const reactDeps = { react: React, 'react/jsx-runtime': jsx }
const hooks = loadTs(new URL('../app/hooks/useDataLoad.ts', import.meta.url), { ...reactDeps, '@/lib/load-data': loads })
const feedback = loadTs(new URL('../app/components/LoadFeedback.tsx', import.meta.url), reactDeps)
const { act, createElement: h } = React
const response = (metadata = { nome: 'Ana', telefone: '11999999999' }) => ({ data: { user: { id: 'A', email: 'ana@example.com', user_metadata: metadata } }, error: null })
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function button(text) { return [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text) }
async function mount(t, overrides = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/perfil' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = await import('react-dom/client')
  const requests = [], destinations = []
  const auth = {
    getUser: async () => response(),
    updateUser: async ({ data }) => { requests.push(data); return response(data) },
    ...overrides,
  }
  const authActions = { pending: null, getPending: () => null, logout: () => {} }
  const icons = Object.fromEntries(['User', 'Phone', 'Mail', 'LogOut', 'Shield', 'Save', 'X', 'HardHat', 'Key'].map(name => [name, () => h('svg', { 'aria-hidden': true })]))
  const { default: Page } = loadTs(new URL('../app/(sistema)/perfil/page.tsx', import.meta.url), {
    ...reactDeps,
    'next/navigation': { useRouter: () => ({ push: path => destinations.push(path) }) },
    'lucide-react': icons,
    '@/lib/supabase': { supabase: { auth } },
    '@/app/components/AuthActionsProvider': { useAuthActions: () => authActions },
    '@/app/hooks/useDataLoad': hooks,
    '@/app/components/LoadFeedback': feedback,
    '@/lib/profile': profile,
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
  await act(() => root.render(h(React.StrictMode, null, h(Page))))
  return {
    auth, requests, destinations, unmount,
    click: text => act(() => button(text).click()),
    fill: (name = 'Maria Silva', phone = '') => act(() => {
      for (const [id, value] of [['perfil-nome', name], ['perfil-telefone', phone]]) {
        const node = document.getElementById(id)
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(node, value)
        node.dispatchEvent(new window.Event('input', { bubbles: true }))
      }
    }),
    submit: () => act(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))),
  }
}

test('espera perfil antes de permitir edição e recupera carregamento com erro', async t => {
  const d = deferred(), ui = await mount(t, { getUser: () => d.promise })
  assert.ok(document.querySelector('[role="status"]'))
  assert.equal(button('Editar Dados'), undefined)
  await act(() => d.resolve({ data: { user: null }, error: null }))
  assert.ok(document.querySelector('[role="alert"]'))
  ui.auth.getUser = async () => response()
  await ui.click('Tentar novamente')
  assert.ok(button('Editar Dados'))
  assert.match(document.body.textContent, /ana@example.com/)
})

test('cancelar restaura dados confirmados; inputs têm rótulos e autocomplete', async t => {
  const ui = await mount(t)
  await ui.click('Editar Dados')
  assert.ok(document.querySelector('label[for="perfil-nome"]'))
  assert.ok(document.querySelector('label[for="perfil-telefone"]'))
  assert.equal(document.getElementById('perfil-nome').autocomplete, 'name')
  await ui.fill()
  await ui.click('Cancelar')
  await ui.click('Editar Dados')
  assert.equal(document.getElementById('perfil-nome').value, 'Ana')
  assert.equal(document.getElementById('perfil-telefone').value, '11999999999')
  assert.equal(ui.requests.length, 0)
})

test('envio bloqueia duplicatas e ações; confirmação atualiza perfil, limpa telefone e foca sucesso', async t => {
  const d = deferred(), calls = []
  const ui = await mount(t, { updateUser: ({ data }) => { calls.push(data); return d.promise } })
  await ui.click('Editar Dados')
  await ui.fill(' Maria Silva ', ' ')
  await ui.submit()
  await ui.submit()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].nome, 'Maria Silva')
  assert.equal(calls[0].telefone, '')
  assert.ok([...document.querySelectorAll('input')].every(node => node.disabled))
  assert.equal(button('Cancelar').disabled, true)
  assert.equal(button('Sair do Sistema').disabled, true)
  await act(() => d.resolve(response(calls[0])))
  assert.equal(document.querySelector('form'), null)
  assert.match(document.querySelector('h2').textContent, /Maria Silva/)
  assert.match(document.body.textContent, /Não informado/)
  assert.equal(document.activeElement, document.querySelector('[role="status"]'))
  await ui.click('Editar Dados')
  assert.equal(document.getElementById('perfil-nome').value, 'Maria Silva')
  assert.equal(document.getElementById('perfil-telefone').value, '')
})

test('rejeição explícita preserva rascunho e libera tentativa manual', async t => {
  const ui = await mount(t, { updateUser: async () => ({ data: null, error: { status: 422 } }) })
  await ui.click('Editar Dados')
  await ui.fill()
  await ui.submit()
  assert.equal(document.getElementById('perfil-nome').value, 'Maria Silva')
  assert.equal(button('Salvar').disabled, false)
  assert.ok(document.querySelector('[role="alert"]'))
  ui.auth.updateUser = async ({ data }) => response(data)
  await ui.submit()
  assert.match(document.body.textContent, /Dados atualizados com sucesso/)
})

test('resultado incerto mantém últimos dados confirmados e exige recarregar', async t => {
  const ui = await mount(t, { updateUser: async () => ({ data: null, error: null }) })
  await ui.click('Editar Dados')
  await ui.fill()
  await ui.submit()
  assert.equal(document.querySelector('h2').textContent, 'Ana')
  assert.equal(document.querySelector('form'), null)
  assert.equal(button('Editar Dados').disabled, true)
  assert.ok(document.querySelector('a[href="/perfil"]'))
  assert.equal(document.activeElement, document.querySelector('[role="alert"]'))
  assert.doesNotMatch(document.body.textContent, /Dados atualizados com sucesso/)
})

test('metadados inválidos não quebram a página e continuam editáveis', async t => {
  const ui = await mount(t, { getUser: async () => response({ nome: { bad: true }, telefone: 12 }) })
  assert.equal(document.querySelector('h2').textContent, 'Usuário')
  await ui.click('Editar Dados')
  await ui.fill()
  await ui.submit()
  assert.match(document.body.textContent, /Dados atualizados com sucesso/)
})

test('sair durante envio ignora o retorno e não navega nem deixa feedback global', async t => {
  const d = deferred(), ui = await mount(t, { updateUser: () => d.promise })
  await ui.click('Editar Dados')
  await ui.fill()
  await ui.submit()
  await ui.unmount()
  await act(() => d.resolve(response({ nome: 'Maria Silva', telefone: '' })))
  assert.equal(document.body.textContent, '')
  assert.equal(ui.destinations.length, 0)
})
