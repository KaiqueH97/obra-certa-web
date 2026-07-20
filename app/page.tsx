"use client";

import { useState } from "react";
import Link from "next/link";
import { HardHat, Ruler, Smartphone, Calculator, ArrowRight, Lock, Wallet, Users } from "lucide-react";
import toast from "react-hot-toast";

export default function LandingPage() {
  // Estados para a calculadora isca
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  
  // Regra de negócio simples: ~25 tijolos baianos (8 furos) por m² (com margem)
  const area = (parseFloat(largura) || 0) * (parseFloat(altura) || 0);
  const quantidadeTijolos = Math.ceil(area * 25);

  const handleSalvarSimulacao = () => {
    // Gatilho psicológico para conversão de usuários
    toast("Crie uma conta gratuita para salvar seus cálculos e criar projetos completos!", {
      icon: '🔒',
      duration: 5000,
      style: {
        borderRadius: '10px',
        background: '#27272a', // zinc-800 para melhor contraste
        color: '#fff',
      },
    });
  };

  return (
    <main className="flex min-h-screen flex-col bg-zinc-50 font-sans">
      {/* Header */}
      <header className="flex w-full items-center justify-between p-4 sm:p-6 bg-white shadow-sm border-b border-zinc-200">
        <div className="flex items-center gap-2 text-orange-600">
          <HardHat size={24} className="sm:w-7 sm:h-7" />
          <span className="text-lg sm:text-xl font-extrabold text-zinc-900 tracking-tight">Obra Certa</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link 
            href="/login" 
            className="text-sm font-bold text-zinc-700 hover:text-orange-600 transition-colors"
          >
            Entrar
          </Link>
          <Link 
            href="/cadastro" 
            className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold py-2 px-3 sm:px-4 rounded-xl transition-colors shadow-sm"
          >
            Criar Conta
          </Link>
        </div>
      </header>

      {/* Hero Section com Calculadora Interativa */}
      <section className="flex flex-col lg:flex-row items-center justify-center p-6 lg:p-20 gap-12 max-w-7xl mx-auto">
        
        {/* Lado Esquerdo: Copywriting Atualizado */}
        <div className="flex-1 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 text-orange-800 text-xs font-black uppercase tracking-wider mb-6 border border-orange-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-600"></span>
            </span>
            Projeto 16ª FETEPS
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl mb-6 leading-tight">
            Gestão inteligente para o seu <span className="text-orange-600">canteiro de obras</span>.
          </h1>
          <p className="text-lg text-zinc-700 mb-8 max-w-xl mx-auto lg:mx-0 font-medium">
            Calcule materiais, controle o caixa da obra, gerencie a sua equipe e evite desperdícios. Tudo na palma da sua mão.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link href="/cadastro" className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white text-lg font-bold py-4 px-8 rounded-xl transition-transform hover:scale-105 shadow-md">
              Criar Conta Gratuita <ArrowRight size={20} />
            </Link>
          </div>
        </div>

        {/* Lado Direito: A "Calculadora Isca" (Ajustes de contraste nos inputs) */}
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-zinc-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-orange-400 to-orange-600"></div>
          
          <div className="flex items-center gap-3 mb-6 mt-2">
            <div className="bg-orange-100 p-2.5 rounded-xl text-orange-600">
              <Calculator size={24} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-zinc-900">Calculadora Rápida</h2>
              <p className="text-sm font-medium text-zinc-600">Teste agora: Tijolo Baiano (8 furos)</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Largura da Parede (m)</label>
              <input 
                type="number" 
                value={largura}
                onChange={(e) => setLargura(e.target.value)}
                placeholder="Ex: 4.5"
                className="w-full p-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-orange-600 outline-none transition-all placeholder-zinc-400 text-zinc-900 font-bold bg-zinc-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Altura da Parede (m)</label>
              <input 
                type="number" 
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                placeholder="Ex: 3.0"
                className="w-full p-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-orange-600 outline-none transition-all placeholder-zinc-400 text-zinc-900 font-bold bg-zinc-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="bg-zinc-100 p-5 rounded-xl border border-zinc-200 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-zinc-600">Área total:</span>
              <span className="font-extrabold text-zinc-900">{area > 0 ? area.toFixed(2) : "0.00"} m²</span>
            </div>
            <div className="flex justify-between items-center text-lg">
              <span className="font-extrabold text-zinc-900">Tijolos necessários:</span>
              <span className="font-black text-orange-600">{quantidadeTijolos > 0 ? quantidadeTijolos : "0"} un.</span>
            </div>
          </div>

          <button 
            onClick={handleSalvarSimulacao}
            className="w-full flex items-center justify-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-800 font-bold py-4 rounded-xl transition-colors"
          >
            <Lock size={18} /> Salvar no meu Projeto
          </button>
        </div>
      </section>

      {/* Seção de Features - Agora com as Novas Funcionalidades */}
      <section className="bg-white py-24 px-6 border-t border-zinc-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-zinc-900 mb-4 tracking-tight">Um sistema completo para a sua realidade</h2>
            <p className="text-lg text-zinc-700 font-medium max-w-2xl mx-auto">Esqueça sistemas complicados. O Obra Certa foi desenhado com inteligência para quem está com a mão na massa.</p>
          </div>
          
          {/* Novo Grid com 4 colunas em telas grandes */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            
            {/* Feature 1 */}
            <div className="bg-zinc-50 p-8 rounded-2xl border border-zinc-200 hover:border-orange-300 hover:shadow-md transition-all">
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-6 border border-orange-200">
                <Ruler size={28} />
              </div>
              <h3 className="text-xl font-extrabold text-zinc-900 mb-3">Orçamentos Precisos</h3>
              <p className="text-zinc-700 font-medium leading-relaxed text-sm">Calcule materiais com margem de segurança, some áreas e saiba exatamente quanto comprar, economizando dinheiro do cliente.</p>
            </div>

            {/* Feature 2 (NOVA) */}
            <div className="bg-zinc-50 p-8 rounded-2xl border border-zinc-200 hover:border-emerald-300 hover:shadow-md transition-all">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mb-6 border border-emerald-200">
                <Wallet size={28} />
              </div>
              <h3 className="text-xl font-extrabold text-zinc-900 mb-3">Fluxo de Caixa</h3>
              <p className="text-zinc-700 font-medium leading-relaxed text-sm">Controle as entradas de dinheiro do cliente e as saídas de materiais de forma visual. Saiba o lucro exato de cada obra em tempo real.</p>
            </div>

            {/* Feature 3 (NOVA) */}
            <div className="bg-zinc-50 p-8 rounded-2xl border border-zinc-200 hover:border-blue-300 hover:shadow-md transition-all">
              <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mb-6 border border-blue-200">
                <Users size={28} />
              </div>
              <h3 className="text-xl font-extrabold text-zinc-900 mb-3">Gestão de Equipe</h3>
              <p className="text-zinc-700 font-medium leading-relaxed text-sm">Cadastre seus profissionais, defina o valor das diárias e automatize o pagamento da sua equipe direto no caixa do projeto.</p>
            </div>
            
            {/* Feature 4 */}
            <div className="bg-zinc-50 p-8 rounded-2xl border border-zinc-200 hover:border-green-300 hover:shadow-md transition-all">
              <div className="w-14 h-14 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-6 border border-green-200">
                <Smartphone size={28} />
              </div>
              <h3 className="text-xl font-extrabold text-zinc-900 mb-3">Direto no WhatsApp</h3>
              <p className="text-zinc-700 font-medium leading-relaxed text-sm">Gere listas organizadas e envie a relação de materiais diretamente para o WhatsApp do lojista ou do cliente com um clique.</p>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}