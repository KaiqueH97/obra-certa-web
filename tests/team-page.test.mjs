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
const pages = loadTs(new URL('../lib/pagination.ts', import.meta.url), { './load-data': loads })
const money = loadTs(new URL('../lib/money.ts', import.meta.url))
const confirmation = loadTs(new URL('../app/components/DeleteConfirmation.tsx', import.meta.url), base)
const mutation = loadTs(new URL('../lib/confirmed-mutation.ts', import.meta.url))
const hooks = loadTs(new URL('../app/hooks/useDataLoad.ts', import.meta.url), { ...base, '@/lib/load-data': loads })
const feedback = loadTs(new URL('../app/components/LoadFeedback.tsx', import.meta.url), base)
const guard = loadTs(new URL('../app/components/MutationGuard.tsx', import.meta.url), { ...base, '@/lib/confirmed-mutation': mutation })
const record = id => ({ id, nome: `Profissional ${id}`, cargo: 'Pedreiro', valor_diaria: 150 })
const button = label => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === label)
const names = () => [...document.querySelectorAll('h4')].map(node => node.textContent)
const namedButton = label => [...document.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === label)
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function mount(t, count = 45) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/equipe' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = await import('react-dom/client')
  let records = Array.isArray(count) ? count : Array.from({ length: count }, (_, index) => record(count - index))
  let readOverride, writeOverride
  const reads = [], writes = [], notices = []
  const toast = { loading: () => 'own-toast', dismiss() {}, success: value => notices.push(value), error: value => notices.push(value) }
  const actions = loadTs(new URL('../app/hooks/useConfirmedMutation.ts', import.meta.url), { ...base, '@/lib/confirmed-mutation': mutation, 'react-hot-toast': { default: toast } })
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'A' } }, error: null }) },
    from(table) {
      assert.equal(table, 'funcionarios')
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
  const { default: Page } = loadTs(new URL('../app/(sistema)/equipe/page.tsx', import.meta.url), {
    ...base, 'lucide-react': icons, 'react-hot-toast': { default: toast },
    'next/link': { default: props => h('a', props) }, '@/lib/supabase': { supabase },
    '@/lib/pagination': pages, '@/lib/money': money, '@/app/components/DeleteConfirmation': confirmation, '@/lib/confirmed-mutation': mutation,
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
      await act(() => document.querySelector('button[aria-label^="Excluir "]').click())
      await act(() => button('Confirmar exclusão').click())
    },
  }
}

test('equipe: consulta só 20 linhas, mostra total e navega com ordenação estável e foco', async t => {
  const ui = await mount(t)
  assert.equal(ui.reads.length, 1)
  assert.equal(ui.reads[0].options.count, 'exact')
  assert.deepEqual(ui.reads[0].range, [0, 19])
  assert.deepEqual(ui.reads[0].orders, [['criado_em', false], ['id', false]])
  assert.equal(names().length, 20)
  assert.equal(names()[0], 'Profissional 45')
  assert.match(document.body.textContent, /Profissionais cadastrados \(45\)/)
  assert.equal(button('Anterior').disabled, true)
  await ui.click('Próxima')
  assert.deepEqual(ui.reads.at(-1).range, [20, 39])
  assert.equal(names()[0], 'Profissional 25')
  assert.match(document.activeElement.textContent, /página 2 de 3/)
  await ui.click('Próxima')
  assert.deepEqual(names(), ['Profissional 5', 'Profissional 4', 'Profissional 3', 'Profissional 2', 'Profissional 1'])
  assert.match(document.body.textContent, /41–45 de 45 profissionais/)
  assert.equal(button('Próxima').disabled, true)
  await ui.click('Anterior')
  assert.equal(names()[0], 'Profissional 25')
})

test('equipe: cadastro em outra página retorna à primeira com total atualizado', async t => {
  const ui = await mount(t)
  await ui.click('Próxima')
  await ui.fill('#novo-nome', 'Ana')
  await ui.fill('#novo-cargo', 'Pintora')
  await ui.fill('#nova-diaria', '175,50')
  await ui.create()
  assert.equal(ui.writes.length, 1)
  assert.equal(ui.writes[0].payload[0].nome, 'Ana')
  assert.equal(ui.writes[0].payload[0].cargo, 'Pintora')
  assert.equal(ui.writes[0].payload[0].valor_diaria, 175.5)
  assert.equal(ui.writes[0].payload[0].user_id, 'A')
  assert.deepEqual(ui.reads.at(-1).range, [0, 19])
  assert.equal(names()[0], 'Ana')
  assert.equal(names().length, 20)
  assert.match(document.body.textContent, /1–20 de 46 profissionais/)
  assert.equal(document.getElementById('novo-nome').value, '')
})

test('equipe: excluir único registro da última página retorna à anterior', async t => {
  const ui = await mount(t, 21)
  await ui.click('Próxima')
  await ui.removeFirst()
  assert.equal(names().length, 20)
  assert.deepEqual(ui.reads.at(-1).range, [0, 19])
  assert.match(document.activeElement.textContent, /página 1 de 1/)
  assert.equal(button('Próxima').disabled, true)
})

test('equipe: exclusão em página cheia repõe registro da próxima página', async t => {
  const ui = await mount(t, 22)
  await ui.removeFirst()
  assert.equal(names().length, 20)
  assert.equal(names().at(-1), 'Profissional 2')
  assert.match(document.body.textContent, /1–20 de 21 profissionais/)
})

