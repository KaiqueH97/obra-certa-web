import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'

const { act, createElement: h } = React
const tick = () => new Promise(resolve => setTimeout(resolve, 20))
const flush = () => act(tick)
const loadData = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const { createSessionGuard } = loadTs(new URL('../lib/session-guard.ts', import.meta.url), { './load-data': loadData })
const { LoadFeedback } = loadTs(new URL('../app/components/LoadFeedback.tsx', import.meta.url), { 'react/jsx-runtime': jsx })

async function mount(t, initialResult = { data: { user: { id: 'A' } }, error: null }) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/home', pretendToBeVisual: true })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let result = initialResult
  let callback
  let calls = 0
  let unsubscribed = 0
  const destinations = []
  const getPending = () => null
  const { PrivateSessionBoundary } = loadTs(new URL('../app/components/PrivateSessionBoundary.tsx', import.meta.url), {
    react: React,
    'react/jsx-runtime': jsx,
    '@/lib/supabase': { supabase: { auth: {
      getUser: () => { calls++; return Promise.resolve(result) },
      onAuthStateChange: handler => {
        callback = handler
        return { data: { subscription: { unsubscribe: () => { unsubscribed++ } } } }
      },
    } } },
    '@/lib/session-guard': { createSessionGuard: deps => createSessionGuard({ ...deps, navigate: path => destinations.push(path) }) },
    './AuthActionsProvider': { useAuthActions: () => ({ getPending }) },
    './LoadFeedback': { LoadFeedback },
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
  await act(() => root.render(h(PrivateSessionBoundary, null, h('input', { defaultValue: 'rascunho' }))))
  await flush()
  return {
    dom, destinations, unmount,
    setResult(value) { result = value },
    event: (event, id) => callback(event, id ? { user: { id } } : null),
    input: () => document.querySelector('input'),
    calls: () => calls,
    unsubscribed: () => unsubscribed,
  }
}

test('não monta dados privados enquanto a consulta inicial está pendente', async t => {
  let resolve
  const ui = await mount(t, new Promise(done => { resolve = done }))
  assert.equal(ui.input(), null)
  await act(async () => { resolve({ data: { user: { id: 'A' } }, error: null }); await tick() })
  assert.ok(ui.input())
  assert.equal(ui.input().closest('[hidden]'), null)
})

test('verificação rápida ao foco restaura o DOM e preserva formulário da mesma conta', async t => {
  const ui = await mount(t)
  const input = ui.input()
  input.value = 'edição pendente'
  await act(async () => { window.dispatchEvent(new window.Event('focus')); await tick() })
  assert.equal(ui.calls(), 2)
  assert.equal(ui.input(), input)
  assert.equal(input.value, 'edição pendente')
  assert.equal(input.closest('[hidden]'), null)
})

test('pagehide oculta imediatamente e pageshow persistido verifica antes de restaurar', async t => {
  const ui = await mount(t)
  const input = ui.input()
  await act(() => {
    window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true }))
    assert.ok(input.closest('[hidden]'))
  })
  await act(async () => {
    window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }))
    await tick()
  })
  assert.equal(ui.calls(), 2)
  assert.equal(ui.input(), input)
  assert.equal(input.closest('[hidden]'), null)
})

test('logout recebido descarta conteúdo e encaminha ao login', async t => {
  const ui = await mount(t)
  const input = ui.input()
  await act(() => { ui.event('SIGNED_OUT', null); assert.ok(input.closest('[hidden]')) })
  assert.equal(ui.input(), null)
  await flush()
  assert.deepEqual(ui.destinations, ['/login'])
})

test('troca de conta recebida descarta formulário antes de recarregar home', async t => {
  const ui = await mount(t)
  await act(() => ui.event('SIGNED_IN', 'B'))
  assert.equal(ui.input(), null)
  await flush()
  assert.deepEqual(ui.destinations, ['/home'])
})

test('falha transitória mantém conteúdo oculto e retry recupera o mesmo formulário', async t => {
  const ui = await mount(t)
  const input = ui.input()
  input.value = 'preservado'
  ui.setResult({ data: { user: null }, error: { status: 503 } })
  await act(async () => { window.dispatchEvent(new window.Event('focus')); await tick() })
  assert.ok(input.closest('[hidden]'))
  assert.ok(document.querySelector('[role="alert"]'))
  ui.setResult({ data: { user: { id: 'A' } }, error: null })
  await act(async () => { document.querySelector('button').click(); await tick() })
  assert.equal(ui.input(), input)
  assert.equal(input.value, 'preservado')
  assert.equal(input.closest('[hidden]'), null)
  assert.deepEqual(ui.destinations, [])
})

test('desmontagem remove inscrição e listeners de retorno à página', async t => {
  const ui = await mount(t)
  await ui.unmount()
  assert.equal(ui.unsubscribed(), 1)
  const before = ui.calls()
  window.dispatchEvent(new window.Event('focus'))
  document.dispatchEvent(new window.Event('visibilitychange'))
  window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }))
  ui.event('SIGNED_OUT', null)
  await flush()
  assert.equal(ui.calls(), before)
  assert.deepEqual(ui.destinations, [])
})
