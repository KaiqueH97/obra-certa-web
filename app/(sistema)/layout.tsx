"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat, LayoutDashboard, Calculator, FolderKanban, Settings, LogOut, Users } from "lucide-react";

export default function SistemaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Função auxiliar para saber qual menu está ativo e pintá-lo de laranja
  const isActive = (path: string) => pathname?.startsWith(path);

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden font-sans">
      
      {/* 1. SIDEBAR DESKTOP (Aparece apenas em telas médias para cima: md:flex) */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-900 text-zinc-300 border-r border-zinc-800 transition-all">
        <div className="p-6 flex items-center gap-3 text-orange-500 font-bold text-xl border-b border-zinc-800">
          <HardHat size={28} />
          <span className="text-white">Obra Certa</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link 
            href="/home" 
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive('/home') ? 'bg-orange-600/10 text-orange-500 font-medium' : 'hover:bg-zinc-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} /> Início
          </Link>
          <Link 
            href="/projetos" 
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive('/projetos') ? 'bg-orange-600/10 text-orange-500 font-medium' : 'hover:bg-zinc-800 hover:text-white'}`}
          >
            <FolderKanban size={20} /> Projetos
          </Link>
          <Link 
            href="/calcular" 
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive('/calcular') ? 'bg-orange-600/10 text-orange-500 font-medium' : 'hover:bg-zinc-800 hover:text-white'}`}
          >
            <Calculator size={20} /> Calculadora
          </Link>
          <Link 
            href="/equipe" 
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive('/equipe') ? 'bg-orange-600/10 text-orange-500 font-medium' : 'hover:bg-zinc-800 hover:text-white'}`}
          >
            <Users size={20} /> Equipe
          </Link>
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <Link 
            href="/perfil" 
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors mb-2 ${isActive('/perfil') ? 'bg-orange-600/10 text-orange-500 font-medium' : 'hover:bg-zinc-800 hover:text-white'}`}
          >
            <Settings size={20} /> Perfil
          </Link>
          <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors text-left">
            <LogOut size={20} /> Sair
          </button>
        </div>
      </aside>

      {/* 2. ÁREA PRINCIPAL (Desktop e Mobile) */}
      <main className="flex-1 flex flex-col h-full relative">
        
        {/* HEADER MOBILE (Aparece apenas em telas pequenas: md:hidden) */}
        <header className="md:hidden flex items-center justify-center p-4 bg-zinc-900 text-white shadow-sm z-10 relative">
          <div className="flex items-center gap-2 text-orange-500 font-bold">
            <HardHat size={24} />
            <span className="text-white">Obra Certa</span>
          </div>
        </header>

        {/* CONTEÚDO DINÂMICO (As páginas em si) 
            Nota: pb-24 no mobile para o conteúdo não ficar escondido atrás da Bottom Nav
        */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </div>

        {/* 3. BOTTOM NAV MOBILE (Fixo no rodapé apenas em telas pequenas) */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-zinc-200 flex justify-around items-center p-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
          <Link href="/home" className={`flex flex-col items-center p-2 rounded-xl transition-colors ${isActive('/home') ? 'text-orange-600' : 'text-zinc-500 hover:text-zinc-900'}`}>
            <LayoutDashboard size={24} />
            <span className="text-[10px] font-medium mt-1">Início</span>
          </Link>
          <Link href="/projetos" className={`flex flex-col items-center p-2 rounded-xl transition-colors ${isActive('/projetos') ? 'text-orange-600' : 'text-zinc-500 hover:text-zinc-900'}`}>
            <FolderKanban size={24} />
            <span className="text-[10px] font-medium mt-1">Projetos</span>
          </Link>
          <Link href="/calcular" className={`flex flex-col items-center p-2 rounded-xl transition-colors ${isActive('/calcular') ? 'text-orange-600' : 'text-zinc-500 hover:text-zinc-900'}`}>
            <Calculator size={24} />
            <span className="text-[10px] font-medium mt-1">Calcular</span>
          </Link>
          <Link href="/equipe" className={`flex flex-col items-center p-2 rounded-xl transition-colors ${isActive('/equipe') ? 'text-orange-600' : 'text-zinc-500 hover:text-zinc-900'}`}>
            <Users size={24} />
            <span className="text-[10px] font-medium mt-1">Equipe</span>
          </Link>
          <Link href="/perfil" className={`flex flex-col items-center p-2 rounded-xl transition-colors ${isActive('/perfil') ? 'text-orange-600' : 'text-zinc-500 hover:text-zinc-900'}`}>
            <Settings size={24} />
            <span className="text-[10px] font-medium mt-1">Perfil</span>
          </Link>
        </nav>

      </main>
    </div>
  );
}