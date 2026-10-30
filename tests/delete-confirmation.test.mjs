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
const cashParser = loadTs(new URL('../lib/cash-page.ts', import.meta.url), { './load-data': loads })
const materialsParser = loadTs(new URL("../lib/materials-page.ts", import.meta.url), { "./load-data": loads })
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
  const cashReads = []
  const materialReads = [], quoteReads = []
  let materialOverride, quoteOverride
  let materialRecords = [...(config.data.materiais ?? [])]
  let cashOverride
  let cashRecords = [...(config.data.transacoes ?? [])]
  const destinations = []
  let authEvent
  let response = { data: { id: 7 }, error: null }
  let records = Array.isArray(config.data) ? [...config.data] : [...(config.data.funcionarios ?? [])]
  const toast = Object.assign(() => { throw new Error('Confirmação não pode usar toast global') }, {
    dismiss: id => { assert.equal(id, 'mutation', 'Deve dispensar somente o toast da gravação'); notices.push(['dismiss', id]) },
    loading: message => { notices.push(['loading', message]); return 'mutation' },
    success: message => notices.push(['success', message]),
    error: message => notices.push(['error', message]),
  })
  const supabase = {
    rpc(name, args) {
      if (name === 'pagina_materiais' || name === 'cotacao_materiais') return { abortSignal(signal) {
        const sorted = [...materialRecords].sort((a, b) => b.id - a.id)
        if (name === 'cotacao_materiais') {
          quoteReads.push({ ...args, signal })
          if (quoteOverride) return quoteOverride(args)
          return Promise.resolve({ error: null, data: { projeto_id: 42, total: sorted.length,
            materiais: sorted.map(({ id, nome, quantidade }) => ({ id, nome, quantidade })) } })
        }
        materialReads.push({ ...args, signal })
        if (materialOverride) return materialOverride(args)
        const pagina = Math.min(args.p_pagina, Math.max(0, Math.ceil(sorted.length / 20) - 1))
        return Promise.resolve({ error: null, data: { projeto_id: 42, total: sorted.length, pagina,
          custo: sorted.reduce((sum, m) => sum + (m.preco_total ?? 0), 0),
          materiais: sorted.slice(pagina * 20, pagina * 20 + 20) } })
      } }
      assert.equal(name, 'pagina_caixa')
      return { abortSignal(signal) {
        cashReads.push({ ...args, signal })
        if (cashOverride) return cashOverride(args)
        const pagina = Math.min(args.p_pagina, Math.max(0, Math.ceil(cashRecords.length / 20) - 1))
        const sorted = [...cashRecords].sort((a, b) => b.id - a.id)
        return Promise.resolve({ error: null, data: {
          projeto_id: 42, pagina, total: sorted.length,
          entradas: sorted.filter(t => t.tipo === 'RECEBIMENTO_CLIENTE').reduce((sum, t) => sum + t.valor, 0),
          pagamentos: sorted.filter(t => t.tipo === 'PAGAMENTO_FUNCIONARIO').reduce((sum, t) => sum + t.valor, 0),
          transacoes: sorted.slice(pagina * 20, pagina * 20 + 20).map(t => ({
            data: '2026-10-28', descricao: null, funcionario_id: null, funcionarios: null, ...t,
          })),
        } })
      } }
    },
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
        abortSignal() {
          const rows = table === 'tarefas' ? (config.data.tarefas ?? []) : records
          return Promise.resolve({ data: rows.slice(query.range[0], query.range[1] + 1), count: rows.length, error: null })
        },
        async single() {
          requests.push(query)
          const result = await response
          if (!result.error && result.data?.id && table === 'materiais_projeto') {
            if (query.operation === 'delete') materialRecords = materialRecords.filter(m => m.id !== result.data.id)
            if (query.operation === 'update') materialRecords = materialRecords.map(m => m.id === result.data.id ? { ...m, ...query.payload, ...result.data } : m)
          }
          if (!result.error && result.data?.id && table === 'financeiro_obra') {
            if (query.operation === 'delete') cashRecords = cashRecords.filter(t => t.id !== result.data.id)
            if (query.operation === 'insert') {
              const worker = records.find(w => w.id === result.data.funcionario_id)
              cashRecords = [{ ...result.data, funcionarios: worker ? { nome: worker.nome } : null }, ...cashRecords]
            }
          }
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
  const workerPicker = loadTs(new URL('../app/components/WorkerPicker.tsx', import.meta.url), {
    ...base, '@/lib/supabase': { supabase }, '@/lib/load-data': loads, '@/lib/pagination': pages,
    '@/app/hooks/useDataLoad': loadHooks, '@/app/components/LoadFeedback': feedback,
  })
  const tasks = loadTs(new URL('../app/components/ProjectTasks.tsx', import.meta.url), {
    ...base, 'lucide-react': icons, '@/lib/supabase': { supabase }, '@/lib/load-data': loads, '@/lib/pagination': pages,
    '@/app/hooks/useDataLoad': loadHooks, '@/app/hooks/useConfirmedMutation': actions,
    './LoadFeedback': feedback, './MutationGuard': guard,
  })
  const cashHook = loadTs(new URL('../app/hooks/useCashPage.ts', import.meta.url), {
    ...base, '@/lib/supabase': { supabase }, '@/lib/load-data': loads, '@/lib/cash-page': cashParser,
    './useDataLoad': loadHooks,
  })
  const materialsHook = loadTs(new URL('../app/hooks/useMaterialsPage.ts', import.meta.url), {
    ...base, '@/lib/supabase': { supabase }, '@/lib/load-data': loads, '@/lib/materials-page': materialsParser, './useDataLoad': loadHooks,
  })
  const quote = loadTs(new URL('../app/components/MaterialQuote.tsx', import.meta.url), {
    ...base, '@/lib/supabase': { supabase }, '@/lib/load-data': loads, '@/lib/materials-page': materialsParser,
  })
  const { default: Page } = loadTs(new URL(config.file, import.meta.url), {
    ...base, 'react-hot-toast': { default: toast }, 'lucide-react': icons,
    'next/link': { default: props => h('a', props) },
    'next/navigation': { useParams: () => ({ id: '42' }) },
    '@/lib/supabase': { supabase }, '@/lib/load-data': loads, '@/lib/money': money, '@/lib/pagination': pages,
    '@/lib/confirmed-mutation': mutation, '@/app/hooks/useConfirmedMutation': actions, '@/app/components/MutationGuard': guard,
    '@/app/hooks/useMaterialsPage': materialsHook, '@/lib/materials-page': materialsParser, '@/app/components/MaterialQuote': quote,
    '@/app/hooks/useCashPage': cashHook, '@/lib/cash-page': cashParser,
    '@/app/components/WorkerPicker': workerPicker, '@/app/components/ProjectTasks': tasks,
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
    trigger, group, cancel, confirm, requests, notices, destinations, reads, cashReads,
    materialReads, quoteReads,
    setMaterialRead: value => { materialOverride = value },
    setQuoteRead: value => { quoteOverride = value },
    setCashRead: value => { cashOverride = value },
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
  await act(() => ui.cancel().click())
  assert.equal(document.activeElement.getAttribute('aria-label'), 'Delete Cimento')
  assert.equal(ui.quoteReads.length, 0)
  await clickText('Prepare full quote')
  const link = document.querySelector('a[href^="https://wa.me/"]')
  const text = new URL(link.href).searchParams.get('text')
  assert.match(text, /Hello! This is Worker/)
  assert.match(text, /MATERIAL LIST/)
  assert.match(text, /\*Cimento:\* 2 sacos/)
  assert.equal(link.rel, 'noopener noreferrer')
  assert.equal(ui.requests.length, 0)
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

test('caixa: seleção preenche diária, exige profissional e preserva valor editado até confirmar', async t => {
  const ui = await mount(t, { ...cases[2], data: { ...cases[2].data,
    funcionarios: [{ id: 81, nome: 'Ana Teste', valor_diaria: 180.5 }],
  } })
  assert.equal(document.querySelector('#profissional-caixa'), null)
  const change = async (element, value) => act(() => {
    if (element.tagName === 'INPUT') Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
    else element.value = value
    element.dispatchEvent(new window.Event(element.tagName === 'INPUT' ? 'input' : 'change', { bubbles: true }))
  })
  await change(document.querySelector('[aria-label="Tipo de lançamento"]'), 'PAGAMENTO_FUNCIONARIO')
  const form = document.querySelector('#profissional-caixa').closest('form')
  const submit = () => act(() => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await change(document.querySelector('[aria-label="Descrição"]'), 'Pagamento semanal')
  await change(document.querySelector('[aria-label="Valor em reais"]'), '100')
  await submit()
  assert.equal(ui.requests.length, 0)
  await change(document.querySelector('#profissional-caixa'), '81')
  assert.equal(document.querySelector('[aria-label="Valor em reais"]').value, '180,5')
  await change(document.querySelector('[aria-label="Valor em reais"]'), '250,75')
  await act(() => base['@/lib/locale-store'].setLocale('en'))
  assert.equal(document.querySelector('[aria-label="Amount in BRL"]').value, '250,75')
  let resolve
  ui.setResponse(new Promise(done => { resolve = done }))
  await submit()
  assert.equal(ui.requests.length, 1)
  assert.equal(ui.requests[0].payload[0].funcionario_id, 81)
  assert.equal(ui.requests[0].payload[0].valor, 250.75)
  assert.ok(document.querySelector('#profissional-caixa').disabled)
  await act(() => resolve({ data: { id: 101, ...ui.requests[0].payload[0], data: '2026-10-24' }, error: null }))
  assert.equal(document.querySelector('#profissional-caixa'), null)
  assert.match(document.body.textContent, /Ana Teste/)
  assert.equal(document.querySelector('[aria-label="Description"]').value, '')
})

test('detalhes: falha nas tarefas fica local e não bloqueia caixa nem materiais', async t => {
  const ui = await mount(t, { ...cases[1], data: { ...cases[1].data,
    tarefas: [{ id: 2, nome: 'Resposta inválida', projeto_id: 999, concluida: false }],
  } })
  const section = document.querySelector('section[aria-label="Checklist da Obra"]')
  assert.ok(section.querySelector('[role="alert"]'))
  assert.ok(document.querySelector('[aria-label="Descrição"]'))
  assert.equal(document.querySelector('[aria-label="Descrição"]').disabled, false)
  assert.ok(ui.trigger())
  assert.equal(ui.trigger().disabled, false)
  assert.equal(document.querySelector('h1').textContent, 'Obra A')
})

test('caixa paginado: totais completos, 20 linhas, confirmação trava página e exclusão volta à página válida', async t => {
  const transactions = Array.from({ length: 21 }, (_, i) => ({
    id: i + 1, tipo: 'RECEBIMENTO_CLIENTE', valor: 10, descricao: 'Entrada ' + (i + 1), data: '2026-10-28',
  }))
  const ui = await mount(t, { ...cases[2], label: 'Entrada 1', data: { ...cases[2].data, transacoes: transactions } })
  const nav = () => document.querySelector('nav[aria-label="Paginação do caixa"]')
  const card = label => [...document.querySelectorAll('p')].find(p => p.textContent.trim() === label).parentElement.textContent
  assert.match(card('Entradas'), /210,00/)
  assert.equal(document.querySelectorAll('[aria-label^="Excluir Entrada"]').length, 20)
  await act(() => nav().querySelectorAll('button')[1].click())
  assert.equal(ui.cashReads.at(-1).p_pagina, 1)
  assert.match(card('Entradas'), /210,00/)
  assert.equal(document.querySelectorAll('[aria-label^="Excluir Entrada"]').length, 1)
  await ui.open()
  assert.ok(nav().querySelector('button').disabled)
  ui.setResponse({ data: { id: 1 }, error: null })
  await act(() => ui.confirm().click())
  assert.match(card('Entradas'), /200,00/)
  assert.ok(nav().querySelectorAll('button')[1].disabled)
  assert.equal(document.querySelectorAll('[aria-label^="Excluir Entrada"]').length, 20)
})

test('caixa paginado: falha após excluir não zera saldo nem repete DELETE no retry', async t => {
  const ui = await mount(t, cases[2])
  await ui.open()
  ui.setCashRead(() => Promise.resolve({ data: null, error: { message: 'offline' } }))
  await act(() => ui.confirm().click())
  assert.equal(ui.requests.length, 1)
  const card = [...document.querySelectorAll('p')].find(p => p.textContent.trim() === 'Entradas').parentElement
  assert.match(card.textContent, /Indisponível/)
  assert.ok(document.querySelector('[aria-label="Descrição"]').disabled)
  ui.setCashRead(undefined)
  await act(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Tentar novamente').click())
  assert.equal(ui.requests.length, 1)
  assert.match(card.textContent, /0,00/)
})

test('caixa paginado: criação na última página retorna ao início sem perder rascunho na troca de idioma', async t => {
  const transactions = Array.from({ length: 21 }, (_, i) => ({
    id: i + 1, tipo: 'RECEBIMENTO_CLIENTE', valor: 10, descricao: 'Entrada ' + (i + 1), data: '2026-10-28',
  }))
  const ui = await mount(t, { ...cases[2], data: { ...cases[2].data, transacoes: transactions } })
  await act(() => document.querySelector('nav[aria-label="Paginação do caixa"]').querySelectorAll('button')[1].click())
  const fill = (label, value) => act(() => {
    const input = document.querySelector(`[aria-label="${label}"]`)
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await fill('Descrição', 'Nova entrada')
  await fill('Valor em reais', '20,50')
  const reads = ui.cashReads.length
  await act(() => base['@/lib/locale-store'].setLocale('en'))
  assert.equal(ui.cashReads.length, reads)
  assert.equal(document.querySelector('[aria-label="Description"]').value, 'Nova entrada')
  ui.setResponse({ data: { id: 22, tipo: 'RECEBIMENTO_CLIENTE', valor: 20.5, descricao: 'Nova entrada' }, error: null })
  await act(() => document.querySelector('[aria-label="Description"]').closest('form')
    .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(ui.cashReads.at(-1).p_pagina, 0)
  assert.equal(ui.requests.length, 1)
  assert.equal(document.querySelector('[aria-label="Description"]').value, '')
  assert.match(document.body.textContent, /1–20 of 22 transactions/)
  assert.match(document.body.textContent, /230\.50/)
  assert.ok(document.querySelector('[aria-label="Delete Nova entrada"]'))
})

const materialFixtures = length => Array.from({ length }, (_, i) => ({
  id: i + 1, nome: 'Material ' + (i + 1), quantidade: '2 sacos', projeto_id: 42, preco_total: 10,
}))
const materialsNav = () => document.querySelector('nav[aria-label="Paginação dos materiais"]')
const materialCost = () => [...document.querySelectorAll('p')].find(p => p.textContent.trim() === 'Materiais').parentElement.textContent
const clickNamed = text => act(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text).click())

test('materiais: páginas limitadas, custo integral, cotação completa sob demanda e exclusão da última página', async t => {
  const ui = await mount(t, { ...cases[1], label: 'Material 1', data: { ...cases[1].data, materiais: materialFixtures(21) } })
  assert.equal(document.querySelectorAll('[aria-label^="Excluir Material"]').length, 20)
  assert.match(materialCost(), /210,00/)
  assert.equal(ui.quoteReads.length, 0)
  await act(() => materialsNav().querySelectorAll('button')[1].click())
  assert.equal(ui.materialReads.at(-1).p_pagina, 1)
  assert.match(materialCost(), /210,00/)
  await clickNamed('Preparar cotação completa')
  const text = new URL(document.querySelector('a[href^="https://wa.me/"]').href).searchParams.get('text')
  assert.match(text, /Material 21/)
  assert.match(text, /Material 1:/)
  assert.equal(document.querySelector('textarea').value, text)
  assert.equal(ui.quoteReads.length, 1)
  await ui.open()
  assert.ok(materialsNav().querySelector('button').disabled)
  ui.setResponse({ data: { id: 1 }, error: null })
  await act(() => ui.confirm().click())
  assert.match(materialCost(), /200,00/)
  assert.equal(document.querySelectorAll('[aria-label^="Excluir Material"]').length, 20)
  assert.ok(materialsNav().querySelector('button').disabled)
  assert.equal(document.querySelector('a[href^="https://wa.me/"]'), null, 'cotação invalidada depois de alteração')
})

test('materiais: preço confirmado relê custo, falha não vira zero e retry não repete UPDATE', async t => {
  const ui = await mount(t, cases[1])
  const input = document.querySelector('[aria-label="Custo Registrado: Cimento"]')
  assert.ok(input)
  await act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, '150,50')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  ui.setMaterialRead(() => Promise.resolve({ error: { message: 'offline' }, data: null }))
  ui.setResponse({ data: { ...cases[1].data.materiais[0], preco_total: 150.5 }, error: null })
  await act(() => input.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })))
  assert.equal(ui.requests.length, 1)
  assert.match(materialCost(), /Indisponível/)
  assert.ok(document.querySelector('[aria-label="Descrição"]'), 'caixa permanece disponível')
  ui.setMaterialRead(undefined)
  await clickNamed('Tentar novamente')
  assert.equal(ui.requests.length, 1)
  assert.match(materialCost(), /250,50/)
})

test('cotação: erro não oferece link parcial; troca de idioma não repete leitura', async t => {
  const ui = await mount(t, cases[1])
  ui.setQuoteRead(() => Promise.resolve({ data: { projeto_id: 42, total: 2, materiais: [] }, error: null }))
  await clickNamed('Preparar cotação completa')
  assert.equal(document.querySelector('a[href^="https://wa.me/"]'), null)
  assert.ok(document.querySelector('[role="alert"]'))
  ui.setQuoteRead(undefined)
  await clickNamed('Preparar cotação completa')
  const reads = ui.quoteReads.length
  await act(() => base['@/lib/locale-store'].setLocale('en'))
  assert.equal(ui.quoteReads.length, reads)
  assert.match(document.querySelector('textarea').value, /MATERIAL LIST/)
  assert.match(document.querySelector('textarea').value, /Cimento/)
})

test('cotação: sair durante leitura cancela pedido e não abre WhatsApp', async t => {
  const ui = await mount(t, cases[1])
  let resolve
  ui.setQuoteRead(() => new Promise(done => { resolve = done }))
  await clickNamed('Preparar cotação completa')
  const query = ui.quoteReads.at(-1)
  await ui.leave()
  assert.ok(query.signal.aborted)
  await act(() => resolve({ data: { projeto_id: 42, total: 0, materiais: [] }, error: null }))
  assert.equal(document.querySelector('a[href^="https://wa.me/"]'), null)
})

test('materiais: edição bloqueia paginação e outras linhas, salva e preserva página atual', async t => {
  const ui = await mount(t, { ...cases[1], data: { ...cases[1].data, materiais: materialFixtures(22) } })
  await act(() => materialsNav().querySelectorAll('button')[1].click())
  await act(() => document.querySelector('[aria-label="Editar Material 2"]').click())
  assert.ok(materialsNav().querySelector('button').disabled)
  assert.ok(document.querySelector('[aria-label="Editar Material 1"]').disabled)
  const input = document.querySelector('[aria-label="Nome"]')
  await act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Material revisado')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  ui.setResponse({ data: { ...materialFixtures(2)[1], nome: 'Material revisado' }, error: null })
  await act(() => document.querySelector('[aria-label="Salvar material"]').click())
  assert.equal(ui.materialReads.at(-1).p_pagina, 1)
  assert.ok(document.querySelector('[aria-label="Editar Material revisado"]'))
  assert.equal(ui.requests.length, 1)
  assert.deepEqual(ui.requests[0].filters, [['id', 2], ['projeto_id', '42']])
})
