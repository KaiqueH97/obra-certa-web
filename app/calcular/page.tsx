"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function Calculadora() {
  const [superficie, setSuperficie] = useState("piso");
  const [material, setMaterial] = useState("");
  const [altura, setAltura] = useState("");
  const [largura, setLargura] = useState("");
  const [resultado, setResultado] = useState<{ quantidade: string; unidade: string; area: string } | null>(null);
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
    let qtdCalculada = areaTotal;
    let unid = "m²";

    switch (superficie.toLowerCase()) {
      case "piso":
      case "contrapiso":
      case "laje":
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
      default:
        qtdCalculada = areaTotal;
        unid = "m²";
        break;
    }

    setResultado({
      quantidade: qtdCalculada.toFixed(2).replace(".", ","),
      unidade: unid,
      area: areaTotal.toFixed(2).replace(".", ","),
    });
  };

  const salvarNoProjeto = async () => {
    if (!projetoSelecionado || !resultado) return;
    setSalvando(true);

    const nomeMaterial = material ? material : superficie; 
    const quantidadeSalva = `${resultado.quantidade} ${resultado.unidade}`;

    const { error } = await supabase.from("materiais_projeto").insert([
      { 
        projeto_id: parseInt(projetoSelecionado), 
        nome: nomeMaterial, 
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
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-md mt-4">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Calculadora</h1>
          <Link href="/home" className="text-orange-600 font-bold text-lg hover:underline">
            Voltar
          </Link>
        </div>

        {/* Formulário de Cálculo */}
        <form onSubmit={realizarCalculo} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex flex-col gap-6">
          
          <div>
            <label className="block text-gray-800 text-xl font-bold mb-2">Superfície</label>
            <select 
              className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black bg-white focus:ring-2 focus:ring-orange-600 outline-none"
              value={superficie}
              onChange={(e) => setSuperficie(e.target.value)}
            >
              <option value="piso">Piso</option>
              <option value="parede">Parede</option>
              <option value="forro">Forro</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-800 text-xl font-bold mb-2">Material</label>
            <input
              type="text"
              className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Ex: Cerâmica, Porcelanato..."
            />
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
            className="w-full bg-orange-600 text-white font-bold p-5 rounded-lg text-2xl hover:bg-orange-700 transition mt-2"
          >
            Calcular Agora
          </button>
        </form>

        {/* Resultado Exibido na Tela */}
        {resultado && (
          <div className="mt-6 p-4 bg-yellow-100 text-yellow-800 rounded-lg text-center shadow-inner animate-fade-in">
            <h3 className="font-bold text-lg mb-1">Resultado:</h3>
            <p className="text-2xl font-bold">{resultado.quantidade} <span className="text-base font-normal">{resultado.unidade}</span></p>
            <p className="text-sm text-yellow-700 mt-1">Área total s/ quebra: {resultado.area} m²</p>

            {/* --- BLOCO: SALVAR NO PROJETO --- */}
            <div className="mt-4 pt-4 border-t border-yellow-300 text-left">
              <label className="block text-sm font-semibold mb-2 text-yellow-900">
                Vincular a uma obra existente:
              </label>
              
              <select
                className="w-full p-2 mb-3 rounded border border-yellow-400 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500"
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
                className="w-full bg-yellow-600 text-white p-2 rounded font-bold hover:bg-yellow-700 disabled:opacity-50 transition-colors"
              >
                {salvando ? "Salvando..." : "💾 Salvar Material na Obra"}
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}