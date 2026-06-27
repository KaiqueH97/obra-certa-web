"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import toast, { Toaster } from "react-hot-toast";

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
  
  const [resultado, setResultado] = useState<{ 
    quantidade: string; 
    unidade: string; 
    area: string; 
    materialNome: string;
    totalPecas?: number; 
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
        alert("Por favor, preencha corretamente todas as medidas (Altura e Largura).");
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
        qtdComQuebra = areaTotal * 1.10;
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
        unid = "m² (Consultar rendimento da lata)";
        break;
      default:
        qtdComQuebra = areaTotal;
        unid = "m²";
        break;
    }

    setResultado({
      quantidade: qtdComQuebra.toFixed(2).replace(".", ","),
      unidade: unid,
      area: areaTotal.toFixed(2).replace(".", ","),
      materialNome: material || OPCOES_MATERIAIS[superficie]?.nome || "Material",
      totalPecas: pecasEstimadas > 0 ? pecasEstimadas : undefined
    });
  };

  const salvarNoProjeto = async () => {
    if (!projetoSelecionado || !resultado) return;
    setSalvando(true);

    const toastId = toast.loading("Salvando material na obra...");

    const infoPecas = resultado.totalPecas ? ` (~${resultado.totalPecas} peças)` : "";
    const quantidadeSalva = `${resultado.quantidade} ${resultado.unidade}${infoPecas}`;

    const { error } = await supabase.from("materiais_projeto").insert([
      { 
        projeto_id: parseInt(projetoSelecionado), 
        nome: resultado.materialNome, 
        quantidade: quantidadeSalva 
      }
    ]);

    if (!error) {
      // Atualiza o toast de loading para SUCESSO
      toast.success("Material salvo no projeto com sucesso!", { id: toastId });
    } else {
      // Atualiza o toast de loading para ERRO
      toast.error("Erro ao salvar: " + error.message, { id: toastId });
    }
    setSalvando(false);
  };
  
  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center pb-20">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="w-full max-w-md mt-4 animate-fade-in">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Calculadora</h1>
          <Link href="/home" className="text-orange-600 font-bold text-lg hover:underline">
            Voltar
          </Link>
        </div>

        <form onSubmit={realizarCalculo} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex flex-col gap-6">
          
          <div>
            <label className="block text-gray-800 text-xl font-bold mb-2">Superfície</label>
            <select 
              className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black bg-white focus:ring-2 focus:ring-orange-600 outline-none"
              value={superficie}
              onChange={(e) => {
                setSuperficie(e.target.value);
                setMaterial(""); 
              }}
              required
            >
              <option value="" disabled hidden>Selecione a superfície</option>
              {Object.entries(OPCOES_MATERIAIS).map(([chave, obj]) => (
                <option key={chave} value={chave}>{obj.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-800 text-xl font-bold mb-2">Tipo de material</label>
            <select
              className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black bg-white focus:ring-2 focus:ring-orange-600 outline-none disabled:bg-gray-100"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              required
              disabled={!superficie}
            >
              <option value="" disabled hidden>
                {superficie ? "Selecione o material" : "Escolha a superfície primeiro"}
              </option>
              {superficie && OPCOES_MATERIAIS[superficie].tipos.map((tipo) => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>

          {superficie === "piso" && (
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 animate-fade-in">
              <p className="text-orange-800 font-bold text-sm mb-3 underline">Dimensões da Peça de Piso (Opcional):</p>
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="block text-gray-700 text-xs font-bold mb-1">Comprimento (cm)</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-orange-300 rounded bg-white text-black text-sm"
                    value={comprimentoPiso}
                    onChange={(e) => setComprimentoPiso(e.target.value)}
                    placeholder="Ex: 60"
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-gray-700 text-xs font-bold mb-1">Largura (cm)</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-orange-300 rounded bg-white text-black text-sm"
                    value={larguraPiso}
                    onChange={(e) => setLarguraPiso(e.target.value)}
                    placeholder="Ex: 60"
                  />
                </div>
              </div>
            </div>
          )}

          {/* BLOCO DINÂMICO DE MEDIÇÕES (CADERNINHO DIGITAL) */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center mb-4">
              <label className="block text-gray-800 text-xl font-bold">Medições</label>
              <button 
                type="button" 
                onClick={adicionarMedida}
                className="text-sm bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-bold hover:bg-orange-200 transition"
              >
                + Adicionar Área
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {medidas.map((medida, index) => (
                <div key={medida.id} className="flex gap-2 items-end bg-gray-50 p-3 rounded-lg border border-gray-200 animate-fade-in">
                  
                  <div className="w-full">
                    <label className="block text-gray-600 text-xs font-bold mb-1">Altura {index + 1} (m)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full p-3 border border-gray-300 rounded-lg text-base text-black outline-none focus:ring-2 focus:ring-orange-600"
                      value={medida.altura}
                      onChange={(e) => atualizarMedida(medida.id, "altura", e.target.value)}
                      placeholder="Ex: 3"
                      required
                    />
                  </div>
                  
                  <div className="w-full">
                    <label className="block text-gray-600 text-xs font-bold mb-1">Largura {index + 1} (m)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full p-3 border border-gray-300 rounded-lg text-base text-black outline-none focus:ring-2 focus:ring-orange-600"
                      value={medida.largura}
                      onChange={(e) => atualizarMedida(medida.id, "largura", e.target.value)}
                      placeholder="Ex: 4"
                      required
                    />
                  </div>
                  
                  {/* BOTÕES LADO A LADO: [+] E [X] */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={adicionarMedida}
                      className="bg-green-100 text-green-700 h-12 w-12 rounded-lg font-black text-2xl hover:bg-green-200 transition flex items-center justify-center"
                      title="Adicionar nova medida"
                    >
                      +
                    </button>
                    
                    {medidas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerMedida(medida.id)}
                        className="bg-red-100 text-red-600 h-12 w-12 rounded-lg font-bold text-xl hover:bg-red-200 transition flex items-center justify-center"
                        title="Remover medida"
                      >
                        X
                      </button>
                    )}
                  </div>                  
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-slate-800 text-white font-bold p-5 rounded-lg text-2xl hover:bg-slate-900 transition mt-2 shadow-sm"
          >
            Calcular Total
          </button>
        </form>

        {/* ... (Resultado continua igual) ... */}
        {resultado && (
          <div className="mt-6 p-6 bg-green-50 text-green-900 rounded-xl shadow-md border border-green-200 animate-fade-in">
            <h3 className="font-bold text-xl mb-3 border-b border-green-300 pb-2 text-green-900">Resultado do Cálculo:</h3>
            <p className="text-gray-800 font-semibold mb-1">Material: <span className="font-black text-gray-900">{resultado.materialNome}</span></p>
            <p className="text-3xl font-black text-green-900 mb-1">{resultado.quantidade} <span className="text-lg font-bold">{resultado.unidade}</span></p>
            
            {resultado.totalPecas && (
                <div className="bg-green-200 p-3 rounded-lg mt-2 border border-green-300">
                    <p className="text-green-900 font-bold">Estimativa de Peças:</p>
                    <p className="text-2xl font-black">~ {resultado.totalPecas} unidades</p>
                    <p className="text-xs italic">*Considerando o tamanho informado ({comprimentoPiso}x{larguraPiso}cm)</p>
                </div>
            )}

            <p className="text-sm text-green-800 mt-3 font-medium">Área total s/ quebra: {resultado.area} m²</p>

            <div className="mt-6 pt-5 border-t border-green-300 text-left">
              <label className="block text-sm font-bold mb-2 text-green-900">
                Vincular a uma obra existente:
              </label>
              
              <select
                className="w-full p-3 mb-4 rounded-lg border border-green-400 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-700 font-semibold"
                value={projetoSelecionado}
                onChange={(e) => setProjetoSelecionado(e.target.value)}
              >
                <option value="">Selecione um projeto...</option>
                {projetos.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.titulo}
                  </option>
                ))}
              </select>

              <button
                onClick={salvarNoProjeto}
                disabled={!projetoSelecionado || salvando}
                className="w-full bg-green-700 text-white p-4 rounded-lg text-lg font-bold hover:bg-green-800 disabled:opacity-50 transition-colors shadow-sm"
              >
                {salvando ? "Salvando..." : "Salvar Material na Obra"}
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}