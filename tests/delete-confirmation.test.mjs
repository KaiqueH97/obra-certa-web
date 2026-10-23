import { createI18nDependencies } from './helpers/i18n.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as icons from 'lucide-react'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'

const { act, createElement: h } = React
const tick = () => new Promise(resolve => setTimeout(resolve, 20))
const base = { react: React, 'react/jsx-runtime': jsx, ...createI18nDependencies() }
const mutation = loadTs(new URL('../lib/confirmed-mutation.ts', import.meta.url))
const guard = loadTs(new URL('../app/components/MutationGuard.tsx', import.meta.url), { ...base, '@/lib/confirmed-mutation': mutation })
const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const pages = loadTs(new URL('../lib/pagination.ts', import.meta.url), { './load-data': loads })
const loadHooks = loadTs(new URL('../app/hooks/useDataLoad.ts', import.meta.url), { ...base, '@/lib/load-data': loads })
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
  { name: 'lançamento', file: '../app/(sistema)/projetos/[id]/page.tsx', table: 'financeiro_obra', label: 'Sinal da obra', data: {
    projeto: { titulo: 'Obra A' }, tarefas: [], materiais: [], funcionarios: [], user: { user_metadata: {} },
    transacoes: [
      { id: 7, tipo: 'RECEBIMENTO_CLIENTE', valor: 1000, descricao: 'Sinal da obra', data: '2026-10-23' },
      { id: 8, tipo: 'PAGAMENTO_FUNCIONARIO', valor: 150, descricao: 'Diária de João', data: '2026-10-23' },
    ],
  } },
]

