"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { Calculator, Plus, X, Building2, Save, Ruler, CheckCircle2, DollarSign } from "lucide-react";

const OPCOES_MATERIAIS: Record<string, { nome: string; tipos: string[] }> = {
  piso: {
    nome: "Piso",
    tipos: ["Porcelanato", "Cerâmica", "Laminado", "Cimentício", "Vinílico", "Emborrachado", "Pedras Naturais", "Epóxi (Porcelanato Líquido)"],
  },
  parede: {
    nome: "Parede",
    tipos: ["Bloco cerâmico", "Drywall", "Bloco de concreto", "Tijolo ecológico", "Tijolinho maciço", "Placa Cimentícia"],
  },
  revestimento: {
    nome: "Revestimento",
    tipos: ["Textura tradicional", "Textura Projetada", "Monocapa", "Massa Corrida", "Cerâmica/Azulejo", "Pastilhas"],
  },
  reboco: {
    nome: "Reboco",
    tipos: ["Tradicional (Cimento e Areia)", "Projetado", "Monocapa", "Gesso", "Argamassa Polimérica"],
  },
  contrapiso: {
    nome: "Contrapiso",
    tipos: ["Cimento", "Argamassa niveladora", "Argamassa Autonivelante", "Concreto Usinado"],
  },
  laje: {
    nome: "Laje",
    tipos: ["Concreto armado", "Lajota cerâmica", "Pré-moldada (treliçada)", "EPS (Isopor)", "Laje Maciça"],
  },
  forro: {
    nome: "Forro",
    tipos: ["Gesso acartonado (Drywall)", "Gesso em placas", "PVC", "Madeira", "Metálico", "Fibra Mineral (Acústico)"],
  },
  telhado: {
    nome: "Telhado",
    tipos: ["Telha Cerâmica (Barro)", "Telha de Fibrocimento", "Telha Metálica", "Shingle", "Telha Ecológica (Tetra Pak)", "Policarbonato"],
  },
  pintura: {
    nome: "Pintura",
    tipos: ["Tinta Acrílica", "Tinta Látex (PVA)", "Tinta Epóxi", "Esmalte Sintético", "Selador/Fundo Preparador"],
  },
  impermeabilizacao: {
    nome: "Impermeabilização",
    tipos: ["Manta Asfáltica", "Manta Líquida", "Argamassa Polimérica", "Emulsão Asfáltica"],
  }
};

