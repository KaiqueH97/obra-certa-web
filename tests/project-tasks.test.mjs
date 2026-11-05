import { createI18nDependencies } from './helpers/i18n.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as icons from 'lucide-react'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'
const { act, createElement: h } = React
const base = { react: React, 'react/jsx-runtime': jsx, ...createI18nDependencies() }
const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const pages = loadTs(new URL('../lib/pagination.ts', import.meta.url), { './load-data': loads })
const mutation = loadTs(new URL('../lib/confirmed-mutation.ts', import.meta.url))
const hooks = loadTs(new URL('../app/hooks/useDataLoad.ts', import.meta.url), { ...base, '@/lib/load-data': loads })
const feedback = loadTs(new URL('../app/components/LoadFeedback.tsx', import.meta.url), base)
const guard = loadTs(new URL('../app/components/MutationGuard.tsx', import.meta.url), { ...base, '@/lib/confirmed-mutation': mutation })
const record = id => ({ id, nome: `Tarefa ${id}`, concluida: false, projeto_id: 42 })
const button = label => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === label)
const names = () => [...document.querySelectorAll('[aria-pressed]')].map(node => node.textContent)
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function mount(t, count = 45) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/projetos/42' })
  globalThis.window = dom.window
  base['@/lib/locale-store'].setLocale('pt-BR')
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = await import('react-dom/client')
  let records = Array.isArray(count) ? count : Array.from({ length: count }, (_, index) => record(count - index))
  let readOverride, writeOverride
  const reads = [], writes = [], notices = []
  const toast = { loading: () => 'own-toast', dismiss() {}, success: value => notices.push(value), error: value => notices.push(value) }
  const actions = loadTs(new URL('../app/hooks/useConfirmedMutation.ts', import.meta.url), { ...base, '@/lib/confirmed-mutation': mutation, 'react-hot-toast': { default: toast } })
  const supabase = {
    from(table) {
      assert.equal(table, 'tarefas')
      const query = { orders: [], filters: [] }
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
        eq(column, value) { query.filters.push([column, value]); if (column === 'id') query.id = value; return chain },
        single() {
          writes.push(query)
          if (writeOverride) return writeOverride(query)
          let saved
          if (query.operation === 'insert') {
            saved = { ...record((records[0]?.id ?? 0) + 1), ...query.payload[0], projeto_id: Number(query.payload[0].projeto_id) }
            records = [saved, ...records]
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
  const { ProjectTasks: Page } = loadTs(new URL('../app/components/ProjectTasks.tsx', import.meta.url), {
    ...base, 'lucide-react': icons, '@/lib/supabase': { supabase },
    '@/lib/load-data': loads, '@/lib/pagination': pages,
    '@/app/hooks/useConfirmedMutation': actions, '@/app/hooks/useDataLoad': hooks,
    './LoadFeedback': feedback, './MutationGuard': guard,
  })
  const root = createRoot(document.getElementById('root'))
  let mounted = true
  const unmount = async () => { if (mounted) { await act(() => root.unmount()); mounted = false } }
  t.after(async () => {
    await unmount(); dom.window.close()
    delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT
  })
  await act(() => root.render(h(Page, { projetoId: "42" })))
  return {
    reads, writes, notices, unmount,
    changeProject: id => act(() => root.render(h(Page, { key: id, projetoId: id }))),
    setRead: value => { readOverride = value }, setWrite: value => { writeOverride = value }, setRecords: value => { records = value },
    click: text => act(() => button(text).click()),
    fill: (selector, value) => act(() => {
      const input = document.querySelector(selector)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
    }),
    create: () => act(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))),
    toggle: () => act(() => document.querySelector('[aria-pressed]').click()),
    locale: value => act(() => base['@/lib/locale-store'].setLocale(value)),
  }
}


test('tarefas: páginas de 20, filtro da obra, ordem estável e foco após navegar', async t => {
  const ui = await mount(t)
  assert.equal(names().length, 20)
  assert.deepEqual(ui.reads[0].range, [0, 19])
  assert.deepEqual(ui.reads[0].filters, [['projeto_id', '42']])
  assert.deepEqual(ui.reads[0].orders, [['criado_em', false], ['id', false]])
  assert.equal(ui.reads[0].options.count, 'exact')
  await ui.click('Próxima')
  assert.deepEqual(ui.reads.at(-1).range, [20, 39])
  assert.match(document.activeElement.textContent, /Página 2 de 3/)
  await ui.click('Próxima')
  assert.equal(names().length, 5)
  assert.ok(button('Próxima').disabled)
})

test('tarefas: criar na página final volta ao início, relê total e não aumenta a página além de 20', async t => {
  const ui = await mount(t)
  await ui.click('Próxima'); await ui.click('Próxima')
  await ui.fill('input', 'Nova tarefa')
  await ui.create()
  assert.equal(ui.writes.length, 1)
  assert.equal(ui.writes[0].payload[0].projeto_id, '42')
  assert.equal(names()[0], 'Nova tarefa')
  assert.equal(names().length, 20)
  assert.match(document.body.textContent, /1–20 de 46 tarefas/)
  assert.equal(document.querySelector('input').value, '')
})

test('tarefas: concluir mantém página; trava clique duplicado e paginação enquanto grava', async t => {
  const ui = await mount(t)
  await ui.click('Próxima')
  const pending = deferred()
  ui.setWrite(() => pending.promise)
  await act(() => { document.querySelector('[aria-pressed]').click(); document.querySelector('[aria-pressed]').click() })
  assert.equal(ui.writes.length, 1)
  assert.deepEqual(ui.writes[0].filters, [['id', 25], ['projeto_id', '42']])
  assert.equal(ui.writes[0].payload.concluida, true)
  assert.ok(button('Anterior').disabled)
  ui.setRecords(Array.from({ length: 45 }, (_, i) => ({ ...record(45 - i), concluida: 45 - i === 25 })))
  await act(() => pending.resolve({ data: { ...record(25), concluida: true }, error: null }))
  assert.deepEqual(ui.reads.at(-1).range, [20, 39])
  assert.equal(document.querySelector('[aria-pressed]').getAttribute('aria-pressed'), 'true')
})

test('tarefas: falha de leitura não vira lista vazia; retry preserva rascunho e idioma', async t => {
  const ui = await mount(t)
  await ui.fill('input', 'Rascunho original')
  ui.setRead(() => Promise.resolve({ data: null, count: null, error: { message: 'offline' } }))
  await ui.click('Próxima')
  assert.ok(document.querySelector('[role="alert"]'))
  assert.equal(names().length, 0)
  const reads = ui.reads.length
  await ui.locale('en')
  assert.equal(ui.reads.length, reads)
  assert.equal(document.querySelector('input').value, 'Rascunho original')
  ui.setRead(undefined); await ui.click('Try again')
  assert.equal(names().length, 20)
  assert.match(document.body.textContent, /21–40 of 45 tasks/)
})

test('tarefas: remoção concorrente recupera última página; null significa pendente', async t => {
  const ui = await mount(t)
  await ui.click('Próxima'); await ui.click('Próxima')
  ui.setRecords([{ ...record(1), concluida: null }])
  await ui.click('Anterior')
  assert.deepEqual(ui.reads.at(-1).range, [0, 19])
  assert.equal(document.querySelector('[aria-pressed]').getAttribute('aria-pressed'), 'false')
  assert.ok(button('Próxima').disabled)
})

test('tarefas: abandonar tela cancela consulta e ignora resposta atrasada', async t => {
  const ui = await mount(t), pending = deferred()
  ui.setRead(() => pending.promise)
  await ui.click('Próxima')
  const read = ui.reads.at(-1)
  await ui.unmount()
  assert.equal(read.signal.aborted, true)
  await act(() => pending.resolve({ data: [], count: 0, error: null }))
  assert.equal(document.querySelector('section'), null)
})

test('tarefas: gravação sem confirmação bloqueia repetição e preserva rascunho', async t => {
  const ui = await mount(t)
  ui.setWrite(() => Promise.resolve({ data: null, error: null }))
  await ui.fill('input', 'Não duplicar')
  await ui.create()
  assert.match(document.querySelector('[role="alert"]').textContent, /Não foi possível confirmar/)
  await ui.create()
  assert.equal(ui.writes.length, 1)
  assert.equal(document.querySelector('input').value, 'Não duplicar')
})

test('tarefas: resposta de outra obra ou incompleta é rejeitada', async t => {
  const ui = await mount(t, [{ ...record(1), projeto_id: 999 }])
  assert.equal(names().length, 0)
  assert.ok(document.querySelector('[role="alert"]'))
  ui.setRecords([record(1)])
  await ui.click('Tentar novamente')
  assert.deepEqual(names(), ['Tarefa 1'])
})

test('tarefas: falha ao reler após criar não repete INSERT no retry', async t => {
  const ui = await mount(t)
  await ui.fill('input', 'Já salva')
  ui.setRead(() => Promise.resolve({ data: null, count: null, error: { message: 'offline' } }))
  await ui.create()
  assert.equal(ui.writes.length, 1)
  assert.ok(document.querySelector('[role="alert"]'))
  assert.equal(document.querySelector('input').value, '')
  ui.setRead(undefined)
  await ui.click('Tentar novamente')
  assert.equal(ui.writes.length, 1)
  assert.equal(names()[0], 'Já salva')
})

test('tarefas: trocar obra cancela pedido anterior e não mistura respostas', async t => {
  const ui = await mount(t), pending = deferred()
  ui.setRead(() => pending.promise)
  await ui.click('Próxima')
  const old = ui.reads.at(-1)
  ui.setRead(undefined)
  ui.setRecords([{ ...record(70), projeto_id: 99 }])
  await ui.changeProject('99')
  assert.equal(old.signal.aborted, true)
  assert.deepEqual(ui.reads.at(-1).filters, [['projeto_id', '99']])
  await act(() => pending.resolve({ data: Array.from({ length: 20 }, (_, i) => record(25 - i)), count: 45, error: null }))
  assert.deepEqual(names(), ['Tarefa 70'])
})

test('tarefas: resposta de gravação após sair não emite sucesso nem relê lista', async t => {
  const ui = await mount(t), pending = deferred()
  ui.setWrite(() => pending.promise)
  await ui.toggle()
  const reads = ui.reads.length
  await ui.unmount()
  await act(() => pending.resolve({ data: { ...record(45), concluida: true }, error: null }))
  assert.equal(ui.reads.length, reads)
  assert.deepEqual(ui.notices, [])
})

for (const [operation, responses] of [
  ['insert', [{ id: 46 }, { ...record(46), projeto_id: 99 }, { ...record(46), concluida: undefined }, { ...record(46), nome: null }, { ...record(46), id: -1 }]],
  ['update', [{ id: 45 }, { ...record(44), concluida: true }, { ...record(45), projeto_id: 99, concluida: true }, record(45), { ...record(45), concluida: null }]],
]) {
  for (const response of responses) {
    test(`tarefas: ${operation} rejeita retorno inconsistente ${JSON.stringify(response)} sem confirmar ou repetir`, async t => {
      const ui = await mount(t)
      ui.setWrite(async () => ({ data: response, error: null }))
      await ui.fill('input', 'Rascunho preservado')
      if (operation === 'insert') await ui.create()
      else await ui.toggle()
      assert.equal(document.querySelector('input').value, 'Rascunho preservado')
      assert.equal(document.querySelector('[aria-pressed]').getAttribute('aria-pressed'), 'false')
      assert.equal(document.querySelector('fieldset').disabled, true)
      assert.match(document.querySelector('[role="alert"]').textContent, /Ela pode ter sido concluída/)
      assert.equal(ui.reads.length, 1)
      assert.equal(ui.writes.length, 1)
      assert.ok(!ui.notices.some(message => typeof message === 'string' && /adicionada!|atualizada!/.test(message)))
      await ui.create(); await ui.toggle()
      assert.equal(ui.writes.length, 1)
      await ui.locale('en')
      assert.match(document.querySelector('[role="alert"]').textContent, /It may have completed/)
      assert.equal(document.querySelector('fieldset').disabled, true)
    })
  }
}

test('tarefas: retorno válido com concluida nula na criação confirma e relê a lista', async t => {
  const ui = await mount(t)
  const saved = { ...record(46), nome: 'Nova tarefa', concluida: null }
  ui.setWrite(async () => { ui.setRecords([saved]); return { data: saved, error: null } })
  await ui.fill('input', saved.nome)
  await ui.create()
  assert.equal(document.querySelector('input').value, '')
  assert.equal(document.querySelector('[aria-pressed]').getAttribute('aria-pressed'), 'false')
  assert.equal(ui.notices.at(-1), 'Tarefa adicionada!')
})

test('tarefas: leitura rejeita projeto com tipo incorreto e recupera por retry', async t => {
  const ui = await mount(t)
  ui.setRead(async () => ({ data: [{ ...record(1), projeto_id: '42' }], count: 21, error: null }))
  await ui.click('Próxima')
  assert.match(document.querySelector('[role="alert"]').textContent, /incompleta ou inconsistente/)
  assert.equal(names().length, 0)
  ui.setRead(null)
  await ui.click('Tentar novamente')
  assert.equal(names()[0], 'Tarefa 25')
  assert.equal(ui.writes.length, 0)
})

test('tarefas: concluir tarefa nula e reabrir exige os estados true e false retornados', async t => {
  const ui = await mount(t, [{ ...record(1), concluida: null }])
  await ui.toggle()
  assert.equal(document.querySelector('[aria-pressed]').getAttribute('aria-pressed'), 'true')
  await ui.toggle()
  assert.equal(document.querySelector('[aria-pressed]').getAttribute('aria-pressed'), 'false')
  assert.deepEqual(ui.writes.map(write => write.payload.concluida), [true, false])
  assert.equal(ui.reads.length, 3)
  assert.equal(ui.notices.filter(notice => notice === 'Tarefa atualizada!').length, 2)
})
