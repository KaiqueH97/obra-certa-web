import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { loadTs } from './load-ts.mjs'

// Instância nova por montagem: a preferência de uma fixture não vaza para outra.
export function createI18nDependencies() {
  const base = { react: React, 'react/jsx-runtime': jsx }
  const i18n = loadTs(new URL('../../lib/i18n.ts', import.meta.url))
  const store = loadTs(new URL('../../lib/locale-store.ts', import.meta.url), { './i18n': i18n })
  const hooks = loadTs(new URL('../../app/hooks/useLocale.ts', import.meta.url), {
    ...base, '@/lib/i18n': i18n, '@/lib/locale-store': store,
  })
  const switcher = loadTs(new URL('../../app/components/LanguageSwitcher.tsx', import.meta.url), {
    ...base, '@/lib/i18n': i18n, '@/app/hooks/useLocale': hooks,
  })
  return { '@/lib/i18n': i18n, '@/lib/locale-store': store, '@/app/hooks/useLocale': hooks, '@/app/components/LanguageSwitcher': switcher }
}
