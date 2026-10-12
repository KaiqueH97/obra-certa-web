import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as icons from 'lucide-react'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'

const { act, createElement: h } = React
const base = { react: React, 'react/jsx-runtime': jsx }
const mutation = loadTs(new URL('../lib/confirmed-mutation.ts', import.meta.url))
const guard = loadTs(new URL('../app/components/MutationGuard.tsx', import.meta.url), { ...base, '@/lib/confirmed-mutation': mutation })
const loads = loadTs(new URL('../lib/load-data.ts', import.meta.url))
const money = loadTs(new URL('../lib/money.ts', import.meta.url))
const confirmation = loadTs(new URL('../app/components/DeleteConfirmation.tsx', import.meta.url), base)
const feedback = loadTs(new URL('../app/components/LoadFeedback.tsx', import.meta.url), base)

for (const route of ['projetos', 'equipe']) {
  for (const mode of ['navegação', 'timeout']) {
  test(`${route}: não inicia INSERT quando getUser termina após ${mode}`, async t => {
    const dom = new JSDOM('<div id="root"></div>', { url: `https://app.example/${route}` })
    globalThis.window = dom.window
    globalThis.document = dom.window.document
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const { createRoot } = await import('react-dom/client')
    let resolveUser, queries = 0, validations = 0
    const user = new Promise(resolve => { resolveUser = resolve })
    const notices = []
    const toast = {
      loading: () => { notices.push('loading'); return 'own-toast' },
      dismiss: id => { assert.equal(id, 'own-toast'); notices.push('dismiss') },
      success: () => notices.push('success'), error: () => notices.push('error'),
    }
    const actions = loadTs(new URL('../app/hooks/useConfirmedMutation.ts', import.meta.url), {
      ...base, '@/lib/confirmed-mutation': { ...mutation, createMutationRunner: (notices, onPending, onUnconfirmed) => mutation.createMutationRunner(notices, onPending, onUnconfirmed, mode === 'timeout' ? 10 : 20000) }, 'react-hot-toast': { default: toast },
    })
    const { default: Page } = loadTs(new URL(`../app/(sistema)/${route}/page.tsx`, import.meta.url), {
      ...base, 'lucide-react': icons, 'react-hot-toast': { default: toast },
      'next/link': { default: props => h('a', props) },
      '@/lib/supabase': { supabase: {
        auth: { getUser: () => { validations++; return user } },
        from: () => { queries++; throw new Error('Não deveria iniciar INSERT') },
      } },
      '@/lib/load-data': loads, '@/lib/money': money,
      '@/lib/confirmed-mutation': mutation, '@/app/hooks/useConfirmedMutation': actions, '@/app/components/MutationGuard': guard,
      '@/app/components/DeleteConfirmation': confirmation, '@/app/components/LoadFeedback': feedback,
      '@/app/hooks/useDataLoad': { useDataLoad: function useFixture(load, apply) {
        React.useEffect(() => { apply([]) }, [apply])
        return { ready: true, loading: false, error: null, retry() {} }
      } },
    })
    const root = createRoot(document.getElementById('root'))
    t.after(async () => {
      await act(() => root.unmount())
      dom.window.close()
      delete globalThis.window
      delete globalThis.document
      delete globalThis.IS_REACT_ACT_ENVIRONMENT
    })
    await act(() => root.render(h(React.StrictMode, null, h(Page))))
    await act(() => {
      const input = document.querySelector('form input')
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Registro de teste')
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
    await act(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(validations, 1)
    assert.equal(queries, 0)
    if (mode === 'navegação') {
      await act(() => root.render(h('p', null, 'Outra tela')))
      assert.deepEqual(notices, ['loading', 'dismiss'])
    } else {
      await act(() => new Promise(resolve => setTimeout(resolve, 30)))
      assert.equal(document.querySelector('form button[type="submit"]').matches(':disabled'), true)
      const alert = document.querySelector('[role="alert"]')
      assert.equal(document.activeElement, alert)
      assert.equal(alert.querySelector('button').matches(':disabled'), false)
      assert.deepEqual(notices, ['loading', 'error'])
    }
    await act(async () => { resolveUser({ data: { user: { id: 'A' } }, error: null }) })
    assert.equal(queries, 0)
    assert.deepEqual(notices, mode === 'navegação' ? ['loading', 'dismiss'] : ['loading', 'error'])
  })
  }
}