export default function Calculadora() {
  const [superficie, setSuperficie] = useState("");
  const [material, setMaterial] = useState("");
  const [medidas, setMedidas] = useState([{ id: 1, altura: "", largura: "" }]);  
  const [comprimentoPiso, setComprimentoPiso] = useState("");
  const [larguraPiso, setLarguraPiso] = useState("");
  const [precoUnitario, setPrecoUnitario] = useState(""); // NOVO ESTADO: Preço do material
  
  const [resultado, setResultado] = useState<{ 
    quantidade: string; 
    unidade: string; 
    area: string; 
    materialNome: string;
    totalPecas?: number; 
    precoTotalEstimado?: number;
  } | null>(null);

  const [projetos, setProjetos] = useState<{ id: number; titulo: string }[]>([]);
  const [projetoSelecionado, setProjetoSelecionado] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const buscarProjetos = async () => {
      const { data } = await supabase.from("projetos").select("id, titulo");
      if (data) setProjetos(data);
    };
    buscarProjetos();
  }, []);

  const adicionarMedida = () => {
    setMedidas([...medidas, { id: Date.now(), altura: "", largura: "" }]);
  };

  const atualizarMedida = (id: number, campo: "altura" | "largura", valor: string) => {
    setMedidas(medidas.map(m => m.id === id ? { ...m, [campo]: valor } : m));
  };

  const removerMedida = (id: number) => {
    setMedidas(medidas.filter(m => m.id !== id));
  };

  const realizarCalculo = (e: React.FormEvent) => {
    e.preventDefault();
    let areaTotal = 0;

    for (const med of medidas) {
      const alt = parseFloat(med.altura.replace(",", "."));
      const larg = parseFloat(med.largura.replace(",", "."));

      if (isNaN(alt) || isNaN(larg)) {
        toast.error("Preencha corretamente todas as medidas (Altura e Largura).");
        return;
      }
      areaTotal += (alt * larg);
    }

    let qtdComQuebra = areaTotal;
    let unid = "m²";
    let pecasEstimadas = 0;

    switch (superficie) {
      case "piso":
      case "contrapiso":
      case "laje":
      case "telhado":
      case "impermeabilizacao":
        qtdComQuebra = areaTotal * 1.10; // 10% de quebra
        unid = "m² (já c/ 10% de quebra)";
        
        if (superficie === "piso" && comprimentoPiso && larguraPiso) {
            const compM = parseFloat(comprimentoPiso) / 100;
            const largM = parseFloat(larguraPiso) / 100;
            const areaPeca = compM * largM;
            pecasEstimadas = Math.ceil(qtdComQuebra / areaPeca);
        }
        break;
      case "parede":
      case "reboco":
      case "revestimento":
        qtdComQuebra = areaTotal;
        unid = "m²";
        break;
      case "forro":
        qtdComQuebra = areaTotal;
        unid = "m² de forro";
        break;
      case "pintura":
        qtdComQuebra = areaTotal;
        unid = "m² (Consultar rendimento)";
        break;
      default:
        qtdComQuebra = areaTotal;
        unid = "m²";
        break;
    }

    // LÓGICA: Calcular o valor total em Reais se o usuário preencheu o preço
    const precoNum = parseFloat(precoUnitario.replace(/\./g, "").replace(",", "."));
    let custoTotal = 0;
    if (!isNaN(precoNum) && precoNum > 0) {
      // Se for piso com peças, multiplica pelo metro quadrado. Para os outros, também pelo metro.
      custoTotal = qtdComQuebra * precoNum; 
    }

    setResultado({
      quantidade: qtdComQuebra.toFixed(2).replace(".", ","),
      unidade: unid,
      area: areaTotal.toFixed(2).replace(".", ","),
      materialNome: material || OPCOES_MATERIAIS[superficie]?.nome || "Material",
      totalPecas: pecasEstimadas > 0 ? pecasEstimadas : undefined,
      precoTotalEstimado: custoTotal > 0 ? custoTotal : undefined // Salva o total calculado
    });
    
    toast.success("Cálculo realizado com sucesso!");
  };

  const salvarNoProjeto = async () => {
    if (!projetoSelecionado || !resultado) return;
    setSalvando(true);

    const toastId = toast.loading("Salvando material na obra...");
    const infoPecas = resultado.totalPecas ? ` (~${resultado.totalPecas} peças)` : "";
    const quantidadeSalva = `${resultado.quantidade} ${resultado.unidade}${infoPecas}`;

    // LÓGICA DE INSERÇÃO ATUALIZADA (Inclui o preco_total no banco!)
    const { error } = await supabase.from("materiais_projeto").insert([
      { 
        projeto_id: parseInt(projetoSelecionado), 
        nome: resultado.materialNome, 
        quantidade: quantidadeSalva,
        preco_total: resultado.precoTotalEstimado || 0 
      }
    ]);

    if (!error) {
      toast.success("Material e preço salvos no projeto!", { id: toastId });
    } else {
      toast.error("Erro ao salvar: " + error.message, { id: toastId });
    }
    setSalvando(false);
  };
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-orange-100 text-orange-600 rounded-xl hidden md:block">
          <Calculator size={32} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">Calculadora Inteligente</h1>
          <p className="text-sm md:text-base text-zinc-500 mt-1">Some áreas, adicione quebras e estime materiais e custos em segundos.</p>
        </div>
      </div>

      {/* GRID RESPONSIVO: Formulário à esquerda, Resultados à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA: FORMULÁRIO DE CÁLCULO */}
        <div className="lg:col-span-7 bg-white p-4 md:p-8 rounded-2xl border border-zinc-100 shadow-sm">
          <form onSubmit={realizarCalculo} className="flex flex-col gap-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-900 text-sm font-bold mb-2">Superfície</label>
                <select 
                  className="w-full p-4 md:p-3 border border-zinc-300 rounded-xl text-zinc-900 bg-white focus:ring-2 focus:ring-orange-600 outline-none transition-all"
                  value={superficie}
                  onChange={(e) => {
                    setSuperficie(e.target.value);
                    setMaterial(""); 
                  }}
                  required
                >
                  <option value="" disabled hidden>Selecione...</option>
                  {Object.entries(OPCOES_MATERIAIS).map(([chave, obj]) => (
                    <option key={chave} value={chave}>{obj.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-900 text-sm font-bold mb-2">Tipo de material</label>
                <select
                  className="w-full p-4 md:p-3 border border-zinc-300 rounded-xl text-zinc-900 bg-white focus:ring-2 focus:ring-orange-600 outline-none disabled:bg-zinc-100 disabled:text-zinc-400 transition-all"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  required
                  disabled={!superficie}
                >
                  <option value="" disabled hidden>
                    {superficie ? "Selecione o material" : "Escolha a superfície..."}
                  </option>
                  {superficie && OPCOES_MATERIAIS[superficie].tipos.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Opcional: Tamanho do Piso */}
            {superficie === "piso" && (
              <div className="bg-orange-50 p-4 md:p-5 rounded-xl border border-orange-200 animate-in fade-in">
                <p className="text-orange-800 font-bold text-sm mb-3 flex items-center gap-2">
                  <Ruler size={16} /> Dimensões da Peça (Opcional)
                </p>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-orange-900 text-xs font-bold mb-1">Comprimento (cm)</label>
                    <input
                      type="number"
                      className="w-full p-3 border border-orange-300 rounded-lg bg-white text-zinc-900 text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                      value={comprimentoPiso}
                      onChange={(e) => setComprimentoPiso(e.target.value)}
                      placeholder="Ex: 60"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-orange-900 text-xs font-bold mb-1">Largura (cm)</label>
                    <input
                      type="number"
                      className="w-full p-3 border border-orange-300 rounded-lg bg-white text-zinc-900 text-sm focus:ring-2 focus:ring-orange-600 outline-none"
                      value={larguraPiso}
                      onChange={(e) => setLarguraPiso(e.target.value)}
                      placeholder="Ex: 60"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* O CADERNINHO DIGITAL (Medições) */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-zinc-900 text-lg font-bold">Caderninho de Medições</label>
                <button 
                  type="button" 
                  onClick={adicionarMedida}
                  className="flex items-center gap-1 text-sm bg-orange-100 text-orange-700 px-4 py-2 rounded-full font-bold hover:bg-orange-200 transition-colors"
                >
                  <Plus size={16} /> Nova Área
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {medidas.map((medida, index) => (
                  <div key={medida.id} className="flex gap-2 items-end bg-zinc-50 p-3 md:p-4 rounded-xl border border-zinc-200 animate-in slide-in-from-left-2">
                    
                    <div className="w-full">
                      <label className="block text-zinc-600 text-xs font-bold mb-1">Altura {index + 1} (m)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full p-4 md:p-3 border border-zinc-300 rounded-lg text-base md:text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-orange-600 transition-all"
                        value={medida.altura}
                        onChange={(e) => atualizarMedida(medida.id, "altura", e.target.value)}
                        placeholder="Ex: 3"
                        required
                      />
                    </div>
                    
                    <div className="w-full">
                      <label className="block text-zinc-600 text-xs font-bold mb-1">Largura {index + 1} (m)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full p-4 md:p-3 border border-zinc-300 rounded-lg text-base md:text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-orange-600 transition-all"
                        value={medida.largura}
                        onChange={(e) => atualizarMedida(medida.id, "largura", e.target.value)}
                        placeholder="Ex: 4"
                        required
                      />
                    </div>
                    
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={adicionarMedida}
                        className="bg-zinc-200 text-zinc-700 h-14 w-12 md:h-11 md:w-11 rounded-lg font-black text-xl hover:bg-zinc-300 transition-colors flex items-center justify-center"
                      >
                        +
                      </button>
                      
                      {medidas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removerMedida(medida.id)}
                          className="bg-red-100 text-red-600 h-14 w-12 md:h-11 md:w-11 rounded-lg font-bold hover:bg-red-200 transition-colors flex items-center justify-center"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>                  
                  </div>
                ))}
              </div>
            </div>

            {/* NOVO CAMPO: Valor por m2/Unidade */}
            <div className="bg-emerald-50 p-4 md:p-5 rounded-xl border border-emerald-200 mt-2">
               <label className="block text-emerald-900 text-sm font-bold mb-2 items-center gap-1">
                 <DollarSign size={16} /> Preço do m² / Unidade (Opcional)
               </label>
               <div className="flex items-center bg-white border border-emerald-300 rounded-lg px-3 focus-within:ring-2 focus-within:ring-emerald-600 transition-all shadow-sm">
                 <span className="text-emerald-700 font-bold text-sm">R$</span>
                 <input
                   type="text"
                   inputMode="decimal"
                   className="w-full p-3 outline-none text-zinc-900 bg-transparent text-right font-bold"
                   value={precoUnitario}
                   onChange={(e) => setPrecoUnitario(e.target.value)}
                   placeholder="0,00"
                 />
               </div>
               <p className="text-xs text-emerald-700 mt-2 font-medium">Preencha para já incluir o valor financeiro no caixa da sua obra.</p>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold p-5 md:p-4 rounded-xl text-xl md:text-lg hover:bg-zinc-800 transition-colors mt-2 shadow-sm"
            >
              <Calculator size={24} />
              Calcular Total
            </button>
          </form>
        </div>

        {/* COLUNA DIREITA: RESULTADOS E INTEGRAÇÃO COM PROJETOS */}
        <div className="lg:col-span-5">
          <div className="sticky top-6">
            {!resultado ? (
              <div className="bg-zinc-50 border border-zinc-200 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full min-h-75">
                <Calculator size={48} className="text-zinc-300 mb-4" />
                <h3 className="text-zinc-500 font-bold text-lg">Aguardando Medições</h3>
                <p className="text-zinc-400 text-sm mt-2 max-w-xs">Preencha o formulário ao lado e clique em calcular para ver o detalhamento de materiais aqui.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-emerald-200 shadow-lg overflow-hidden animate-in slide-in-from-bottom-4">
                
                <div className="bg-emerald-50 p-6 border-b border-emerald-100">
                  <div className="flex items-center gap-2 text-emerald-800 mb-4">
                    <CheckCircle2 size={24} />
                    <h3 className="font-bold text-xl">Resultado Final</h3>
                  </div>
                  
                  <p className="text-emerald-700 text-sm font-semibold mb-1 uppercase tracking-wide">
                    {superficie} • {resultado.materialNome}
                  </p>
                  <div className="flex items-baseline gap-2 text-emerald-950">
                    <span className="text-5xl font-black tracking-tight">{resultado.quantidade}</span>
                    <span className="text-xl font-bold">{resultado.unidade}</span>
                  </div>
                  
                  <p className="text-sm text-emerald-700 mt-3 font-medium flex items-center gap-1">
                    <Ruler size={14} /> Área total s/ quebra: {resultado.area} m²
                  </p>
                </div>

                {resultado.totalPecas && (
                  <div className="bg-emerald-100/50 p-4 border-b border-emerald-100">
                    <p className="text-emerald-800 font-bold text-sm mb-1">Estimativa de Peças:</p>
                    <p className="text-2xl font-black text-emerald-950">~ {resultado.totalPecas} unidades</p>
                    <p className="text-xs text-emerald-600 italic mt-1">*Considerando peça de {comprimentoPiso}x{larguraPiso}cm</p>
                  </div>
                )}

                {/* VISUAL NO RESULTADO: Exibição do Custo Total */}
                {resultado.precoTotalEstimado && (
                  <div className="bg-emerald-600 p-4 border-b border-emerald-700 flex justify-between items-center text-white">
                    <p className="font-bold text-sm text-emerald-100 uppercase tracking-wider">Custo Estimado:</p>
                    <p className="text-2xl font-black">R$ {resultado.precoTotalEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                  </div>
                )}

                <div className="p-6 bg-white">
                  <label className="block text-sm font-bold mb-3 text-zinc-900 items-center gap-2">
                    <Building2 size={16} className="text-orange-600"/> Vincular a uma Obra Ativa
                  </label>
                  
                  <select
                    className="w-full p-4 md:p-3 mb-4 rounded-xl border border-zinc-300 bg-zinc-50 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-600 font-medium transition-all"
                    value={projetoSelecionado}
                    onChange={(e) => setProjetoSelecionado(e.target.value)}
                  >
                    <option value="" disabled hidden>Selecione um projeto...</option>
                    {projetos.length === 0 ? (
                      <option disabled>Nenhum projeto encontrado.</option>
                    ) : (
                      projetos.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.titulo}
                        </option>
                      ))
                    )}
                  </select>

                  <button
                    onClick={salvarNoProjeto}
                    disabled={!projetoSelecionado || salvando}
                    className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white p-4 md:p-3 rounded-xl md:text-lg font-bold hover:bg-orange-700 disabled:opacity-50 disabled:bg-zinc-300 disabled:text-zinc-500 transition-colors shadow-sm"
                  >
                    <Save size={20} />
                    {salvando ? "Salvando..." : "Salvar Material na Obra"}
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}