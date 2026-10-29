import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'

const { act, createElement: h } = React
const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const cash = loadTs(new URL('../lib/cash-page.ts', import.meta.url), { './load-data': loads })
const base = { react: React, 'react/jsx-runtime': jsx }
const hooks = loadTs(new URL('../app/hooks/useDataLoad.ts', import.meta.url), { ...base, '@/lib/load-data': loads })
const row = id => ({ id, tipo: 'RECEBIMENTO_CLIENTE', valor: 10, descricao: null,
  data: '2026-10-28', funcionario_id: null, funcionarios: null })
const response = (page = 0) => ({ projeto_id: 42, pagina: page, total: 21, entradas: 210,
  pagamentos: 0, transacoes: page ? [row(1)] : Array.from({ length: 20 }, (_, i) => row(21 - i)) })

test('contrato aceita totais globais e campos nulos; página removida já vem ajustada', () => {
  assert.equal(cash.parseCashPage(response(), '42', 0).entradas, 210)
  assert.equal(cash.parseCashPage(response(1), '42', 999).pagina, 1)
  assert.equal(cash.parseCashPage({ ...response(), total: 0, entradas: 0, transacoes: [] }, '42', 0).total, 0)
})

test('contrato rejeita resumo parcial, duplicatas, ordem incorreta, total inválido e outra obra', () => {
  for (const value of [
    null, {}, { ...response(), entradas: undefined }, { ...response(), entradas: Infinity },
    { ...response(), projeto_id: 99 }, { ...response(), pagina: 1 }, { ...response(), total: -1 },
    { ...response(), transacoes: [] }, { ...response(), transacoes: [row(1), row(1)], total: 2 },
    { ...response(), transacoes: [row(1), row(2)], total: 2 },
    { ...response(), transacoes: [{ ...row(1), valor: '10' }], total: 1 },
  ]) assert.throws(() => cash.parseCashPage(value, '42', 0))
})

async function mount(t) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/projetos/42' })
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const reads = []
  let override
  const { useCashPage } = loadTs(new URL('../app/hooks/useCashPage.ts', import.meta.url), {
    ...base, '@/lib/load-data': loads, '@/lib/cash-page': cash, './useDataLoad': hooks,
    '@/lib/supabase': { supabase: { rpc(name, args) {
      assert.equal(name, 'pagina_caixa')
      return { abortSignal(signal) {
        reads.push({ args, signal })
        return override ? override(args) : Promise.resolve({ data: response(args.p_pagina), error: null })
      } }
    } } },
  })
  function Harness({ projectId }) {
    const state = useCashPage(projectId)
    return h('div', null,
      h('output', null, state.ready ? JSON.stringify(state.data) : state.error ?? 'loading'),
      h('button', { onClick: () => state.refresh(1) }, 'next'),
      h('button', { onClick: () => state.refresh(0) }, 'first'),
      h('button', { onClick: state.retry }, 'retry'))
  }
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(document.querySelector('#root'))
  let mounted = true
  const unmount = async () => { if (mounted) { await act(() => root.unmount()); mounted = false } }
  t.after(async () => {
    await unmount(); dom.window.close()
    delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT
  })
  await act(() => root.render(h(Harness, { projectId: '42' })))
  return { reads, unmount, override: fn => { override = fn },
    click: index => act(() => document.querySelectorAll('button')[index].click()),
    changeProject: () => act(() => root.render(h(Harness, { key: '99', projectId: '99' }))),
  }
}

test('consultas antigas canceladas não sobrescrevem a nova página', async t => {
  const ui = await mount(t)
  let resolveOld
  ui.override(() => new Promise(resolve => { resolveOld = resolve }))
  await ui.click(0)
  const old = ui.reads.at(-1)
  assert.equal(document.querySelector('output').textContent, 'loading')
  ui.override(undefined)
  await ui.click(1)
  assert.equal(old.signal.aborted, true)
  await act(() => resolveOld({ data: response(1), error: null }))
  assert.equal(JSON.parse(document.querySelector('output').textContent).pagina, 0)
})

test('erro ou RPC ausente não vira zero; retry recupera totais', async t => {
  const ui = await mount(t)
  ui.override(() => Promise.resolve({ data: null, error: { code: 'PGRST202' } }))
  await ui.click(0)
  assert.match(document.querySelector('output').textContent, /Não foi possível carregar/)
  ui.override(undefined); await ui.click(2)
  assert.equal(JSON.parse(document.querySelector('output').textContent).entradas, 210)
})

test('trocar obra e sair cancelam pedidos pendentes', async t => {
  const ui = await mount(t)
  ui.override(() => new Promise(() => {}))
  await ui.click(0)
  const old = ui.reads.at(-1)
  await ui.changeProject()
  assert.equal(old.signal.aborted, true)
  const current = ui.reads.at(-1)
  assert.equal(current.args.p_projeto_id, '99')
  await ui.unmount()
  assert.equal(current.signal.aborted, true)
})
