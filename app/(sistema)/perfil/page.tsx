"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { User, Phone, Mail, LogOut, Shield, Save, X, HardHat, Key } from "lucide-react";

export default function Perfil() {
  const router = useRouter();
  const [nome, setNome] = useState<string>("Carregando...");
  const [email, setEmail] = useState<string>("...");  
  const [telefone, setTelefone] = useState<string>(""); 
  
  const [editando, setEditando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const carregarUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? "E-mail não encontrado");
        
        const nomeAtual = user.user_metadata?.nome || "Usuário";
        const telefoneAtual = user.user_metadata?.telefone || ""; 
        
        setNome(nomeAtual);
        setNovoNome(nomeAtual);
        setTelefone(telefoneAtual);
        setNovoTelefone(telefoneAtual);
      }
    };
    
    carregarUsuario();
  }, []);

  const handleSalvarDados = async () => {
    if (!novoNome.trim()) {
      toast.error("O nome não pode ficar vazio.");
      return;
    }

    setSalvando(true);
    const toastId = toast.loading("Salvando seus dados...");
    const { error } = await supabase.auth.updateUser({
      data: { 
        nome: novoNome,
        telefone: novoTelefone
      }
    });

    if (error) {
      toast.error("Erro ao atualizar os dados: " + error.message, { id: toastId });
    } else {
      setNome(novoNome);
      setTelefone(novoTelefone);
      setEditando(false);
      toast.success("Dados atualizados com sucesso!", { id: toastId });
    }
    
    setSalvando(false);
  };

  const handleSair = async () => {
    const toastId = toast.loading("Saindo do sistema...");
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.", { id: toastId });
    router.push("/login");
  };

  // Função auxiliar para pegar as iniciais do nome para o Avatar
  const getIniciais = (nomeCompleto: string) => {
    if (nomeCompleto === "Carregando..." || nomeCompleto === "Usuário") return "OC";
    const partes = nomeCompleto.trim().split(" ");
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">Meu Perfil</h1>
          <p className="text-sm md:text-base text-zinc-500 mt-1">Gerencie suas informações e preferências do sistema.</p>
        </div>
      </div>

      {/* GRID DE MÓDULOS (1 coluna no mobile, 3 no desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: CRACHÁ E AÇÕES RÁPIDAS */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 flex flex-col items-center text-center">
            
            {/* Avatar Dinâmico */}
            <div className="w-24 h-24 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-3xl font-black mb-4 ring-4 ring-white shadow-md">
              {getIniciais(nome)}
            </div>
            
            <h2 className="text-xl font-bold text-zinc-900 mb-1">{nome}</h2>
            <p className="text-sm font-medium text-zinc-500 flex items-center gap-1">
              <HardHat size={16} /> Profissional da Obra
            </p>

            <div className="w-full h-px bg-zinc-100 my-6"></div>

            <button
              onClick={handleSair}
              className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold p-3 rounded-xl transition-colors"
            >
              <LogOut size={20} /> Sair do Sistema
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA: FORMULÁRIOS E CONFIGURAÇÕES */}
        <div className="md:col-span-2 space-y-6">
          
          {/* MÓDULO 1: DADOS PESSOAIS */}
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-4 md:p-6 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
              <User size={20} className="text-orange-600" />
              <h3 className="font-bold text-zinc-900 text-lg">Dados Pessoais</h3>
            </div>
            
            <div className="p-4 md:p-6">
              {!editando ? (
                /* MODO VISUALIZAÇÃO */
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Nome Completo</label>
                      <p className="text-zinc-900 font-medium text-lg mt-1">{nome}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1">
                        <Phone size={14} /> WhatsApp
                      </label>
                      <p className="text-zinc-900 font-medium text-lg mt-1">
                        {telefone || <span className="text-zinc-400 italic">Não informado</span>}
                      </p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-zinc-100 flex justify-end">
                    <button 
                      onClick={() => setEditando(true)}
                      className="bg-zinc-900 text-white px-6 py-2.5 rounded-xl hover:bg-zinc-800 transition-colors shadow-sm font-medium"
                    >
                      Editar Dados
                    </button>
                  </div>
                </div>
              ) : (
                /* MODO EDIÇÃO */
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <label className="block text-zinc-700 text-sm font-bold mb-2">Nome Completo</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-zinc-300 rounded-xl text-zinc-900 focus:ring-2 focus:ring-orange-600 outline-none transition-all disabled:bg-zinc-100"
                      value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)}
                      placeholder="Ex: João da Silva"
                      disabled={salvando}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-zinc-700 text-sm font-bold mb-2">WhatsApp de Contato</label>
                    <input
                      type="tel"
                      className="w-full p-3 border border-zinc-300 rounded-xl text-zinc-900 focus:ring-2 focus:ring-orange-600 outline-none transition-all disabled:bg-zinc-100"
                      value={novoTelefone}
                      onChange={(e) => setNovoTelefone(e.target.value)}
                      placeholder="(11) 90000-0000"
                      disabled={salvando}
                    />
                    <p className="text-xs text-zinc-500 mt-2">
                      Este número será usado para formatar suas mensagens de orçamento no WhatsApp.
                    </p>
                  </div>

                  <div className="pt-4 flex gap-2 justify-end">
                    <button 
                      onClick={() => {
                        setEditando(false);
                        setNovoNome(nome);
                        setNovoTelefone(telefone);
                      }}
                      disabled={salvando}
                      className="px-6 py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-xl hover:bg-zinc-200 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <X size={18} /> Cancelar
                    </button>
                    <button 
                      onClick={handleSalvarDados}
                      disabled={salvando}
                      className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                      <Save size={18} /> {salvando ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MÓDULO 2: SEGURANÇA */}
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-4 md:p-6 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
              <Shield size={20} className="text-orange-600" />
              <h3 className="font-bold text-zinc-900 text-lg">Segurança de Acesso</h3>
            </div>
            
            <div className="p-4 md:p-6 space-y-6">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1">
                  <Mail size={14} /> E-mail da Conta
                </label>
                <div className="mt-2 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <p className="text-zinc-700 font-medium">{email}</p>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  O e-mail não pode ser alterado por aqui. Entre em contato com o suporte se precisar atualizar.
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-zinc-900 text-sm">Senha de Acesso</h4>
                  <p className="text-xs text-zinc-500 mt-1">Sua senha é protegida por criptografia de ponta a ponta.</p>
                </div>
                <button 
                  onClick={() => router.push('/redefinir-senha')}
                  className="flex items-center gap-2 bg-orange-50 text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-100 transition-colors font-medium text-sm"
                >
                  <Key size={16} /> Redefinir
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}