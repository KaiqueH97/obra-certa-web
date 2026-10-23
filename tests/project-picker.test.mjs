import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'
import { createI18nDependencies } from './helpers/i18n.mjs'
const { act, createElement: h } = React
const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const pagination = loadTs(new URL('../lib/pagination.ts', import.meta.url), { './load-data': loads })
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text)
async function mount(t) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/calcular' })
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const base = { react: React, 'react/jsx-runtime': jsx, ...createI18nDependencies() }
  const hooks = loadTs(new URL('../app/hooks/useDataLoad.ts', import.meta.url), { ...base, '@/lib/load-data': loads })
  const feedback = loadTs(new URL('../app/components/LoadFeedback.tsx', import.meta.url), base)
  const reads = [], changes = []
  let override
  let rows = Array.from({ length: 45 }, (_, index) => ({ id: 45 - index, titulo: `Obra ${45 - index}` }))
  const { ProjectPicker } = loadTs(new URL('../app/components/ProjectPicker.tsx', import.meta.url), {
    ...base, '@/app/hooks/useDataLoad': hooks, '@/lib/pagination': pagination, '@/lib/load-data': loads,
    '@/app/components/LoadFeedback': feedback,
    '@/lib/supabase': { supabase: { from(table) {
      assert.equal(table, 'projetos')
      const q = { orders: [] }
      const chain = {
        select(columns, options) { q.columns = columns; q.count = options.count; return chain },
        ilike(column, pattern) { q.filter = [column, pattern]; return chain },
        order(column, options) { q.orders.push([column, options.ascending]); return chain },
        range(from, to) { q.range = [from, to]; return chain },
        abortSignal(signal) {
          q.signal = signal; reads.push(q)
          if (override) return override(q)
          const filtered = q.filter ? rows.filter(row => row.titulo.toLowerCase().includes(q.filter[1].slice(1, -1).toLowerCase())) : rows
          return Promise.resolve({ data: filtered.slice(q.range[0], q.range[1] + 1), count: filtered.length, error: null })
        },
      }; return chain
    } } },
  })
  let setDisabled
  function Harness() {
    const [selected, setSelected] = React.useState(null)
    const [disabled, updateDisabled] = React.useState(false)
    React.useEffect(() => { setDisabled = updateDisabled }, [updateDisabled])
    return h(React.Fragment, null,
      h('label', { htmlFor: 'picker' }, 'Obra'),
      h(ProjectPicker, { id: 'picker', selected, disabled, onSelect: project => { changes.push(project); setSelected(project) } }))
  }
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(document.querySelector('#root'))
  let mounted = true
  const unmount = async () => { if (mounted) { await act(() => root.unmount()); mounted = false } }
  t.after(async () => { await unmount(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT })
  await act(() => root.render(h(Harness)))
  return {
    reads, changes, unmount,
    override: value => { override = value }, records: value => { rows = value },
    click: text => act(() => button(text).click()),
    fill: value => act(() => { const input = document.querySelector('input'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })) }),
    search: () => act(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))),
    select: value => act(() => { const select = document.querySelector('select'); select.value = value; select.dispatchEvent(new window.Event('change', { bubbles: true })) }),
    locale: value => act(() => base['@/lib/locale-store'].setLocale(value)),
    disable: value => act(() => setDisabled(value)),
  }
}

test('seletor lê 20 obras por página; busca no servidor mantém seleção fora dos resultados', async t => {
  const ui = await mount(t)
  assert.equal(ui.reads.length, 1)
  assert.deepEqual(ui.reads[0].range, [0, 19])
  assert.equal(ui.reads[0].count, 'exact')
  assert.equal(ui.reads[0].columns, 'id, titulo')
  assert.deepEqual(ui.reads[0].orders, [['criado_em', false], ['id', false]])
  assert.equal(document.querySelectorAll('option').length, 21)
  await ui.select('45'); await ui.click('Próxima')
  assert.equal(document.querySelector('select').value, '45')
  assert.deepEqual(ui.reads[1].range, [20, 39])
  assert.equal(document.querySelectorAll('option').length, 22)
  await ui.fill('Obra 2')
  assert.equal(ui.reads.length, 2, 'Digitar não baixa páginas em sequência')
  await ui.search()
  assert.deepEqual(ui.reads.at(-1).filter, ['titulo', '%Obra 2%'])
  assert.deepEqual(ui.reads.at(-1).range, [0, 19])
  assert.equal(document.querySelector('select').value, '45')
  assert.match(document.body.textContent, /Obra selecionada: Obra 45/)
  await ui.fill('Inexistente'); await ui.search()
  assert.match(document.body.textContent, /Nenhuma obra encontrada/)
  assert.equal(document.querySelector('select').value, '45')
  await ui.select('')
  assert.equal(ui.changes.at(-1), null)
})

test('nova busca cancela anterior, oculta opções antigas e ignora resposta atrasada', async t => {
  const ui = await mount(t), old = deferred(), latest = deferred()
  ui.override(q => q.filter[1] === '%Antiga%' ? old.promise : latest.promise)
  await ui.fill('Antiga'); await ui.search()
  const pending = ui.reads.at(-1)
  assert.ok(document.querySelector('select').disabled)
  assert.equal(document.querySelectorAll('option').length, 1)
  await ui.fill('Nova'); await ui.search()
  assert.equal(pending.signal.aborted, true)
  await act(() => latest.resolve({ data: [{ id: 90, titulo: 'Nova' }], count: 1, error: null }))
  await act(() => old.resolve({ data: [{ id: 80, titulo: 'Antiga' }], count: 1, error: null }))
  assert.equal(document.querySelector('option[value="80"]'), null)
  assert.ok(document.querySelector('option[value="90"]'))
  await ui.fill('Pendente'); await ui.search()
  // Um novo pedido pendente é abortado ao sair da tela.
  const d = deferred(); ui.override(() => d.promise)
  await ui.fill('Sair'); await ui.search()
  const leaving = ui.reads.at(-1)
  await ui.unmount()
  assert.equal(leaving.signal.aborted, true)
  await act(() => d.resolve({ data: [], count: 0, error: null }))
})

test('falha e resposta parcial exigem retry sem apagar escolha; idioma não refaz consulta', async t => {
  const ui = await mount(t)
  await ui.select('45')
  ui.override(() => Promise.resolve({ data: [], count: 5, error: null }))
  await ui.click('Próxima')
  // Para uma faixa fora do total, a recuperação volta à página válida.
  assert.ok(document.querySelector('[role="alert"]'))
  assert.equal(document.querySelector('select').value, '45')
  const reads = ui.reads.length
  await ui.locale('en')
  assert.equal(ui.reads.length, reads)
  assert.match(document.body.textContent, /Selected project: Obra 45/)
  assert.match(document.querySelector('[role="alert"]').textContent, /incomplete or inconsistent/)
  ui.override(undefined); await ui.click('Try again')
  assert.equal(document.querySelector('select').disabled, false)
  await ui.disable(true)
  assert.ok(document.querySelector('select').disabled)
  assert.ok(button('Search').disabled)
  assert.ok(button('Next').disabled)
})

test('página removida em outra aba retorna à última página disponível', async t => {
  const ui = await mount(t)
  await ui.click('Próxima'); await ui.click('Próxima')
  ui.records([{ id: 1, titulo: 'Única' }])
  await ui.click('Anterior')
  assert.deepEqual(ui.reads.at(-1).range, [0, 19])
  assert.ok(document.querySelector('option[value="1"]'))
  assert.ok(button('Anterior').disabled)
  assert.ok(button('Próxima').disabled)
})