async function mount(t, config, timeoutMs = 20000) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/home', pretendToBeVisual: true })
  globalThis.window = dom.window
  base['@/lib/locale-store'].setLocale('pt-BR')
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = await import('react-dom/client')
  const reads = []
  const notices = []
  const requests = []
  const destinations = []
  let authEvent
  let response = { data: { id: 7 }, error: null }
  let records = Array.isArray(config.data) ? [...config.data] : []
  const toast = Object.assign(() => { throw new Error('Confirmação não pode usar toast global') }, {
    dismiss: id => { assert.equal(id, 'mutation', 'Deve dispensar somente o toast da gravação'); notices.push(['dismiss', id]) },
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
        insert(payload) { query.operation = 'insert'; query.payload = payload; return chain },
        update(payload) { query.operation = 'update'; query.payload = payload; return chain },
        eq(column, value) { query.filters.push([column, value]); return chain },
        select(columns) { query.columns = columns; return chain },
        order() { return chain },
        range(from, to) { query.range = [from, to]; return chain },
        abortSignal() { return Promise.resolve({ data: records.slice(query.range[0], query.range[1] + 1), count: records.length, error: null }) },
        async single() {
          requests.push(query)
          const result = await response
          if (!result.error && result.data?.id) records = records.filter(row => row.id !== result.data.id)
          return result
        },
      }
      return chain
    },
  }
  const actions = loadTs(new URL('../app/hooks/useConfirmedMutation.ts', import.meta.url), {
    ...base, '@/lib/confirmed-mutation': { ...mutation, createMutationRunner: (notices, onPending, onUnconfirmed) => mutation.createMutationRunner(notices, onPending, onUnconfirmed, timeoutMs) }, 'react-hot-toast': { default: toast },
  })
  const { default: Page } = loadTs(new URL(config.file, import.meta.url), {
    ...base, 'react-hot-toast': { default: toast }, 'lucide-react': icons,
    'next/link': { default: props => h('a', props) },
    'next/navigation': { useParams: () => ({ id: '42' }) },
    '@/lib/supabase': { supabase }, '@/lib/load-data': loads, '@/lib/money': money, '@/lib/pagination': pages,
    '@/lib/confirmed-mutation': mutation, '@/app/hooks/useConfirmedMutation': actions, '@/app/components/MutationGuard': guard,
    '@/app/components/DeleteConfirmation': confirmation, '@/app/components/LoadFeedback': feedback,
    '@/app/hooks/useDataLoad': config.name === 'equipe' ? loadHooks : { useDataLoad: function useFakeDataLoad(load, apply) {
      React.useEffect(() => { reads.push(config.data); apply(config.data) }, [apply])
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
    trigger, group, cancel, confirm, requests, notices, destinations, reads,
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
    assert.deepEqual(ui.requests[0].filters, config.name === 'equipe' ? [['id', 7]] : [['id', 7], ['projeto_id', '42']])
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

for (const config of cases) {
  for (const lateResponse of [{ data: { id: 7 }, error: null }, { data: null, error: { message: 'offline' } }]) {
    test(`${config.name}: navegar durante DELETE dispensa aviso e ignora ${lateResponse.error ? 'erro' : 'sucesso'} tardio`, async t => {
      const ui = await mount(t, config)
      let resolve
      ui.setResponse(new Promise(done => { resolve = done }))
      await ui.open()
      await act(() => ui.confirm().click())
      assert.equal(ui.requests.length, 1)
      await ui.leave()
      assert.deepEqual(ui.notices.map(item => item[0]), ['loading', 'dismiss'])
      await act(async () => { resolve(lateResponse); await tick() })
      assert.deepEqual(ui.notices.map(item => item[0]), ['loading', 'dismiss'])
      assert.match(document.body.textContent, /Outra página/)
    })
  }

  test(`${config.name}: logout desmonta gravação e sucesso tardio não reaparece no login`, async t => {
    const ui = await mount(t, config)
    let resolve
    ui.setResponse(new Promise(done => { resolve = done }))
    await ui.open()
    await act(() => ui.confirm().click())
    await ui.signOut()
    assert.equal(ui.group(), null)
    assert.deepEqual(ui.notices.map(item => item[0]), ['loading', 'dismiss'])
    await act(async () => { resolve({ data: { id: 7 }, error: null }); await tick() })
    assert.deepEqual(ui.destinations, ['/login'])
    assert.deepEqual(ui.notices.map(item => item[0]), ['loading', 'dismiss'])
  })
}

for (const config of cases) {
  test(`${config.name}: timeout bloqueia controles, mantém registro e oferece recarregar com foco`, async t => {
    const ui = await mount(t, config, 10)
    let resolve
    ui.setResponse(new Promise(done => { resolve = done }))
    await ui.open()
    await act(async () => { ui.confirm().click(); await new Promise(done => setTimeout(done, 30)) })
    assert.equal(ui.requests.length, 1)
    assert.ok(ui.trigger())
    assert.equal(ui.confirm().matches(':disabled'), true)
    const alert = document.querySelector('[role="alert"]')
    assert.match(alert.textContent, /pode ter sido concluída/)
    assert.equal(document.activeElement, alert)
    assert.equal(alert.querySelector('button').matches(':disabled'), false)
    assert.equal(alert.querySelector('button').textContent.trim(), 'Recarregar dados')
    assert.deepEqual(ui.notices.map(item => item[0]), ['loading', 'error'])
    await act(() => ui.confirm().dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
    assert.equal(ui.requests.length, 1)
    await act(async () => { resolve({ data: { id: 7 }, error: null }); await tick() })
    assert.ok(ui.trigger())
    assert.equal(ui.confirm().matches(':disabled'), true)
    assert.deepEqual(ui.notices.map(item => item[0]), ['loading', 'error'])
  })
}

test('detalhes: idioma preserva dados, aba, confirmação e texto cadastrado no WhatsApp', async t => {
  const config = { ...cases[1], data: { ...cases[1].data,
    tarefas: [{ id: 2, nome: 'Pintar cozinha', concluida: false, projeto_id: 42 }],
    transacoes: [{ id: 9, tipo: 'RECEBIMENTO_CLIENTE', valor: 1234.56, descricao: 'Sinal', data: '2026-10-21' }],
  } }
  const ui = await mount(t, config)
  const clickText = text => act(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text).click())
  await clickText('Caixa')
  await ui.open()
  const focused = document.activeElement, reads = ui.reads.length
  await act(() => base['@/lib/locale-store'].setLocale('en'))
  assert.equal(document.activeElement, focused)
  assert.equal(ui.reads.length, reads)
  assert.match(ui.group().textContent, /Delete Cimento\?/)
  assert.match(ui.group().textContent, /permanently removed/)
  assert.match(document.body.textContent, /R\$1,234\.56/)
  assert.match(document.body.textContent, /Pintar cozinha/)
  assert.equal(document.querySelector('h1').textContent, 'Obra A')
  const cash = [...document.querySelectorAll('h2')].find(h => h.textContent === 'Project cash flow')
  assert.ok(cash.closest('.space-y-6').classList.contains('block'))
  const opened = []
  window.open = (...args) => opened.push(args)
  await clickText('Send report (WhatsApp)')
  const text = new URL(opened[0][0]).searchParams.get('text')
  assert.match(text, /Hello! This is Worker/)
  assert.match(text, /MATERIAL LIST/)
  assert.match(text, /\*Cimento:\* 2 sacos/)
  assert.equal(opened[0][2], 'noopener,noreferrer')
  assert.equal(ui.requests.length, 0)
  await act(() => ui.cancel().click())
  assert.equal(document.activeElement.getAttribute('aria-label'), 'Delete Cimento')
})

test('detalhes: lançamento em inglês preserva descrição e BRL ao trocar durante envio', async t => {
  const ui = await mount(t, cases[1])
  await act(() => base['@/lib/locale-store'].setLocale('en'))
  const fill = async (label, value) => act(() => {
    const input = document.querySelector(`[aria-label="${label}"]`)
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await fill('Description', 'Sinal da obra')
  await fill('Amount in BRL', '150,50')
  let resolve
  ui.setResponse(new Promise(done => { resolve = done }))
  const form = document.querySelector('[aria-label="Description"]').closest('form')
  await act(() => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(ui.requests.length, 1)
  assert.equal(ui.requests[0].payload[0].valor, 150.5)
  assert.equal(ui.requests[0].payload[0].descricao, 'Sinal da obra')
  assert.equal(ui.requests[0].payload[0].tipo, 'RECEBIMENTO_CLIENTE')
  await act(() => base['@/lib/locale-store'].setLocale('pt-BR'))
  assert.equal(document.querySelector('[aria-label="Descrição"]').value, 'Sinal da obra')
  assert.ok(document.querySelector('[aria-label="Descrição"]').disabled)
  await act(() => resolve({ data: { id: 44, ...ui.requests[0].payload[0] }, error: null }))
  assert.equal(ui.requests.length, 1)
  assert.equal(ui.notices.findLast(n => n[0] === 'success')[1], 'Lançamento registrado!')
  assert.equal(document.querySelector('[aria-label="Descrição"]').value, '')
})

test('caixa: abrir não altera totais; remover recebimento só recalcula após confirmação', async t => {
  const ui = await mount(t, cases[2])
  const card = label => [...document.querySelectorAll('p')].find(p => p.textContent.trim() === label).parentElement.textContent
  const initial = card('Lucro Atual')
  await ui.open()
  assert.match(ui.group().textContent, /1\.000,00/)
  assert.match(ui.group().textContent, /diminuirá/)
  assert.equal(card('Lucro Atual'), initial)
  let resolve
  ui.setResponse(new Promise(done => { resolve = done }))
  await act(() => ui.confirm().click())
  assert.equal(card('Lucro Atual'), initial)
  assert.ok(document.querySelector('[aria-label="Excluir Diária de João"]').disabled)
  await act(() => resolve({ data: { id: 7 }, error: null }))
  assert.match(card('Entradas'), /0,00/)
  assert.match(card('Lucro Atual'), /-R\$\s*150,00/)
  assert.equal(document.activeElement.textContent, 'Caixa da Obra')
  assert.equal(ui.reads.length, 1)
})

test('caixa: pagamento explica impacto em inglês e trocar idioma preserva confirmação e foco', async t => {
  const ui = await mount(t, cases[2])
  await act(() => document.querySelector('[aria-label="Excluir Diária de João"]').click())
  const focus = document.activeElement
  assert.match(ui.group().textContent, /aumentará/)
  assert.match(ui.group().textContent, /não estorna/)
  assert.ok(ui.trigger().disabled)
  await act(() => base['@/lib/locale-store'].setLocale('en'))
  assert.equal(document.activeElement, focus)
  assert.match(ui.group().textContent, /R\$150\.00/)
  assert.match(ui.group().textContent, /increase by this amount/)
  assert.match(ui.group().textContent, /does not reverse the payment/)
  assert.match(ui.group().textContent, /Diária de João/)
  assert.equal(ui.requests.length, 0)
  await act(() => ui.cancel().click())
  assert.equal(document.activeElement.getAttribute('aria-label'), 'Delete Diária de João')
  assert.equal(ui.group(), null)
})
