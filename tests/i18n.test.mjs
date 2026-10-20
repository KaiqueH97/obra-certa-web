import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as icons from 'lucide-react'
import { renderToString } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'

const { act, createElement: h } = React
const base = { react: React, 'react/jsx-runtime': jsx }
const i18n = loadTs(new URL('../lib/i18n.ts', import.meta.url))

async function fixture(t, saved, blockedStorage = false) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/login' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  if (saved) window.localStorage.setItem('obra-certa:locale', saved)
  if (blockedStorage) Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked') } })
  const store = loadTs(new URL('../lib/locale-store.ts', import.meta.url), { './i18n': i18n })
  const hook = loadTs(new URL('../app/hooks/useLocale.ts', import.meta.url), { ...base, '@/lib/i18n': i18n, '@/lib/locale-store': store })
  const switcher = loadTs(new URL('../app/components/LanguageSwitcher.tsx', import.meta.url), { ...base, '@/lib/i18n': i18n, '@/app/hooks/useLocale': hook })
  const notices = [], logins = []
  let signIn = async () => ({ data: null, error: { code: 'invalid_credentials' } })
  const toast = { loading: message => { notices.push(message); return 'auth' }, error: message => notices.push(message), success: message => notices.push(message), dismiss() {} }
  const auth = loadTs(new URL('../lib/auth-actions.ts', import.meta.url))
  const provider = loadTs(new URL('../app/components/AuthActionsProvider.tsx', import.meta.url), {
    ...base, '@/lib/auth-actions': auth, '@/lib/i18n': i18n, '@/lib/locale-store': store,
    'react-hot-toast': { default: toast }, '@/lib/supabase': { supabase: { auth: {
      signInWithPassword: credentials => { logins.push(credentials); return signIn() },
    } } },
  })
  const deps = { ...base, 'next/link': { default: props => h('a', props) }, 'react-hot-toast': { default: toast },
    '@/app/hooks/useLocale': hook, '@/app/components/LanguageSwitcher': switcher, '@/app/components/AuthActionsProvider': provider }
  const { default: Login } = loadTs(new URL('../app/login/page.tsx', import.meta.url), deps)
  const { default: Shell } = loadTs(new URL('../app/(sistema)/layout.tsx', import.meta.url), {
    ...deps, 'next/navigation': { usePathname: () => '/home' }, 'lucide-react': icons,
    '@/app/components/PrivateSessionBoundary': { PrivateSessionBoundary: ({ children }) => children },
  })
  const { createRoot, hydrateRoot } = await import('react-dom/client')
  let root
  const content = Component => h(provider.AuthActionsProvider, null, h(Component))
  const mount = async (Component = Login) => {
    root = createRoot(document.getElementById('root'))
    await act(() => root.render(content(Component)))
  }
  t.after(async () => {
    if (root) await act(() => root.unmount())
    dom.window.close()
    delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT
  })
  return {
    store, hook, switcher, notices, logins, Shell, Login, mount,
    setSignIn: callback => { signIn = callback },
    select: locale => act(() => {
      const select = document.querySelector('select')
      select.value = locale
      select.dispatchEvent(new window.Event('change', { bubbles: true }))
    }),
    fill: (id, value) => act(() => {
      const input = document.getElementById(id)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
    }),
    submit: () => act(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))),
    hydrate: async () => {
      const node = document.getElementById('root'), errors = []
      node.innerHTML = renderToString(content(Login))
      assert.match(node.textContent, /Entrar/)
      await act(() => { root = hydrateRoot(node, content(Login), { onRecoverableError: error => errors.push(error) }) })
      assert.deepEqual(errors, [])
    },
  }
}

test('idioma padrão é português e valores desconhecidos são recusados', () => {
  assert.equal(i18n.DEFAULT_LOCALE, 'pt-BR')
  assert.equal(i18n.isLocale('en'), true)
  assert.equal(i18n.isLocale('pt-BR'), true)
  for (const value of ['en-US', 'es', '', null, '__proto__']) assert.equal(i18n.isLocale(value), false)
  assert.equal(i18n.translate('en', 'team'), 'Team')
})

