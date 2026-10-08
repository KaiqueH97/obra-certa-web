"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthActions } from "@/app/components/AuthActionsProvider";
import { useDataLoad } from "@/app/hooks/useDataLoad";
import { LoadFeedback } from "@/app/components/LoadFeedback";
import { createProfileSaver, profileInitials, readProfile, type Profile, type ProfileSaveState } from "@/lib/profile";
import { User, Phone, Mail, LogOut, Shield, Save, X, HardHat, Key } from "lucide-react";

export default function Perfil() {
  const router = useRouter();
  const { logout, pending, getPending } = useAuthActions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editando, setEditando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [saveState, setSaveState] = useState<ProfileSaveState>({ status: "idle", message: null });
  const [saver] = useState(() => createProfileSaver({
    getUser: () => supabase.auth.getUser(),
    update: data => supabase.auth.updateUser({ data }),
    isAuthBusy: () => getPending() !== null,
    onState: setSaveState,
    onConfirmed: confirmed => { setProfile(confirmed); setEditando(false); },
  }));
  const feedback = useRef<HTMLDivElement>(null);
  const carregarPerfil = useCallback(async () => readProfile(await supabase.auth.getUser()), []);
  const { ready, error, retry } = useDataLoad(carregarPerfil, setProfile);
  const salvando = saveState.status === "saving";
  const bloqueado = saveState.status === "uncertain" || saveState.status === "blocked";
  const ocupado = salvando || pending !== null;

  useEffect(() => {
    saver.activate();
    return () => saver.deactivate();
  }, [saver]);

  useEffect(() => {
    if (saveState.message) feedback.current?.focus();
  }, [saveState]);

  const iniciarEdicao = () => {
    if (!profile || ocupado || bloqueado) return;
    saver.reset();
    setNovoNome(profile.nome);
    setNovoTelefone(profile.telefone);
    setEditando(true);
  };

  const handleSalvarDados = async (event: React.FormEvent) => {
    event.preventDefault();
    if (profile) await saver.save(profile.id, { nome: novoNome, telefone: novoTelefone });
  };

  if (!ready || !profile) return <section>
    <h1 className="text-2xl font-extrabold text-zinc-900">Meu Perfil</h1>
    <LoadFeedback error={error} retry={retry} />
  </section>;

  const { nome, telefone, email } = profile;

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
              {profileInitials(nome)}
            </div>
            
            <h2 className="text-xl font-bold text-zinc-900 mb-1">{nome}</h2>
            <p className="text-sm font-medium text-zinc-500 flex items-center gap-1">
              <HardHat size={16} /> Profissional da Obra
            </p>

            <div className="w-full h-px bg-zinc-100 my-6"></div>

            <button
              onClick={logout}
              disabled={pending !== null || salvando}
              className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold p-3 rounded-xl transition-colors"
            >
              <LogOut size={20} /> {pending === "logout" ? "Saindo..." : "Sair do Sistema"}
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
              {saveState.message && <div ref={feedback} tabIndex={-1}
                role={saveState.status === "success" ? "status" : "alert"}
                className="mb-4 rounded-xl border border-zinc-300 bg-zinc-50 p-4 text-zinc-900">
                <p>{saveState.message}</p>
                {bloqueado && <a href="/perfil" className="mt-3 inline-block font-bold underline">Recarregar perfil</a>}
              </div>}
              {!editando || bloqueado ? (
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
                      onClick={iniciarEdicao}
                      disabled={ocupado || bloqueado}
                      className="bg-zinc-900 text-white px-6 py-2.5 rounded-xl hover:bg-zinc-800 transition-colors shadow-sm font-medium"
                    >
                      Editar Dados
                    </button>
                  </div>
                </div>
              ) : (
                /* MODO EDIÇÃO */
                <form onSubmit={handleSalvarDados} aria-busy={salvando} className="space-y-4 animate-in fade-in">
                  {salvando && <p role="status" className="text-zinc-700">Salvando seus dados...</p>}
                  <div>
                    <label htmlFor="perfil-nome" className="block text-zinc-700 text-sm font-bold mb-2">Nome Completo</label>
                    <input
                      id="perfil-nome" type="text" autoComplete="name" required
                      className="w-full p-3 border border-zinc-300 rounded-xl text-zinc-900 focus:ring-2 focus:ring-orange-600 outline-none transition-all disabled:bg-zinc-100"
                      value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)}
                      placeholder="Ex: João da Silva"
                      disabled={ocupado}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="perfil-telefone" className="block text-zinc-700 text-sm font-bold mb-2">WhatsApp de Contato</label>
                    <input
                      id="perfil-telefone" type="tel" autoComplete="tel"
                      className="w-full p-3 border border-zinc-300 rounded-xl text-zinc-900 focus:ring-2 focus:ring-orange-600 outline-none transition-all disabled:bg-zinc-100"
                      value={novoTelefone}
                      onChange={(e) => setNovoTelefone(e.target.value)}
                      placeholder="(11) 90000-0000"
                      disabled={ocupado}
                    />
                    <p className="text-xs text-zinc-500 mt-2">
                      Este número será usado para formatar suas mensagens de orçamento no WhatsApp.
                    </p>
                  </div>

                  <div className="pt-4 flex gap-2 justify-end">
                    <button 
                      type="button"
                      onClick={() => {
                        saver.reset();
                        setEditando(false);
                        setNovoNome(nome);
                        setNovoTelefone(telefone);
                      }}
                      disabled={ocupado}
                      className="px-6 py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-xl hover:bg-zinc-200 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <X size={18} /> Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={ocupado}
                      className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                      <Save size={18} /> {salvando ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </form>
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
                  <p className="text-xs text-zinc-500 mt-1">Use uma senha forte e exclusiva para sua conta.</p>
                </div>
                <button 
                  onClick={() => router.push('/redefinir-senha')}
                  disabled={ocupado}
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
