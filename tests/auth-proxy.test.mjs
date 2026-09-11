import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { NextRequest, NextResponse } = require('next/server')
// O Next 16.2.3 instalado ainda exporta o utilitário com o nome antigo.
const { unstable_doesMiddlewareMatch } = require('next/experimental/testing/server')
const { outputText } = ts.transpileModule(
  readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
)

function fixture(getUser = async () => ({ data: { user: null }, error: null })) {
  const exports = {}
  let calls = 0
  vm.runInNewContext(outputText, {
    exports, URL, Headers,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://auth.example', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test' } },
    require(name) {
      if (name === 'next/server') return { NextResponse }
      assert.equal(name, '@supabase/ssr')
      return {
        createServerClient(_url, _key, { cookies }) {
          return { auth: { getUser: () => { calls++; return getUser(cookies) } } }
        },
      }
    },
  })
  return { ...exports, calls: () => calls }
}

const cacheHeaders = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0', Pragma: 'no-cache',
}
const freshCookie = {
  name: 'sb-test-auth-token', value: 'renewed',
  options: { path: '/', secure: true, httpOnly: true, sameSite: 'lax', maxAge: 3600 },
}
const userResponse = { data: { user: { id: 'user-a' } }, error: null }
const request = path => new NextRequest(`https://app.example${path}`)
const matches = (config, url) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })

test('todas as páginas do grupo sistema passam pelo proxy e exigem sessão', async () => {
  const f = fixture()
  const walk = (directory, parts = []) => {
    const paths = []
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) paths.push(...walk(new URL(`${entry.name}/`, directory), [...parts, entry.name]))
      if (entry.name === 'page.tsx') {
        paths.push('/' + parts.filter(p => !p.startsWith('(')).map(p => p.startsWith('[') ? '123.png' : p).join('/'))
      }
    }
    return paths
  }
  const paths = walk(new URL('../app/(sistema)/', import.meta.url))
  assert.ok(paths.length >= 5)
  for (const path of paths) {
    assert.equal(matches(f.config, path), true, path)
    const response = await f.proxy(request(path))
    assert.equal(response.status, 307, path)
    assert.equal(response.headers.get('location'), 'https://app.example/login')
  }
})

for (const path of ['/projetos/123.png', '/projetos/123.svg', '/projetos/1/subpasta', '/projetos/', '/perfil', '/home?_rsc=123']) {
  test(`protege navegação direta e RSC: ${path}`, async () => {
    const f = fixture()
    assert.equal(matches(f.config, path), true)
    const response = await f.proxy(request(path))
    assert.equal(response.headers.get('location'), 'https://app.example/login')
    assert.match(response.headers.get('cache-control'), /private.*no-store/)
  })
}

for (const path of ['/', '/projetos-publicos', '/homework', '/~offline', '/manifest.json', '/sw.js', '/worker-test.js', '/workbox-test.js', '/favicon.ico', '/logo.png', '/_next/static/test.js', '/_next/image?url=test']) {
  test(`não consulta Auth em recurso fora do escopo: ${path}`, async () => {
    const f = fixture()
    assert.equal(matches(f.config, path), false)
    assert.equal((await f.proxy(request(path))).status, 200)
    assert.equal(f.calls(), 0)
  })
}

for (const path of ['/login', '/cadastro']) {
  test(`${path}: cookie renovado e cabeçalhos do Supabase sobrevivem ao redirect`, async () => {
    const f = fixture(async cookies => {
      cookies.setAll([freshCookie], { ...cacheHeaders, 'X-Auth-Test': 'preserved' })
      return userResponse
    })
    const response = await f.proxy(request(`${path}?next=https://evil.example&code=private`))
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), 'https://app.example/home')
    assert.equal(response.headers.get('x-auth-test'), 'preserved')
    const cookie = response.cookies.get(freshCookie.name)
    for (const [key, value] of Object.entries(freshCookie.options)) assert.equal(cookie[key], value)
    assert.equal(cookie.value, 'renewed')
    assert.equal(response.headers.get('cache-control'), cacheHeaders['Cache-Control'])
    assert.equal(response.headers.get('expires'), '0')
    assert.equal(response.headers.get('pragma'), 'no-cache')
    assert.equal(response.headers.has('x-middleware-request-cookie'), false)
  })
}

