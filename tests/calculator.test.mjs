import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as icons from 'lucide-react'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'

const { act, createElement: h } = React
const base = { react: React, 'react/jsx-runtime': jsx }
const money = loadTs(new URL('../lib/money.ts', import.meta.url))
const calculation = loadTs(new URL('../lib/material-calculation.ts', import.meta.url), { './money': money })
const mutations = loadTs(new URL('../lib/confirmed-mutation.ts', import.meta.url))

async function mount(t, landing = false) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/calcular' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = await import('react-dom/client')
  const notices = []
  const writes = []
  const toast = { error: text => notices.push(text), success() {}, loading: () => 'saving' }
  const actions = loadTs(new URL('../app/hooks/useConfirmedMutation.ts', import.meta.url), { ...base, 'react-hot-toast': { default: toast }, '@/lib/confirmed-mutation': mutations })
  const { default: Page } = loadTs(new URL(landing ? '../app/page.tsx' : '../app/(sistema)/calcular/page.tsx', import.meta.url), {
    ...base, 'lucide-react': icons, 'react-hot-toast': { default: toast },
    'next/link': { default: props => h('a', props) },
    '@/lib/material-calculation': calculation,
    '@/lib/load-data': {},
    '@/app/components/LoadFeedback': {},
    '@/app/hooks/useConfirmedMutation': actions,
    '@/app/hooks/useDataLoad': { useDataLoad: function useFixture(load, apply) {
      React.useEffect(() => { apply([{ id: 42, titulo: 'Obra A' }]) }, [apply])
      return { ready: true }
    } },
    '@/lib/supabase': { supabase: { from: table => ({ insert: rows => {
      writes.push({ table, rows })
      return { select: () => ({ single: async () => ({ data: { id: 1 }, error: null }) }) }
    } }) } },
  })
  const root = createRoot(document.getElementById('root'))
  t.after(async () => {
    await act(() => root.unmount())
    dom.window.close()
    delete globalThis.window
    delete globalThis.document
    delete globalThis.IS_REACT_ACT_ENVIRONMENT
  })
  await act(() => root.render(h(Page)))
  const fill = async (id, value) => {
    const node = document.getElementById(id)
    const prototype = node.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
    await act(() => {
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value)
      node.dispatchEvent(new window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    })
  }
  const submit = () => act(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  const prepare = async () => {
    await fill('superficie', 'piso'); await fill('material', 'Porcelanato')
    await fill('altura-1', '3'); await fill('largura-1', '4')
  }
  return { notices, writes, fill, submit, prepare }
}

test('calculadora bloqueia texto parcial e dimensões inválidas antes de oferecer salvar', async t => {
  const ui = await mount(t)
  await ui.prepare()
  await ui.fill('altura-1', '3abc')
  await ui.submit()
  assert.match(ui.notices.at(-1), /Área 1/)
  assert.equal(document.getElementById('projeto-calculo'), null)
  await ui.fill('altura-1', '3')
  await ui.fill('comprimento-peca', '0'); await ui.fill('largura-peca', '60')
  await ui.submit()
  assert.match(ui.notices.at(-1), /duas dimensões/)
  assert.equal(document.getElementById('projeto-calculo'), null)
  assert.equal(ui.writes.length, 0)
})

test('resultado com vírgula é salvo com quantidade e custo confirmados; editar invalida resultado', async t => {
  const ui = await mount(t)
  await ui.prepare()
  await ui.fill('comprimento-peca', '60,5'); await ui.fill('largura-peca', '60.5'); await ui.fill('preco-metro', '10')
  await ui.submit()
  assert.match(document.body.textContent, /37 unidades/)
  await ui.fill('altura-1', '3,5')
  assert.equal(document.getElementById('projeto-calculo'), null)
  await ui.fill('altura-1', '3'); await ui.submit(); await ui.fill('projeto-calculo', '42')
  await act(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Salvar Material na Obra')).click())
  assert.equal(ui.writes.length, 1)
  const record = ui.writes[0].rows[0]
  assert.equal(record.quantidade, '13,20 m² (já c/ 10% de quebra) (~37 peças)')
  assert.equal(record.preco_total, 132)
  assert.equal(record.projeto_id, 42)
  assert.equal(document.getElementById('projeto-calculo'), null)
})

test('inclusões rápidas preservam as duas áreas e produzem IDs únicos', async t => {
  await mount(t)
  const button = [...document.querySelectorAll('button')].find(button => button.textContent.includes('Nova Área'))
  await act(() => { button.click(); button.click() })
  const inputs = [...document.querySelectorAll('input[id^="altura-"]')]
  assert.equal(inputs.length, 3)
  assert.equal(new Set(inputs.map(input => input.id)).size, 3)
  await act(() => document.querySelector('[aria-label="Remover área 2"]').click())
  assert.equal(document.getElementById('altura-2'), null)
  assert.ok(document.getElementById('altura-3'))
})

test('simulação pública aceita vírgula e não mostra quantidades calculadas sobre negativas', async t => {
  const ui = await mount(t, true)
  await ui.fill('simulacao-largura', '4,5'); await ui.fill('simulacao-altura', '3')
  assert.match(document.body.textContent, /13,50 m²/)
  assert.match(document.body.textContent, /338 un\./)
  await ui.fill('simulacao-largura', '-4'); await ui.fill('simulacao-altura', '-3')
  assert.match(document.body.textContent, /— m²/)
  assert.match(document.querySelector('[role="status"]').textContent, /maiores que zero/)
})
