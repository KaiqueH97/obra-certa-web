import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as icons from 'lucide-react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'

const { act, createElement: h } = React
const tick = () => new Promise(resolve => setTimeout(resolve, 20))
const base = { react: React, 'react/jsx-runtime': jsx }
const mutation = loadTs(new URL('../lib/confirmed-mutation.ts', import.meta.url))
const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const money = loadTs(new URL('../lib/money.ts', import.meta.url))
const confirmation = loadTs(new URL('../app/components/DeleteConfirmation.tsx', import.meta.url), base)
const feedback = loadTs(new URL('../app/components/LoadFeedback.tsx', import.meta.url), base)
const { createSessionGuard } = loadTs(new URL('../lib/session-guard.ts', import.meta.url), { './load-data': loads })

const cases = [
  { name: 'equipe', file: '../app/(sistema)/equipe/page.tsx', table: 'funcionarios', label: 'Carlos', data: [
    { id: 7, nome: 'Carlos', cargo: 'Pedreiro', valor_diaria: 150 },
    { id: 8, nome: 'Maria', cargo: 'Pintora', valor_diaria: 150 },
  ] },
  { name: 'material', file: '../app/(sistema)/projetos/[id]/page.tsx', table: 'materiais_projeto', label: 'Cimento', data: {
    projeto: { titulo: 'Obra A' }, tarefas: [], transacoes: [], funcionarios: [],
    user: { user_metadata: {} }, materiais: [
      { id: 7, projeto_id: 42, nome: 'Cimento', quantidade: '2 sacos', preco_total: 100 },
      { id: 8, projeto_id: 42, nome: 'Areia', quantidade: '1 m³', preco_total: 100 },
    ],
  } },
]

async function mount(t, config) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/home', pretendToBeVisual: true })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const notices = []
  const requests = []
  const destinations = []
  let authEvent
  let response = { data: { id: 7 }, error: null }
  const toast = Object.assign(() => { throw new Error('Confirmação não pode usar toast global') }, {
    dismiss: () => { throw new Error('Não deve apagar notificações de outras ações') },
    loading: message => { notices.push(['loading', message]); return 'mutation' },
    success: message => notices.push(['success', message]),
    error: message => notices.push(['error', message]),
  })
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'A' } }, error: null }),
      onAuthStateChange: callback => { authEvent = callback; return { data: { subscription: { unsubscribe() {} } } } },
    },
    from(table) {
      const query = { table, filters: [] }
      const chain = {
        delete() { query.operation = 'delete'; return chain },
        eq(column, value) { query.filters.push([column, value]); return chain },
        select(columns) { query.columns = columns; return chain },
        single() { requests.push(query); return Promise.resolve(response) },
      }
      return chain
    },
  }
  const actions = loadTs(new URL('../app/hooks/useConfirmedMutation.ts', import.meta.url), {
    ...base, '@/lib/confirmed-mutation': mutation, 'react-hot-toast': { default: toast },
  })
  const { default: Page } = loadTs(new URL(config.file, import.meta.url), {
    ...base, 'react-hot-toast': { default: toast }, 'lucide-react': icons,
    'next/link': { default: props => h('a', props) },
    'next/navigation': { useParams: () => ({ id: '42' }) },
    '@/lib/supabase': { supabase }, '@/lib/load-data': loads, '@/lib/money': money,
    '@/lib/confirmed-mutation': mutation, '@/app/hooks/useConfirmedMutation': actions,
    '@/app/components/DeleteConfirmation': confirmation, '@/app/components/LoadFeedback': feedback,
    '@/app/hooks/useDataLoad': { useDataLoad: function useFakeDataLoad(load, apply) {
      React.useEffect(() => { apply(config.data) }, [apply])
      return { ready: true, loading: false, error: null, retry() {} }
    } },
  })
  const getPending = () => null
  const { PrivateSessionBoundary } = loadTs(new URL('../app/components/PrivateSessionBoundary.tsx', import.meta.url), {
    ...base, '@/lib/supabase': { supabase },
    '@/lib/session-guard': { createSessionGuard: deps => createSessionGuard({ ...deps, navigate: path => destinations.push(path) }) },
    './AuthActionsProvider': { useAuthActions: () => ({ getPending }) }, './LoadFeedback': feedback,
  })
  const root = createRoot(document.getElementById('root'))
  t.after(async () => {
    await act(() => root.unmount())
    dom.window.close()
    delete globalThis.window
    delete globalThis.document
    delete globalThis.IS_REACT_ACT_ENVIRONMENT
  })
  await act(() => root.render(h(PrivateSessionBoundary, null, h(Page))))
  await act(tick)
  const trigger = () => document.querySelector(`button[aria-label="Excluir ${config.label}"]`)
  const group = () => document.querySelector('[role="group"]')
  const cancel = () => group().querySelectorAll('button')[0]
  const confirm = () => group().querySelectorAll('button')[1]
  return {
    trigger, group, cancel, confirm, requests, notices, destinations,
    open: () => act(() => trigger().click()),
    setResponse: value => { response = value },
    leave: () => act(() => root.render(h(PrivateSessionBoundary, null, h('p', null, 'Outra página')))),
    signOut: () => act(() => authEvent('SIGNED_OUT', null)),
  }
}