test('login: trocar idioma preserva campos, rotas e preferência', async t => {
  const ui = await fixture(t)
  await ui.mount()
  assert.equal(document.querySelector('main').lang, 'pt-BR')
  await ui.fill('login-email', 'worker@example.com')
  await ui.fill('login-password', 'Secret123!')
  await ui.select('en')
  assert.equal(document.querySelector('main').lang, 'en')
  assert.equal(document.querySelector('button[type="submit"]').textContent, 'Sign in')
  assert.equal(document.getElementById('login-email').value, 'worker@example.com')
  assert.equal(document.getElementById('login-password').value, 'Secret123!')
  assert.equal(window.localStorage.getItem(ui.store.LOCALE_STORAGE_KEY), 'en')
  assert.equal(document.querySelector('a[href="/cadastro"]').textContent.trim(), 'Sign up here')
  assert.equal(document.querySelector('label[for="login-email"]').textContent, 'Email')
  await ui.select('pt-BR')
  assert.equal(document.querySelector('button[type="submit"]').textContent, 'Entrar')
})

test('preferência salva em inglês hidrata HTML português sem divergência', async t => {
  const ui = await fixture(t, 'en')
  await ui.hydrate()
  assert.equal(document.querySelector('main').lang, 'en')
  assert.equal(document.querySelector('button[type="submit"]').textContent, 'Sign in')
})

test('storage bloqueado permite trocar idioma na aba', async t => {
  const ui = await fixture(t, undefined, true)
  await ui.mount()
  await ui.select('en')
  assert.equal(document.querySelector('main').lang, 'en')
  assert.equal(ui.store.getLocale(), 'en')
})

test('idioma inválido salvo usa português e eventos de outra aba sincronizam seleção', async t => {
  const ui = await fixture(t, 'invalid')
  await ui.mount()
  assert.equal(ui.store.getLocale(), 'pt-BR')
  await ui.select('en')
  await act(() => {
    window.localStorage.setItem(ui.store.LOCALE_STORAGE_KEY, 'pt-BR')
    window.dispatchEvent(new window.StorageEvent('storage', { key: ui.store.LOCALE_STORAGE_KEY }))
  })
  assert.equal(document.querySelector('select').value, 'pt-BR')
  await act(() => {
    window.localStorage.setItem(ui.store.LOCALE_STORAGE_KEY, 'en')
    window.dispatchEvent(new window.StorageEvent('storage', { key: 'unrelated' }))
  })
  assert.equal(document.querySelector('select').value, 'pt-BR')
})

test('menus desktop/mobile compartilham idioma sem traduzir URLs ou dados', async t => {
  const ui = await fixture(t)
  await ui.mount(() => h(ui.Shell, null, h('p', null, 'Nome cadastrado da obra')))
  await ui.select('en')
  assert.equal(document.querySelector('aside').lang, 'en')
  for (const nav of document.querySelectorAll('nav')) {
    assert.equal(nav.lang, 'en')
    assert.equal(nav.querySelector('a[href="/projetos"]').textContent.trim(), 'Projects')
    assert.equal(nav.querySelector('a[href="/equipe"]').textContent.trim(), 'Team')
  }
  assert.equal(document.querySelectorAll('select').length, 2)
  assert.ok([...document.querySelectorAll('select')].every(select => select.value === 'en'))
  assert.match(document.body.textContent, /Nome cadastrado da obra/)
})

test('erro de login usa idioma atual mesmo quando usuário troca durante requisição', async t => {
  const ui = await fixture(t)
  let resolve
  ui.setSignIn(() => new Promise(done => { resolve = done }))
  await ui.mount()
  await ui.fill('login-email', 'worker@example.com')
  await ui.fill('login-password', 'Secret123!')
  await ui.submit()
  assert.equal(ui.logins.length, 1)
  await ui.select('en')
  await act(() => resolve({ data: null, error: { code: 'invalid_credentials' } }))
  assert.equal(ui.notices.at(-1).props.children, 'Incorrect email or password.')
  assert.equal(ui.notices.at(-1).props.lang, 'en')
  assert.equal(ui.logins.length, 1)
})

test('mensagem não catalogada preserva texto e idioma original', () => {
  const result = i18n.translateAuthMessage('en', 'Mensagem ainda não traduzida')
  assert.equal(result.text, 'Mensagem ainda não traduzida')
  assert.equal(result.lang, 'pt-BR')
})
