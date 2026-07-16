"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import toast from "react-hot-toast";
import { Users, HardHat, DollarSign, Plus, Trash2, Edit2, X, Save, ArrowLeft } from "lucide-react";

interface Funcionario {
  id: number;
  nome: string;
  cargo: string;
  valor_diaria: number;
}

export default function EquipePage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  // Estados do formulário de criação
  const [novoNome, setNovoNome] = useState("");
  const [novoCargo, setNovoCargo] = useState("");
  const [novaDiaria, setNovaDiaria] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Estados de edição
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCargo, setEditCargo] = useState("");
  const [editDiaria, setEditDiaria] = useState("");

  const carregarEquipe = async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("funcionarios")
      .select("*")
      .order("criado_em", { ascending: false });

    if (data) setFuncionarios(data);
    if (error) toast.error("Erro ao carregar equipe: " + error.message);
    setCarregando(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarEquipe();
  }, []);

  const formatarMoedaParaBanco = (valor: string) => {
    const limpo = valor.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  };

  const criarFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return toast.error("O nome é obrigatório.");

    setSalvando(true);
    const toastId = toast.loading("Cadastrando profissional...");
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const valorFormatado = formatarMoedaParaBanco(novaDiaria);
      const { error } = await supabase.from("funcionarios").insert([
        { 
          nome: novoNome, 
          cargo: novoCargo || "Profissional da Obra", 
          valor_diaria: valorFormatado,
          user_id: user.id
        }
      ]);

      if (!error) {
        toast.success("Profissional cadastrado!", { id: toastId });
        setNovoNome("");
        setNovoCargo("");
        setNovaDiaria("");
        carregarEquipe();
      } else {
        toast.error("Erro ao cadastrar: " + error.message, { id: toastId });
      }
    }
    setSalvando(false);
  };

  const iniciarEdicao = (func: Funcionario) => {
    setEditandoId(func.id);
    setEditNome(func.nome);
    setEditCargo(func.cargo || "");
    setEditDiaria(func.valor_diaria ? func.valor_diaria.toString().replace(".", ",") : "");
  };

  const salvarEdicao = async (id: number) => {
    if (!editNome.trim()) return toast.error("O nome não pode ficar vazio.");
    
    const toastId = toast.loading("Salvando alterações...");
    const valorFormatado = formatarMoedaParaBanco(editDiaria);

    const { error } = await supabase
      .from("funcionarios")
      .update({ nome: editNome, cargo: editCargo, valor_diaria: valorFormatado })
      .eq("id", id);

    if (!error) {
      toast.success("Profissional atualizado!", { id: toastId });
      setEditandoId(null);
      carregarEquipe();
    } else {
      toast.error("Erro ao atualizar: " + error.message, { id: toastId });
    }
  };

  const confirmarExclusao = (id: number, nome: string) => {
    toast(
      (t) => (
        <div className="flex flex-col gap-2">
          <p className="font-bold text-zinc-900 text-lg">Remover {nome}?</p>
          <p className="text-sm text-zinc-600 mb-2">
            O histórico de pagamentos deste profissional nas obras será mantido.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => toast.dismiss(t.id)} className="px-4 py-2 bg-zinc-200 text-zinc-800 rounded-lg font-bold hover:bg-zinc-300 transition">Cancelar</button>
            <button onClick={() => { toast.dismiss(t.id); executarExclusao(id); }} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition">Remover</button>
          </div>
        </div>
      ),
      { duration: Infinity, id: `excluir-${id}` }
    );
  };

  const executarExclusao = async (id: number) => {
    const toastId = toast.loading("Removendo profissional...");
    const { error } = await supabase.from("funcionarios").delete().eq("id", id);
    
    if (!error) {
      toast.success("Profissional removido da equipe.", { id: toastId });
      setFuncionarios(prev => prev.filter(f => f.id !== id));
    } else {
      toast.error("Erro ao remover: " + error.message, { id: toastId });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/home" className="p-2 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 hover:text-zinc-900 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">Minha Equipe</h1>
            <p className="text-sm md:text-base text-zinc-500 mt-1">Gerencie os profissionais e o valor das diárias.</p>
          </div>
        </div>
      </div>

      {/* GRID RESPONSIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA: FORMULÁRIO */}
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm sticky top-6">
            <div className="flex items-center gap-2 mb-6 text-orange-600">
              <Users size={24} />
              <h2 className="text-xl font-bold text-zinc-900">Novo Profissional</h2>
            </div>

            <form onSubmit={criarFuncionario} className="flex flex-col gap-4">
              <div>
                <label className="block text-zinc-700 text-sm font-bold mb-1">Nome</label>
                <input
                  type="text"
                  className="w-full p-3 border border-zinc-300 rounded-xl text-zinc-900 focus:ring-2 focus:ring-orange-600 outline-none transition-all"
                  placeholder="Ex: Carlos Silva"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  disabled={salvando}
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-700 text-sm font-bold mb-1">Cargo / Especialidade</label>
                <input
                  type="text"
                  className="w-full p-3 border border-zinc-300 rounded-xl text-zinc-900 focus:ring-2 focus:ring-orange-600 outline-none transition-all"
                  placeholder="Ex: Pedreiro, Pintor..."
                  value={novoCargo}
                  onChange={(e) => setNovoCargo(e.target.value)}
                  disabled={salvando}
                />
              </div>

              <div>
                <label className="block text-zinc-700 text-sm font-bold mb-1">Valor da Diária (R$)</label>
                <div className="flex items-center text-zinc-900 bg-white border border-zinc-300 rounded-xl px-3 focus-within:ring-2 focus-within:ring-orange-600 transition-all">
                  <span className="text-zinc-500 font-bold mr-2">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full py-3 bg-transparent outline-none"
                    placeholder="150,00"
                    value={novaDiaria}
                    onChange={(e) => setNovaDiaria(e.target.value)}
                    disabled={salvando}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={salvando || !novoNome.trim()}
                className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold p-4 rounded-xl mt-2 hover:bg-zinc-800 disabled:opacity-50 transition shadow-sm"
              >
                <Plus size={20} />
                {salvando ? "Cadastrando..." : "Cadastrar na Equipe"}
              </button>
            </form>
          </div>
        </div>

        {/* COLUNA DIREITA: LISTA DE PROFISSIONAIS */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden min-h-100">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
              <HardHat size={20} className="text-zinc-500" />
              <h3 className="font-bold text-zinc-900">Profissionais Cadastrados ({funcionarios.length})</h3>
            </div>

            {carregando ? (
              <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div></div>
            ) : funcionarios.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <Users size={48} className="text-zinc-300 mb-4" />
                <p className="text-zinc-500 font-medium">Nenhum profissional na sua equipe.</p>
                <p className="text-zinc-400 text-sm mt-1">Use o formulário ao lado para começar.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {funcionarios.map((func) => (
                  <div key={func.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-50 transition-colors">
                    
                    {editandoId === func.id ? (
                      /* MODO EDIÇÃO */
                      <div className="w-full flex flex-col md:flex-row gap-3 bg-orange-50 p-3 rounded-xl border border-orange-200 animate-in fade-in">
                        <input className="flex-1 p-2 border border-orange-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={editNome} onChange={(e) => setEditNome(e.target.value)} placeholder="Nome" />
                        <input className="flex-1 p-2 border border-orange-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={editCargo} onChange={(e) => setEditCargo(e.target.value)} placeholder="Cargo" />
                        <div className="flex items-center bg-white border border-orange-300 rounded-lg px-2 focus-within:ring-2 focus-within:ring-orange-500 w-full md:w-32">
                          <span className="text-zinc-500 text-sm">R$</span>
                          <input type="text" inputMode="decimal" className="w-full p-2 outline-none text-right" value={editDiaria} onChange={(e) => setEditDiaria(e.target.value)} placeholder="0,00" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditandoId(null)} className="flex-1 md:flex-none p-3 bg-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-300 transition flex items-center justify-center"><X size={18}/></button>
                          <button onClick={() => salvarEdicao(func.id)} className="flex-1 md:flex-none p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center justify-center"><Save size={18}/></button>
                        </div>
                      </div>
                    ) : (
                      /* MODO VISUALIZAÇÃO */
                      <>
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-2 bg-zinc-100 text-zinc-600 rounded-lg hidden md:block">
                            <HardHat size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold text-zinc-900 text-lg">{func.nome}</h4>
                            <p className="text-sm font-medium text-zinc-500">{func.cargo}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-0 border-zinc-100 pt-3 md:pt-0 mt-2 md:mt-0">
                          <div className="flex flex-col md:items-end">
                            <span className="text-xs font-bold text-zinc-400 uppercase">Diária</span>
                            <span className="font-black text-emerald-700 text-lg flex items-center gap-1">
                              <DollarSign size={16} /> 
                              {func.valor_diaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button onClick={() => iniciarEdicao(func)} className="p-2 text-zinc-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"><Edit2 size={18} /></button>
                            <button onClick={() => confirmarExclusao(func.id, func.nome)} className="p-2 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={18} /></button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}