test('equipe: excluir último profissional mostra vazio confirmado', async t => {
  const ui = await mount(t, 1)
  await ui.removeFirst()
  assert.match(document.body.textContent, /Nenhum profissional na sua equipe/)
  assert.match(document.body.textContent, /0 profissionais/)
  assert.equal(button('Próxima').disabled, true)
  assert.equal(button('Anterior').disabled, true)
})

test('equipe: exclusões em outra aba recuperam página após PGRST103', async t => {
  const ui = await mount(t)
  ui.setRecords([record(45)])
  await ui.click('Próxima')
  assert.deepEqual(ui.reads.slice(-3).map(row => row.range), [[20, 39], [0, 0], [0, 19]])
  assert.deepEqual(names(), ['Profissional 45'])
  assert.equal(button('Próxima').disabled, true)
})

test('equipe: edição bloqueia outras ações, valida diária e salva sem recarregar lista', async t => {
  const ui = await mount(t)
  await ui.fill('#novo-nome', 'Cadastro pendente')
  await act(() => namedButton('Editar Profissional 45').click())
  assert.equal(button('Próxima').disabled, true)
  assert.equal(button('Cadastrar na Equipe').disabled, true)
  assert.equal(namedButton('Excluir Profissional 44').disabled, true)
  await ui.create()
  assert.equal(ui.writes.length, 0)
  await ui.fill('input[aria-label="Diária do profissional"]', '-10')
  await act(() => namedButton('Salvar profissional').click())
  assert.equal(ui.writes.length, 0)
  await ui.fill('input[aria-label="Diária do profissional"]', '210,25')
  await ui.fill('input[aria-label="Nome do profissional"]', 'Nome atualizado')
  await act(() => namedButton('Salvar profissional').click())
  assert.equal(ui.writes[0].payload.valor_diaria, 210.25)
  assert.equal(names()[0], 'Nome atualizado')
  assert.equal(ui.reads.length, 1)
  assert.equal(button('Próxima').disabled, false)
  assert.equal(document.getElementById('novo-nome').value, 'Cadastro pendente')
})

test('equipe: cancelar exclusão devolve foco e desbloqueia navegação', async t => {
  const ui = await mount(t)
  const trigger = namedButton('Excluir Profissional 45')
  await act(() => trigger.click())
  assert.equal(button('Próxima').disabled, true)
  assert.equal(document.activeElement, button('Cancelar'))
  await act(() => button('Cancelar').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(document.activeElement, trigger)
  assert.equal(button('Próxima').disabled, false)
  assert.equal(ui.writes.length, 0)
})

test('equipe: leitura pendente oculta ações antigas e falha permite repetir a página correta', async t => {
  const ui = await mount(t), d = deferred()
  ui.setRead(() => d.promise)
  await ui.click('Próxima')
  assert.equal(names().length, 0)
  assert.equal(document.querySelector('form'), null)
  await act(() => d.resolve({ data: null, count: null, error: { message: 'offline' } }))
  assert.ok(document.querySelector('[role="alert"]'))
  ui.setRead(null)
  await ui.click('Tentar novamente')
  assert.deepEqual(ui.reads.at(-1).range, [20, 39])
  assert.equal(names()[0], 'Profissional 25')
})

test('equipe: recarga falha após INSERT confirmado não repete o cadastro', async t => {
  const ui = await mount(t)
  await ui.fill('#novo-nome', 'Ana')
  ui.setRead(async () => ({ data: null, count: null, error: { message: 'offline' } }))
  await ui.create()
  assert.equal(ui.writes.length, 1)
  assert.equal(document.querySelector('form'), null)
  ui.setRead(null)
  await ui.click('Tentar novamente')
  assert.equal(ui.writes.length, 1)
  assert.equal(names()[0], 'Ana')
})

test('equipe: cadastro recusado por RLS preserva campos e total', async t => {
  const ui = await mount(t, 1)
  await ui.fill('#novo-nome', 'Ana')
  await ui.fill('#nova-diaria', '125,00')
  ui.setWrite(async () => ({ data: null, error: { code: '42501', message: 'denied' } }))
  await ui.create()
  assert.equal(document.getElementById('novo-nome').value, 'Ana')
  assert.equal(document.getElementById('nova-diaria').value, '125,00')
  assert.equal(ui.reads.length, 1)
  assert.deepEqual(names(), ['Profissional 1'])
  assert.match(document.body.textContent, /1–1 de 1 profissionais/)
})

test('equipe: cargo e diária nulos não quebram a lista', async t => {
  await mount(t, [{ ...record(1), cargo: null, valor_diaria: null }])
  assert.match(document.body.textContent, /Não informada/)
  assert.deepEqual(names(), ['Profissional 1'])
  await act(() => namedButton('Editar Profissional 1').click())
  assert.equal(document.querySelector('input[aria-label="Diária do profissional"]').value, '')
})

test('equipe: sair aborta leitura pendente e ignora resposta tardia', async t => {
  const ui = await mount(t), d = deferred()
  ui.setRead(() => d.promise)
  await ui.click('Próxima')
  const request = ui.reads.at(-1)
  await ui.unmount()
  assert.equal(request.signal.aborted, true)
  await act(() => d.resolve({ data: [record(1)], count: 21, error: null }))
  assert.equal(document.body.textContent, '')
})

