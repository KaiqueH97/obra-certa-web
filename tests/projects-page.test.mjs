import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as icons from 'lucide-react'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'
const { act, createElement: h } = React
const base = { react: React, 'react/jsx-runtime': jsx }
const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const pagination = loadTs(new URL('../lib/project-pagination.ts', import.meta.url), { './load-data': loads })
const mutation = loadTs(new URL('../lib/confirmed-mutation.ts', import.meta.url))
const hooks = loadTs(new URL('../app/hooks/useDataLoad.ts', import.meta.url), { ...base, '@/lib/load-data': loads })
const feedback = loadTs(new URL('../app/components/LoadFeedback.tsx', import.meta.url), base)
const guard = loadTs(new URL('../app/components/MutationGuard.tsx', import.meta.url), { ...base, '@/lib/confirmed-mutation': mutation })
const record = id => ({ id, titulo: `Obra ${id}`, user_id: 'A', criado_em: '2026-01-01T00:00:00Z' })
const button = label => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === label)
const linkIds = () => [...document.querySelectorAll('a[href^="/projetos/"]')].map(node => Number(node.getAttribute('href').split('/').at(-1)))
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function mount(t, count = 45) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/projetos' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = await import('react-dom/client')
  let records = Array.from({ length: count }, (_, index) => record(count - index))
  let readOverride, writeOverride
  const reads = [], writes = [], notices = []
  const toast = { loading: () => 'own-toast', dismiss() {}, success: value => notices.push(value), error: value => notices.push(value) }
  const actions = loadTs(new URL('../app/hooks/useConfirmedMutation.ts', import.meta.url), { ...base, '@/lib/confirmed-mutation': mutation, 'react-hot-toast': { default: toast } })
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'A' } }, error: null }) },
    from(table) {
      assert.equal(table, 'projetos')
      const query = { orders: [] }
      const chain = {
        select(columns, options) { query.columns = columns; query.options = options; return chain },
        order(column, options) { query.orders.push([column, options.ascending]); return chain },
        range(from, to) { query.range = [from, to]; return chain },
        abortSignal(signal) {
          query.signal = signal
          reads.push(query)
          return readOverride ? readOverride(query) : Promise.resolve(query.range[0] > 0 && query.range[0] >= records.length
            ? { data: null, count: null, error: { code: 'PGRST103' } }
            : { data: records.slice(query.range[0], query.range[1] + 1), count: records.length, error: null })
        },
        insert(payload) { query.operation = 'insert'; query.payload = payload; return chain },
        update(payload) { query.operation = 'update'; query.payload = payload; return chain },
        delete() { query.operation = 'delete'; return chain },
        eq(column, value) { assert.equal(column, 'id'); query.id = value; return chain },
        single() {
          writes.push(query)
          if (writeOverride) return writeOverride(query)
          let saved
          if (query.operation === 'insert') {
            saved = { ...record((records[0]?.id ?? 0) + 1), ...query.payload[0] }
            records = [saved, ...records]
          } else if (query.operation === 'delete') {
            saved = { id: query.id }
            records = records.filter(row => row.id !== query.id)
          } else {
            records = records.map(row => row.id === query.id ? { ...row, ...query.payload } : row)
            saved = records.find(row => row.id === query.id)
          }
          return Promise.resolve({ data: saved, error: null })
        },
      }
      return chain
    },
  }
  const { default: Page } = loadTs(new URL('../app/(sistema)/projetos/page.tsx', import.meta.url), {
    ...base, 'lucide-react': icons, 'react-hot-toast': { default: toast },
    'next/link': { default: props => h('a', props) }, '@/lib/supabase': { supabase },
    '@/lib/project-pagination': pagination, '@/lib/confirmed-mutation': mutation,
    '@/app/hooks/useConfirmedMutation': actions, '@/app/hooks/useDataLoad': hooks,
    '@/app/components/LoadFeedback': feedback, '@/app/components/MutationGuard': guard,
  })
  const root = createRoot(document.getElementById('root'))
  let mounted = true
  const unmount = async () => { if (mounted) { await act(() => root.unmount()); mounted = false } }
  t.after(async () => {
    await unmount(); dom.window.close()
    delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT
  })
  await act(() => root.render(h(Page)))
  return {
    reads, writes, notices, unmount,
    setRead: value => { readOverride = value }, setWrite: value => { writeOverride = value }, setRecords: value => { records = value },
    click: text => act(() => button(text).click()),
    fill: (selector, value) => act(() => {
      const input = document.querySelector(selector)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
    }),
    create: () => act(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))),
    removeFirst: async () => {
      await act(() => document.querySelector('button[title="Excluir"]').click())
      await act(() => button('Sim, Excluir').click())
    },
  }
}

test('carrega 20 obras por vez com ordenação estável, faixa no servidor e foco ao navegar', async t => {
  const ui = await mount(t)
  assert.equal(ui.reads.length, 1)
  assert.deepEqual(ui.reads[0].range, [0, 19])
  assert.equal(ui.reads[0].options.count, 'exact')
  assert.deepEqual(ui.reads[0].orders, [['criado_em', false], ['id', false]])
  assert.deepEqual(linkIds(), Array.from({ length: 20 }, (_, i) => 45 - i))
  assert.equal(button('Anterior').disabled, true)
  await ui.click('Próxima')
  assert.deepEqual(ui.reads[1].range, [20, 39])
  assert.equal(linkIds().length, 20)
  assert.equal(document.activeElement, document.querySelector('h2'))
  await ui.click('Próxima')
  assert.deepEqual(ui.reads[2].range, [40, 59])
  assert.deepEqual(linkIds(), [5, 4, 3, 2, 1])
  assert.equal(button('Próxima').disabled, true)
  assert.match(document.body.textContent, /41–45 de 45 obras/)
  await ui.click('Anterior')
  assert.deepEqual(linkIds(), Array.from({ length: 20 }, (_, i) => 25 - i))
})

