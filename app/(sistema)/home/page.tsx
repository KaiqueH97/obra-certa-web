import Link from "next/link";

export default function HomeDashboard() {
  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-md mt-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Resumo da Obra</h1>
        <p className="text-lg text-gray-600 mb-8">O que vamos fazer hoje?</p>

        <div className="flex flex-col gap-6">
          {/* Botão Projetos */}
          <Link 
            href="/projetos" 
            className="flex items-center justify-center bg-orange-600 text-white font-bold p-8 rounded-xl text-2xl shadow-md hover:bg-orange-700 transition"
          >
            Meus Projetos
          </Link>

          {/* Botão Calculadora */}
          <Link 
            href="/calcular" 
            className="flex items-center justify-center bg-slate-800 text-white font-bold p-8 rounded-xl text-2xl shadow-md hover:bg-slate-900 transition"
          >
            Calculadora de Materiais
          </Link>

          {/* Perfil */}
          <Link 
            href="/perfil" 
            className="flex items-center justify-center bg-gray-300 text-gray-800 font-bold p-6 rounded-xl text-xl shadow-sm hover:bg-gray-400 transition mt-4"
          >
            Meu Perfil
          </Link>
        </div>
      </div>
    </main>
  );
}