test('sessão renovada chega ao navegador e à requisição encaminhada', async () => {
  const f = fixture(async cookies => {
    assert.equal(cookies.getAll().find(c => c.name === freshCookie.name).value, 'old')
    cookies.setAll([freshCookie], cacheHeaders)
    return userResponse
  })
  const req = new NextRequest('https://app.example/home', { headers: { cookie: `${freshCookie.name}=old` } })
  const response = await f.proxy(req)
  assert.equal(response.status, 200)
  assert.equal(req.cookies.get(freshCookie.name).value, 'renewed')
  assert.equal(response.cookies.get(freshCookie.name).value, 'renewed')
  assert.match(response.headers.get('x-middleware-request-cookie'), /sb-test-auth-token=renewed/)
})

test('remoção de cookie de sessão inválida chega ao navegador ao redirecionar', async () => {
  const f = fixture(async cookies => {
    cookies.setAll([{ ...freshCookie, value: '', options: { path: '/', maxAge: 0 } }], cacheHeaders)
    return { data: { user: null }, error: { status: 401 } }
  })
  const response = await f.proxy(request('/equipe'))
  assert.equal(response.headers.get('location'), 'https://app.example/login')
  assert.equal(response.cookies.get(freshCookie.name).value, '')
  assert.equal(response.cookies.get(freshCookie.name).maxAge, 0)
})

test('várias chamadas a setAll preservam cookies anteriores e a última versão de cada cookie', async () => {
  const f = fixture(async cookies => {
    cookies.setAll([freshCookie, { name: 'chunk-old', value: '', options: { path: '/', maxAge: 0 } }], cacheHeaders)
    cookies.setAll([{ ...freshCookie, value: 'latest' }], {})
    return userResponse
  })
  const response = await f.proxy(request('/login'))
  assert.equal(response.cookies.get(freshCookie.name).value, 'latest')
  assert.equal(response.cookies.get('chunk-old').maxAge, 0)
  assert.match(response.headers.get('cache-control'), /no-store/)
})

test('cookie com aparência de sessão não autoriza sem confirmação do Auth', async () => {
  const f = fixture()
  const req = new NextRequest('https://app.example/home', { headers: { cookie: 'sb-test-auth-token=forged' } })
  assert.equal((await f.proxy(req)).status, 307)
  assert.equal(f.calls(), 1)
})

test('retorno com usuário e erro não libera rota protegida', async () => {
  const f = fixture(async () => ({ data: userResponse.data, error: { status: 401 } }))
  assert.equal((await f.proxy(request('/home'))).status, 307)
})

for (const behavior of [
  async () => { throw new TypeError('Failed to fetch') },
  async () => ({ data: { user: null }, error: { status: 503 } }),
  async () => ({ data: { user: null }, error: { status: 408 } }),
  async () => ({ data: { user: null }, error: { status: 429 } }),
  async () => ({ data: { user: null }, error: { status: 0 } }),
]) {
  test('Auth indisponível: bloqueia página privada com 503 sem forçar logout', async () => {
    const f = fixture(behavior)
    const response = await f.proxy(request('/projetos'))
    assert.equal(response.status, 503)
    assert.equal(response.headers.has('location'), false)
    assert.equal(response.cookies.getAll().length, 0)
    assert.match(response.headers.get('cache-control'), /no-store/)
    assert.equal(response.headers.get('retry-after'), '30')
    assert.match(await response.text(), /validar sua sessão/)
  })
}

test('login e recuperação continuam disponíveis quando o Auth lança exceção', async () => {
  const f = fixture(async () => { throw new Error('unavailable') })
  for (const path of ['/login', '/cadastro', '/recuperar', '/redefinir-senha']) {
    assert.equal(matches(f.config, path), true)
    assert.equal((await f.proxy(request(path))).status, 200)
  }
})

test('páginas de recuperação aceitam sessão autenticada e preservam renovação', async () => {
  const f = fixture(async cookies => {
    cookies.setAll([freshCookie], cacheHeaders)
    return userResponse
  })
  for (const path of ['/recuperar', '/redefinir-senha']) {
    const response = await f.proxy(request(path))
    assert.equal(response.status, 200)
    assert.equal(response.cookies.get(freshCookie.name).value, 'renewed')
  }
})
