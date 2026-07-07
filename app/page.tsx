import Link from "next/link";
import { HardHat, Ruler, Smartphone } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col bg-zinc-50">
      {/* Header Simples */}
      <header className="flex w-full items-center justify-between p-6 bg-white shadow-sm">
        <div className="flex items-center gap-2 text-orange-600">
          <HardHat size={28} />
          <span className="text-xl font-bold text-zinc-900">Obra Certa</span>
        </div>
        <Link 
          href="/login" 
          className="text-sm font-medium text-zinc-700 hover:text-orange-600 transition-colors"
        >
          Acessar Sistema
        </Link>
      </header>

      {/* Hero Section */}
      <section className="flex flex-1 flex-col items-center justify-center p-8 text-center sm:p-20">
        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl mb-6">
          O caderninho digital do seu <span className="text-orange-600">canteiro de obras</span>.
        </h1>
        <p className="max-w-xl text-lg text-zinc-600 mb-10">
          Chega de perder anotações no papel. Calcule materiais, gerencie tarefas e sincronize seus projetos com facilidade — tudo na palma da mão, mesmo sem internet.
        </p>
        
        <Link 
          href="/login"
          className="bg-orange-600 hover:bg-orange-700 text-white text-lg font-semibold py-4 px-8 rounded-xl shadow-lg transition-transform hover:scale-105"
        >
          Começar a usar agora
        </Link>
      </section>

      {/* Features Rápidas */}
      <section className="bg-white py-16 px-6 border-t border-zinc-100">
        <div className="max-w-5xl mx-auto grid gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
              <Ruler size={24} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Cálculo Inteligente</h3>
            <p className="text-sm text-zinc-600">Múltiplas medições dinâmicas de áreas para nunca faltar nem sobrar material.</p>
          </div>
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
              <Smartphone size={24} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Mobile-First</h3>
            <p className="text-sm text-zinc-600">Interface desenhada para extrema usabilidade por empreiteiros e pedreiros.</p>
          </div>
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
              <HardHat size={24} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Modo Offline</h3>
            <p className="text-sm text-zinc-600">Sem sinal na obra? Sem problemas. O app continua funcionando e sincroniza depois.</p>
          </div>
        </div>
      </section>
    </main>
  );
}