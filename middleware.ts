import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Prepara a resposta inicial que será manipulada
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Cria o cliente do Supabase específico para o servidor
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Atualiza os cookies da requisição para os Server Components
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          
          supabaseResponse = NextResponse.next({
            request,
          })
          
          // Anexa os novos cookies na resposta para o navegador do usuário atualizar
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. Obtém o usuário ativo (isso também renova tokens expirados automaticamente)
  const { data: { user } } = await supabase.auth.getUser()

  // 4. Mapeamento de Rotas
  const rotaAtual = request.nextUrl.pathname
  
  // Nossas rotas restritas que estão dentro do grupo (sistema)
  const rotasProtegidas = ['/home', '/projetos', '/calcular', '/perfil']
  
  // Rotas exclusivas para quem NÃO está logado
  const rotasPublicasAuth = ['/login', '/cadastro']

  const isRotaProtegida = rotasProtegidas.some(rota => rotaAtual.startsWith(rota))
  const isRotaAuth = rotasPublicasAuth.includes(rotaAtual)

  // 5. Regras de Redirecionamento
  
  // Se tentar acessar o sistema sem usuário, joga para o login
  if (isRotaProtegida && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se já tem usuário e tenta acessar login/cadastro, joga direto pro Dashboard
  if (isRotaAuth && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// 6. O 'matcher' define onde o middleware vai agir para não gastar processamento à toa
export const config = {
  matcher: [
    /*
     * Intercepta tudo, EXCETO:
     * - Arquivos de build e estáticos do Next.js
     * - A rota do nosso Service Worker e página offline
     * - Imagens, ícones e fontes
     */
    '/((?!_next/static|_next/image|~offline|manifest.json|sw.js|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}