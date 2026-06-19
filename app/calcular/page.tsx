"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

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
  const [altura, setAltura] = useState("");
  const [largura, setLargura] = useState("");
  
  const [resultado, setResultado] = useState<{ quantidade: string; unidade: string; area: string; materialNome: string } | null>(null);
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

  const realizarCalculo = (e: React.FormEvent) => {
    e.preventDefault();

    const alt = parseFloat(altura.replace(",", "."));
    const larg = parseFloat(largura.replace(",", "."));

    if (isNaN(alt) || isNaN(larg)) {
      alert("Por favor, digite valores válidos para altura e largura.");
      return;
    }

    const areaTotal = alt * larg;
    let qtdCalculada = 0.0;
    let unid = "m²";

    switch (superficie) {
      case "piso":
      case "contrapiso":
      case "laje":
      case "telhado":
      case "impermeabilizacao":
        qtdCalculada = areaTotal * 1.10;
        unid = "m² (já c/ 10% de quebra/sobreposição)";
        break;
      case "parede":
      case "reboco":
      case "revestimento":
        qtdCalculada = areaTotal;
        unid = "m²";
        break;
      case "forro":
        qtdCalculada = areaTotal;
        unid = "m² de forro";
        break;
      case "pintura":
        qtdCalculada = areaTotal;
        unid = "m² (Consultar rendimento da lata)";
        break;
      default:
        qtdCalculada = areaTotal;
        unid = "m²";
        break;
    }

    setResultado({
      quantidade: qtdCalculada.toFixed(2).replace(".", ","),
      unidade: unid,
      area: areaTotal.toFixed(2).replace(".", ","),
      materialNome: material || OPCOES_MATERIAIS[superficie]?.nome || "Material",
    });
  };

  const salvarNoProjeto = async () => {
    if (!projetoSelecionado || !resultado) return;
    setSalvando(true);

    const quantidadeSalva = `${resultado.quantidade} ${resultado.unidade}`;

    const { error } = await supabase.from("materiais_projeto").insert([
      { 
        projeto_id: parseInt(projetoSelecionado), 
        nome: resultado.materialNome, 
        quantidade: quantidadeSalva 
      }
    ]);

    if (!error) {
      alert("Material salvo no projeto com sucesso!");
    } else {
      alert("Erro ao salvar: " + error.message);
    }
    setSalvando(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center pb-20">
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

          <div className="flex gap-4">
            <div className="w-1/2">
              <label className="block text-gray-800 text-xl font-bold mb-2">Altura (m)</label>
              <input
                type="text"
                inputMode="decimal"
                className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                placeholder="Ex: 5"
                required
              />
            </div>
            <div className="w-1/2">
              <label className="block text-gray-800 text-xl font-bold mb-2">Largura (m)</label>
              <input
                type="text"
                inputMode="decimal"
                className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
                value={largura}
                onChange={(e) => setLargura(e.target.value)}
                placeholder="Ex: 7.5"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-slate-800 text-white font-bold p-5 rounded-lg text-2xl hover:bg-slate-900 transition mt-2 shadow-sm"
          >
            Calcular Agora
          </button>
        </form>

        {resultado && (
          <div className="mt-6 p-6 bg-green-50 text-green-900 rounded-xl shadow-md border border-green-200 animate-fade-in">
            <h3 className="font-bold text-xl mb-3 border-b border-green-300 pb-2 text-green-900">Resultado do Cálculo:</h3>
            <p className="text-gray-800 font-semibold mb-1">Material: <span className="font-black text-gray-900">{resultado.materialNome}</span></p>
            <p className="text-3xl font-black text-green-900 mb-1">{resultado.quantidade} <span className="text-lg font-bold">{resultado.unidade}</span></p>
            <p className="text-sm text-green-800 mt-1 font-medium">Área total s/ quebra: {resultado.area} m²</p>

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