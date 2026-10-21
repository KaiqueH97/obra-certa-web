import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as icons from 'lucide-react'
import { renderToString } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { loadTs } from './helpers/load-ts.mjs'
import { createI18nDependencies } from './helpers/i18n.mjs'
const { act, createElement: h } = React

async function fixture(t, { online = true, savedLocale, blockedStorage = false } = {}) {
  const dom = new JSDOM('<!doctype html><html lang="pt-BR"><head><meta name="description" content="Gestão de Obras e Calculadora de Materiais"><link rel="manifest" href="/manifest.json"></head><body><div id="root"></div></body></html>', { url: 'https://app.example/~offline' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
  if (savedLocale) window.localStorage.setItem('obra-certa:locale', savedLocale)
  if (blockedStorage) Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked') } })
  const deps = { react: React, 'react/jsx-runtime': jsx, 'lucide-react': icons, ...createI18nDependencies() }
  const active = new Map([['other-notice', 'Preservar']]), events = []
  const toast = Object.fromEntries(['success', 'error'].map(type => [type, (message, options) => {
    events.push({ type, message, options }); active.set(options.id, { message, options })
  }]))
  toast.dismiss = id => { active.delete(id) }
  const { DocumentLocale } = loadTs(new URL('../app/components/DocumentLocale.tsx', import.meta.url), deps)
  const { NetworkMonitor } = loadTs(new URL('../app/components/NetworkMonitor.tsx', import.meta.url), { ...deps, 'react-hot-toast': { default: toast } })
  const { default: Offline } = loadTs(new URL('../app/~offline/page.tsx', import.meta.url), deps)
  const { default: NotFound } = loadTs(new URL('../app/not-found.tsx', import.meta.url), { ...deps, 'next/link': { default: props => h('a', props) } })
  const { createRoot, hydrateRoot } = await import('react-dom/client')
  let root
  const store = deps['@/lib/locale-store']
  const unmount = async () => { if (root) { await act(() => root.unmount()); root = null } }
  t.after(async () => {
    await unmount(); dom.window.close()
    delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT
  })
  return {
    DocumentLocale, NetworkMonitor, Offline, NotFound, active, events, store, unmount,
    render: async element => { root = createRoot(document.querySelector('#root')); await act(() => root.render(element)) },
    hydrate: async element => {
      document.querySelector('#root').innerHTML = renderToString(element)
      assert.match(document.querySelector('h1').textContent, /Você está offline/)
      assert.equal(document.documentElement.lang, 'pt-BR')
      const errors = []
      await act(() => { root = hydrateRoot(document.querySelector('#root'), element, { onRecoverableError: e => errors.push(e) }) })
      assert.deepEqual(errors, [])
    },
    locale: locale => act(() => store.setLocale(locale)),
    connection: value => act(() => { online = value; window.dispatchEvent(new window.Event(value ? 'online' : 'offline')) }),
  }
}

test('offline hidrata português com preferência inglesa e sincroniza documento e metadados', async t => {
  const ui = await fixture(t, { savedLocale: 'en' })
  await ui.hydrate(h(React.Fragment, null, h(ui.DocumentLocale), h(ui.Offline)))
  assert.equal(document.documentElement.lang, 'en')
  assert.equal(document.querySelector('h1').textContent.trim(), "You're offline")
  assert.match(document.querySelector('meta[name="description"]').content, /Construction/)
  assert.equal(document.querySelector('link[rel="manifest"]').getAttribute('href'), '/manifest-en.json')
  assert.equal(document.querySelector('main a').getAttribute('href'), '/')
  await ui.locale('pt-BR')
  assert.equal(document.documentElement.lang, 'pt-BR')
  assert.equal(document.querySelector('link[rel="manifest"]').getAttribute('href'), '/manifest.json')
  assert.match(document.querySelector('meta[name="description"]').content, /Gestão/)
  assert.match(document.querySelector('h1').textContent, /Você está offline/)
})

test('documento acompanha outra aba e seletor funciona sem armazenamento', async t => {
  const ui = await fixture(t)
  await ui.render(h(React.Fragment, null, h(ui.DocumentLocale), h(ui.Offline)))
  await act(() => {
    window.localStorage.setItem('obra-certa:locale', 'en')
    window.dispatchEvent(new window.StorageEvent('storage', { key: 'obra-certa:locale', newValue: 'en' }))
  })
  assert.equal(document.documentElement.lang, 'en')
  await act(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked') } })
    const select = document.querySelector('select'); select.value = 'pt-BR'
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  assert.equal(document.documentElement.lang, 'pt-BR')
  assert.match(document.querySelector('h1').textContent, /Você está offline/)
})

test('aviso offline persistente muda de idioma no mesmo ID e só reconexão real mostra sucesso', async t => {
  const ui = await fixture(t, { online: false, savedLocale: 'en' })
  await ui.render(h(React.StrictMode, null, h(ui.NetworkMonitor)))
  assert.equal(ui.active.size, 2)
  assert.equal(ui.active.get('network-status').message.props.lang, 'en')
  assert.match(ui.active.get('network-status').message.props.children, /You're offline/)
  assert.equal(ui.active.get('network-status').options.duration, Infinity)
  await ui.locale('pt-BR')
  assert.equal(ui.active.size, 2)
  assert.match(ui.active.get('network-status').message.props.children, /Você está offline/)
  assert.equal(ui.events.filter(e => e.type === 'success').length, 0)
  const before = ui.events.length
  await ui.connection(false)
  assert.equal(ui.events.length, before)
  await ui.connection(true)
  assert.equal(ui.events.at(-1).type, 'success')
  assert.equal(ui.events.at(-1).options.duration, 4000)
  assert.equal(ui.events.at(-1).options.style.background, '#fff')
  const restored = ui.events.length
  await ui.locale('en'); await ui.connection(true)
  assert.equal(ui.events.length, restored)
  await ui.unmount()
  assert.deepEqual([...ui.active.keys()], ['other-notice'])
  await ui.connection(false); await ui.locale('pt-BR')
  assert.equal(ui.events.length, restored)
})

test('montagem online é silenciosa e aviso novo usa idioma atual', async t => {
  const ui = await fixture(t)
  await ui.render(h(ui.NetworkMonitor))
  assert.equal(ui.events.length, 0)
  await ui.locale('en'); await ui.connection(false)
  assert.equal(ui.events.at(-1).message.props.lang, 'en')
})

test('404 tem rótulos e link traduzidos sem alterar destino', async t => {
  const ui = await fixture(t, { blockedStorage: true })
  await ui.render(h(React.Fragment, null, h(ui.DocumentLocale), h(ui.NotFound)))
  assert.equal(document.querySelector('h1').textContent, 'Página não encontrada')
  await ui.locale('en')
  assert.equal(document.querySelector('h1').textContent, 'Page not found')
  assert.equal(document.querySelector('main a').getAttribute('href'), '/')
})

test('manifestos compartilham identidade, entrada, escopo e ícones, alterando só idioma e descrição', () => {
  const pt = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'))
  const en = JSON.parse(readFileSync(new URL('../public/manifest-en.json', import.meta.url), 'utf8'))
  assert.equal(pt.id, '/login')
  assert.equal(pt.id, pt.start_url)
  assert.equal(pt.lang, 'pt-BR'); assert.equal(en.lang, 'en')
  assert.match(en.description, /Construction/)
  const identity = manifest => Object.fromEntries(Object.entries(manifest).filter(([key]) => !['lang', 'description'].includes(key)))
  assert.deepEqual(identity(en), identity(pt))
})
