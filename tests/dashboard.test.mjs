import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as icons from 'lucide-react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'

const base = { react: React, 'react/jsx-runtime': jsx }
const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const dashboard = loadTs(new URL('../lib/dashboard.ts', import.meta.url), { './load-data': loads })
const hook = loadTs(new URL('../app/hooks/useDataLoad.ts', import.meta.url), { ...base, '@/lib/load-data': loads })
const feedback = loadTs(new URL('../app/components/LoadFeedback.tsx', import.meta.url), base)
const { act, createElement: h } = React
const empty = () => ({ projetos: [], metricas: { obrasAtivas: 0, tarefasConcluidas: 0, tarefasPendentes: 0, custoTotal: 0 } })
const full = () => ({
  projetos: [1205, 1204, 1203, 1202].map(id => ({ id, titulo: `Obra ${id}`, criado_em: '2026-01-01T00:00:00Z' })),
  metricas: { obrasAtivas: 1205, tarefasConcluidas: 402, tarefasPendentes: 803, custoTotal: 120.5 },
})

test('aceita conta vazia confirmada e totais acima do limite REST sem exigir todas as linhas', () => {
  for (const data of [empty(), full()]) {
    assert.deepEqual(JSON.parse(JSON.stringify(dashboard.parseDashboardSummary(data))), data)
  }
})

for (const [name, mutate] of [
  ['resposta nula', () => null],
  ['array no lugar do objeto', () => []],
  ['métricas ausentes', d => ({ projetos: d.projetos })],
  ['contador nulo', d => { d.metricas.obrasAtivas = null; return d }],
  ['contador fracionado', d => { d.metricas.tarefasPendentes = 1.5; return d }],
  ['contador negativo', d => { d.metricas.tarefasConcluidas = -1; return d }],
  ['contador sem precisão segura', d => { d.metricas.obrasAtivas = 2 ** 53; return d }],
  ['custo infinito', d => { d.metricas.custoTotal = Infinity; return d }],
  ['custo NaN do PostgreSQL', d => { d.metricas.custoTotal = 'NaN'; return d }],
  ['lista truncada', d => { d.projetos.pop(); return d }],
  ['mais de quatro projetos', d => { d.projetos.push({ ...d.projetos[0], id: 1 }); return d }],
  ['IDs duplicados', d => { d.projetos[1].id = d.projetos[0].id; return d }],
  ['projeto sem título', d => { delete d.projetos[0].titulo; return d }],
  ['data inválida', d => { d.projetos[0].criado_em = 'inválida'; return d }],
]) {
  test(`recusa ${name} sem substituir por indicadores zerados`, () => {
    assert.throws(() => dashboard.parseDashboardSummary(mutate(full())), /confirmar o resumo/)
  })
}

async function mount(t, initial) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/home' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let response = initial
  const calls = []
  const { default: Home } = loadTs(new URL('../app/(sistema)/home/page.tsx', import.meta.url), {
    ...base, 'lucide-react': icons, 'next/link': { default: props => h('a', props) },
    '@/lib/dashboard': dashboard, '@/lib/load-data': loads,
    '@/app/hooks/useDataLoad': hook, '@/app/components/LoadFeedback': feedback,
    '@/lib/supabase': { supabase: {
      from() { throw new Error('Dashboard não deve baixar tabelas completas') },
      rpc(name) { return { abortSignal(signal) { calls.push({ name, signal }); return Promise.resolve(response) } } },
    } },
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
  await act(() => root.render(h(Home)))
  return { calls, unmount, setResponse(value) { response = value } }
}

test('dashboard publica totais completos e quatro links com uma única RPC', async t => {
  const ui = await mount(t, { data: full(), error: null })
  assert.equal(ui.calls.length, 1)
  assert.equal(ui.calls[0].name, 'resumo_dashboard')
  assert.equal(document.querySelectorAll('a[href^="/projetos/"]').length, 4)
  assert.match(document.body.textContent, /1205/)
  assert.match(document.body.textContent, /120,50/)
  assert.match(document.body.textContent, /Custo de Materiais/)
})

test('enquanto a RPC está pendente não exibe custo zero; desmontar aborta a leitura', async t => {
  let resolve
  const ui = await mount(t, new Promise(done => { resolve = done }))
  assert.match(document.body.textContent, /Carregando dados/)
  assert.doesNotMatch(document.body.textContent, /Custo de Materiais/)
  await ui.unmount()
  assert.equal(ui.calls[0].signal.aborted, true)
  await act(async () => { resolve({ data: full(), error: null }) })
  assert.equal(document.body.textContent, '')
})

test('função ausente ou sem permissão mostra erro e retry recupera sem fallback para tabelas', async t => {
  const ui = await mount(t, { data: null, error: { code: 'PGRST202', message: 'function not found' } })
  assert.ok(document.querySelector('[role="alert"]'))
  assert.equal(document.querySelector('table'), null)
  assert.equal(ui.calls.length, 1)
  ui.setResponse({ data: empty(), error: null })
  await act(() => document.querySelector('button').click())
  assert.equal(ui.calls.length, 2)
  assert.match(document.body.textContent, /Nenhum projeto encontrado/)
  assert.equal(document.querySelector('[role="alert"]'), null)
})

test('resposta parcial não publica tabela nem indicadores', async t => {
  await mount(t, { data: { projetos: full().projetos }, error: null })
  assert.ok(document.querySelector('[role="alert"]'))
  assert.equal(document.querySelector('table'), null)
})
