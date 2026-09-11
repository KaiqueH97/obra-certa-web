import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const protectedRoots = ['/home', '/projetos', '/calcular', '/perfil', '/equipe']
const authPages = ['/login', '/cadastro']
const recoveryPages = ['/recuperar', '/redefinir-senha']

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/$/, '') || '/'
  const isProtected = protectedRoots.some(root => pathname === root || pathname.startsWith(`${root}/`))
  const isAuthPage = authPages.includes(pathname)

  if (!isProtected && !isAuthPage && !recoveryPages.includes(pathname)) {
    return NextResponse.next()
  }

  // Monta a resposta somente após validar a sessão, preservando todas as escritas
  // de cookies, inclusive remoções e renovações que antecedem um redirecionamento.
  const pendingCookies = new Map<string, { name: string; value: string; options: CookieOptions }>()
  const responseHeaders = new Headers({
    'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
    Expires: '0',
    Pragma: 'no-cache',
  })

  const completeResponse = (response: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    responseHeaders.forEach((value, name) => response.headers.set(name, value))
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(cookie => {
            request.cookies.set(cookie.name, cookie.value)
            pendingCookies.set(cookie.name, cookie)
          })
          Object.entries(headers).forEach(([name, value]) => responseHeaders.set(name, value))
        },
      },
    },
  )

  let authenticated = false
  let authUnavailable = false
  try {
    // Valida com o Auth; a presença de um cookie não comprova uma sessão válida.
    const { data, error } = await supabase.auth.getUser()
    authenticated = !error && Boolean(data?.user)
    authUnavailable = Boolean(error && (
      !error.status || error.status === 408 || error.status === 429 || error.status >= 500
    ))
  } catch {
    authUnavailable = true
  }

  if (isProtected && authUnavailable) {
    return completeResponse(new NextResponse(
      'Não foi possível validar sua sessão. Tente atualizar a página em alguns instantes.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '30' } },
    ))
  }

  if ((isProtected && !authenticated) || (isAuthPage && authenticated)) {
    // Destino fixo: não propaga parâmetros da página anterior para login/home.
    const destination = new URL(isProtected ? '/login' : '/home', request.url)
    return completeResponse(NextResponse.redirect(destination))
  }

  return completeResponse(NextResponse.next({ request }))
}

// Literais necessários para a análise estática do Next.js. Novas rotas privadas
// devem ser acrescentadas aqui e em protectedRoots, com um teste de cobertura.
export const config = {
  matcher: [
    '/home/:path*',
    '/projetos/:path*',
    '/calcular/:path*',
    '/perfil/:path*',
    '/equipe/:path*',
    '/login',
    '/cadastro',
    '/recuperar',
    '/redefinir-senha',
  ],
}
