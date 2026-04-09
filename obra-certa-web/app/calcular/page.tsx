"use client";

import { useState } from "react";
import Link from "next/link";

export default function Calculadora() {
  const [superficie, setSuperficie] = useState("piso");
  const [material, setMaterial] = useState("Cerâmica");
  const [altura, setAltura] = useState("");
  const [largura, setLargura] = useState("");
  const [resultado, setResultado] = useState<{ quantidade: string; unidade: string; area: string } | null>(null);

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
        unid = "m² (já com 10% de margem de quebra/recorte)";
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
          <div className="mt-8 bg-green-50 border-2 border-green-500 p-6 rounded-xl">
            <h2 className="text-2xl font-bold text-green-800 mb-4">Resultado:</h2>
            <p className="text-lg text-gray-800 mb-2">
              <strong>Área Total:</strong> {resultado.area} m²
            </p>
            <p className="text-xl text-gray-900">
              <strong>Comprar:</strong> {resultado.quantidade} {resultado.unidade} de {material}
            </p>
          </div>
        )}

      </div>
    </main>
  );
}