for (const config of cases) {
  test(`${config.name}: abrir não exclui nem usa toast; cancelar/Escape devolve foco`, async t => {
    const ui = await mount(t, config)
    await ui.open()
    assert.equal(ui.requests.length, 0)
    assert.deepEqual(ui.notices, [])
    assert.equal(document.activeElement, ui.cancel())
    assert.match(document.getElementById(ui.group().getAttribute('aria-labelledby')).textContent, new RegExp(config.label))
    await act(() => ui.cancel().click())
    assert.equal(ui.group(), null)
    assert.equal(document.activeElement, ui.trigger())
    await ui.open()
    await act(() => ui.cancel().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert.equal(ui.group(), null)
    assert.equal(document.activeElement, ui.trigger())
  })

  test(`${config.name}: clique duplicado envia um DELETE e remove só após confirmação`, async t => {
    const ui = await mount(t, config)
    let resolve
    ui.setResponse(new Promise(done => { resolve = done }))
    await ui.open()
    await act(() => { ui.confirm().click(); ui.confirm().click() })
    assert.equal(ui.requests.length, 1)
    assert.equal(ui.requests[0].table, config.table)
    assert.equal(ui.requests[0].operation, 'delete')
    assert.deepEqual(ui.requests[0].filters, config.name === 'material' ? [['id', 7], ['projeto_id', '42']] : [['id', 7]])
    assert.ok(ui.trigger())
    assert.equal(ui.cancel().disabled, true)
    assert.equal(ui.confirm().disabled, true)
    await act(() => ui.group().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert.ok(ui.group())
    await act(async () => { resolve({ data: { id: 7 }, error: null }); await tick() })
    assert.equal(ui.group(), null)
    assert.equal(ui.trigger(), null)
    assert.ok(document.querySelector('button[aria-label^="Excluir "]'))
    assert.deepEqual(ui.notices.map(item => item[0]), ['loading', 'success'])
  })

  test(`${config.name}: erro mantém registro e confirmação disponível para cancelar`, async t => {
    const ui = await mount(t, config)
    ui.setResponse({ data: null, error: { code: '42501', message: 'denied' } })
    await ui.open()
    await act(async () => { ui.confirm().click(); await tick() })
    assert.ok(ui.trigger())
    assert.ok(ui.group())
    assert.equal(ui.confirm().disabled, false)
    assert.deepEqual(ui.notices.map(item => item[0]), ['loading', 'error'])
    await act(() => ui.cancel().click())
    assert.equal(ui.requests.length, 1)
  })

  test(`${config.name}: navegar remove confirmação sem executar a exclusão`, async t => {
    const ui = await mount(t, config)
    await ui.open()
    await ui.leave()
    assert.equal(ui.group(), null)
    assert.equal(ui.requests.length, 0)
    assert.deepEqual(ui.notices, [])
  })

  test(`${config.name}: suspensão oculta confirmação e logout a desmonta`, async t => {
    const ui = await mount(t, config)
    await ui.open()
    await act(() => window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true })))
    assert.ok(ui.group().closest('[hidden]'))
    await ui.signOut()
    assert.equal(ui.group(), null)
    assert.equal(ui.requests.length, 0)
    await act(tick)
    assert.deepEqual(ui.destinations, ['/login'])
  })
}