test('não permite agir na página antiga durante leitura nova; erro preserva índice e retry', async t => {
  const ui = await mount(t), d = deferred()
  ui.setRead(() => d.promise)
  await ui.click('Próxima')
  assert.equal(linkIds().length, 0)
  assert.equal(document.querySelector('form'), null)
  await act(() => d.resolve({ data: null, count: null, error: { message: 'offline' } }))
  assert.ok(document.querySelector('[role="alert"]'))
  ui.setRead(null)
  await ui.click('Tentar novamente')
  assert.deepEqual(ui.reads.at(-1).range, [20, 39])
  assert.equal(linkIds()[0], 25)
})

test('criar em outra página retorna à primeira, recarrega contagem e limita a lista a 20', async t => {
  const ui = await mount(t)
  await ui.click('Próxima')
  await ui.fill('#nova-obra', 'Nova obra')
  await ui.create()
  assert.equal(ui.writes.length, 1)
  assert.deepEqual(ui.reads.at(-1).range, [0, 19])
  assert.equal(linkIds()[0], 46)
  assert.equal(linkIds().length, 20)
  assert.match(document.body.textContent, /1–20 de 46 obras/)
  assert.equal(document.getElementById('nova-obra').value, '')
})

test('excluir último registro da última página retorna à anterior sem ficar em página vazia', async t => {
  const ui = await mount(t, 21)
  await ui.click('Próxima')
  await ui.removeFirst()
  assert.deepEqual(ui.reads.at(-1).range, [0, 19])
  assert.equal(linkIds().length, 20)
  assert.equal(button('Próxima').disabled, true)
  assert.match(document.body.textContent, /1–20 de 20 obras/)
})

test('exclusão em página cheia repõe o registro da próxima página', async t => {
  const ui = await mount(t, 22)
  await ui.removeFirst()
  assert.equal(linkIds().length, 20)
  assert.equal(linkIds().at(-1), 2)
  assert.match(document.body.textContent, /1–20 de 21 obras/)
})

test('mudanças em outra aba que removem a página solicitada voltam à última disponível', async t => {
  const ui = await mount(t)
  ui.setRecords([record(45)])
  await ui.click('Próxima')
  assert.deepEqual(ui.reads.slice(-3).map(row => row.range), [[20, 39], [0, 0], [0, 19]])
  assert.deepEqual(linkIds(), [45])
  assert.match(document.body.textContent, /1–1 de 1 obras/)
})

test('edição bloqueia paginação e usa resposta confirmada sem buscar toda a lista', async t => {
  const ui = await mount(t)
  await act(() => document.querySelector('button[title="Editar"]').click())
  assert.equal(button('Próxima').disabled, true)
  assert.equal(document.querySelector('button[aria-label="Criar obra"]').disabled, true)
  assert.equal(document.querySelector('button[title="Excluir"]').disabled, true)
  await ui.create()
  assert.equal(ui.writes.length, 0)
  await ui.fill('input[autofocus], input.bg-orange-50', 'Título novo')
  await ui.click('Salvar')
  assert.equal(ui.reads.length, 1)
  assert.match(document.body.textContent, /Título novo/)
  assert.equal(button('Próxima').disabled, false)
})

test('falha na recarga após INSERT confirmado não permite criar de novo para recuperar lista', async t => {
  const ui = await mount(t)
  await ui.fill('#nova-obra', 'Nova obra')
  ui.setRead(async () => ({ data: null, count: null, error: { message: 'offline' } }))
  await ui.create()
  assert.equal(ui.writes.length, 1)
  assert.equal(document.querySelector('form'), null)
  ui.setRead(null)
  await ui.click('Tentar novamente')
  assert.equal(ui.writes.length, 1)
  assert.equal(linkIds()[0], 46)
})

test('erro de exclusão não muda contagem nem dispara recarga', async t => {
  const ui = await mount(t, 1)
  ui.setWrite(async () => ({ data: null, error: { code: '42501', message: 'denied' } }))
  await ui.removeFirst()
  assert.equal(ui.reads.length, 1)
  assert.deepEqual(linkIds(), []) // a linha continua no modo de confirmação
  assert.match(document.body.textContent, /1–1 de 1 obras/)
  assert.ok(button('Sim, Excluir'))
})

test('lista vazia é confirmada e desabilita os controles de paginação', async t => {
  const ui = await mount(t, 0)
  assert.match(document.body.textContent, /Nenhuma obra cadastrada/)
  assert.equal(button('Próxima').disabled, true)
  assert.equal(button('Anterior').disabled, true)
  await ui.unmount()
})

test('resposta após desmontagem não renderiza página pendente', async t => {
  const ui = await mount(t), d = deferred()
  ui.setRead(() => d.promise)
  await ui.click('Próxima')
  const request = ui.reads.at(-1)
  await ui.unmount()
  assert.equal(request.signal.aborted, true)
  await act(() => d.resolve({ data: [record(1)], count: 21, error: null }))
  assert.equal(document.body.textContent, '')
})
