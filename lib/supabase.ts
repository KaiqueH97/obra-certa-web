import { createBrowserClient } from '@supabase/ssr'

// Substituímos o createClient padrão pelo createBrowserClient
// Ele faz a mesma coisa, mas sincroniza a sessão automaticamente com os Cookies do navegador
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)