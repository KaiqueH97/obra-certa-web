"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

const OPCOES_MATERIAIS: Record<string, { nome: string; tipos: string[] }> = {
  piso: {
    nome: "Piso",
    tipos: ["Porcelanato", "Cerâmica", "Laminado", "Cimentício", "Vinílico", "Emborrachado", "Pedras"],
  },
  parede: {
    nome: "Parede",
    tipos: ["Bloco cerâmico", "Drywall", "Bloco de concreto", "Tijolo ecológico", "Tijolinho maciço"],
  },
  revestimento: {
    nome: "Revestimento",
    tipos: ["Textura tradicional", "Textura Projetada", "Monocapa", "Massa Corrida", "Cerâmica/Azulejo"],
  },
  reboco: {
    nome: "Reboco",
    tipos: ["Tradicional (Cimento e Areia)", "Projetado", "Monocapa", "Gesso"],
  },
  contrapiso: {
    nome: "Contrapiso",
    tipos: ["Cimento", "Argamassa niveladora", "Concreto Usinado"],
  },
  laje: {
    nome: "Laje",
    tipos: ["Concreto armado", "Lajota cerâmica", "Pré-moldada (treliçada)", "EPS (Isopor)"],
  },
  forro: {
    nome: "Forro",
    tipos: ["Gesso acartonado (Drywall)", "Gesso em placas", "PVC", "Madeira", "Metálico"],
  },
  telhado: {
    nome: "Telhado",
    tipos: ["Telha Cerâmica (Barro)", "Telha de Fibrocimento", "Telha Metálica", "Shingle"],
  },
  pintura: {
    nome: "Pintura",
    tipos: ["Tinta Acrílica", "Tinta Látex (PVA)", "Tinta Epóxi", "Esmalte Sintético"],
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
        qtdCalculada = areaTotal * 1.10;
        unid = "m² (já c/ 10% de quebra)";
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
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Calculadora</h1>
          <Link href="/home" className="text-orange-600 font-bold text-lg hover:underline">
            Voltar
          </Link>
        </div>

        {/* Formulário de Cálculo com Cascata */}
        <form onSubmit={realizarCalculo} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex flex-col gap-6">
          
          <div>
            <label className="block text-gray-800 text-xl font-bold mb-2">Superfície</label>
            <select 
              className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black bg-white focus:ring-2 focus:ring-orange-600 outline-none"
              value={superficie}
              onChange={(e) => {
                setSuperficie(e.target.value);
                setMaterial(""); // Reseta o material ao trocar de superfície
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

        {/* Resultado Exibido na Tela */}
        {resultado && (
          <div className="mt-6 p-6 bg-yellow-100 text-yellow-800 rounded-xl shadow-md border border-yellow-200 animate-fade-in">
            <h3 className="font-bold text-xl mb-3 border-b border-yellow-300 pb-2">Resultado do Cálculo:</h3>
            <p className="text-gray-700 font-semibold mb-1">Material: <span className="font-bold text-gray-900">{resultado.materialNome}</span></p>
            <p className="text-3xl font-black text-yellow-900 mb-1">{resultado.quantidade} <span className="text-lg font-bold">{resultado.unidade}</span></p>
            <p className="text-sm text-yellow-700 mt-1">Área total s/ quebra: {resultado.area} m²</p>

            {/* --- BLOCO: SALVAR NO PROJETO --- */}
            <div className="mt-6 pt-5 border-t border-yellow-300 text-left">
              <label className="block text-sm font-bold mb-2 text-yellow-900">
                Vincular a uma obra existente:
              </label>
              
              <select
                className="w-full p-3 mb-4 rounded-lg border border-yellow-400 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-600 font-semibold"
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
                className="w-full bg-yellow-600 text-white p-4 rounded-lg text-lg font-bold hover:bg-yellow-700 disabled:opacity-50 transition-colors shadow-sm"
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