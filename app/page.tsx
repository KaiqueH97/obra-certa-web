"use client";

import { useState } from "react";
import Link from "next/link";
import { HardHat, Ruler, Smartphone, Calculator, ArrowRight, Lock } from "lucide-react";
import toast from "react-hot-toast";

export default function LandingPage() {
  // Estados para a calculadora isca
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  
  // Regra de negócio simples: ~25 tijolos baianos (8 furos) por m² (com margem)
  const area = (parseFloat(largura) || 0) * (parseFloat(altura) || 0);
  const quantidadeTijolos = Math.ceil(area * 25);

  const handleSalvarSimulacao = () => {
    // Aqui está o gatilho psicológico! O usuário quer salvar, mas precisa logar.
    toast("Crie uma conta gratuita para salvar seus cálculos e criar projetos completos!", {
      icon: '🔒',
      duration: 5000,
      style: {
        borderRadius: '10px',
        background: '#333',
        color: '#fff',
      },
    });
  };

  return (
    <main className="flex min-h-screen flex-col bg-zinc-50 font-sans">
      {/* Header */}
      <header className="flex w-full items-center justify-between p-6 bg-white shadow-sm border-b border-zinc-100">
        <div className="flex items-center gap-2 text-orange-600">
          <HardHat size={28} />
          <span className="text-xl font-bold text-zinc-900 tracking-tight">Obra Certa</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-zinc-600 hover:text-orange-600 transition-colors hidden sm:block">
            Já tenho conta
          </Link>
          <Link href="/cadastro" className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors">
            Cadastre-se
          </Link>
        </div>
      </header>

      {/* Hero Section com Calculadora Interativa */}
      <section className="flex flex-col lg:flex-row items-center justify-center p-6 lg:p-20 gap-12 max-w-7xl mx-auto">
        
        {/* Lado Esquerdo: Copywriting */}
        <div className="flex-1 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            Projeto 16ª FETEPS
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl mb-6 leading-tight">
            O caderninho digital do seu <span className="text-orange-600">canteiro de obras</span>.
          </h1>
          <p className="text-lg text-zinc-600 mb-8 max-w-xl mx-auto lg:mx-0">
            Calcule materiais em segundos, evite desperdícios e tenha o controle da sua obra na palma da mão, mesmo sem internet. Experimente ao lado!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link href="/cadastro" className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white text-lg font-semibold py-4 px-8 rounded-xl transition-transform hover:scale-105">
              Criar Conta Gratuita <ArrowRight size={20} />
            </Link>
          </div>
        </div>

        {/* Lado Direito: A "Calculadora Isca" */}
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-zinc-100 relative overflow-hidden">
          {/* Detalhe de UI */}
          <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-orange-400 to-orange-600"></div>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
              <Calculator size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Calculadora Rápida</h2>
              <p className="text-sm text-zinc-500">Teste agora: Tijolo Baiano (8 furos)</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Largura da Parede (m)</label>
              <input 
                type="number" 
                value={largura}
                onChange={(e) => setLargura(e.target.value)}
                placeholder="Ex: 4.5"
                className="w-full p-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all placeholder-zinc-900 text-zinc-900 font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Altura da Parede (m)</label>
              <input 
                type="number" 
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                placeholder="Ex: 3.0"
                className="w-full p-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all placeholder-zinc-900 text-zinc-900 font-medium"
              />
            </div>
          </div>

          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-zinc-600">Área total:</span>
              <span className="font-semibold text-zinc-900">{area > 0 ? area.toFixed(2) : "0.00"} m²</span>
            </div>
            <div className="flex justify-between items-center text-lg">
              <span className="font-bold text-zinc-900">Tijolos necessários:</span>
              <span className="font-extrabold text-orange-600">{quantidadeTijolos > 0 ? quantidadeTijolos : "0"} un.</span>
            </div>
          </div>

          <button 
            onClick={handleSalvarSimulacao}
            className="w-full flex items-center justify-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold py-3 rounded-xl transition-colors"
          >
            <Lock size={18} /> Salvar no meu Projeto
          </button>
        </div>
      </section>

      {/* Seção de Features */}
      <section className="bg-white py-20 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-zinc-900 mb-4">Feito para a realidade da obra</h2>
            <p className="text-lg text-zinc-600">Esqueça sistemas complicados. O Obra Certa foi desenhado para quem está com a mão na massa.</p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            <div className="bg-zinc-50 p-8 rounded-2xl border border-zinc-100 hover:border-orange-200 transition-colors">
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-6">
                <Ruler size={28} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-3">Sem desperdícios</h3>
              <p className="text-zinc-600 leading-relaxed">Faça múltiplas medições, some áreas e saiba exatamente quanto material comprar, economizando dinheiro do cliente.</p>
            </div>
            
            <div className="bg-zinc-50 p-8 rounded-2xl border border-zinc-100 hover:border-orange-200 transition-colors">
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-6">
                <Smartphone size={28} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-3">100% no Celular</h3>
              <p className="text-zinc-600 leading-relaxed">Botões grandes, contrastes fortes e navegação simples. Criado para ser usado com facilidade no meio do canteiro.</p>
            </div>
            
            <div className="bg-zinc-50 p-8 rounded-2xl border border-zinc-100 hover:border-orange-200 transition-colors">
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-6">
                <HardHat size={28} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-3">Funciona Offline</h3>
              <p className="text-zinc-600 leading-relaxed">A internet da obra caiu? Você continua calculando e anotando. O app sincroniza tudo automaticamente quando a rede voltar.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}