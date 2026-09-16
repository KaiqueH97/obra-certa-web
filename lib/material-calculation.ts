import { calculateMoneyTotal, parseMoney } from "./money";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type Measurement = { altura: string; largura: string };
export type MaterialEstimate = {
  quantidade: string;
  unidade: string;
  area: string;
  totalPecas?: number;
  precoTotalEstimado: number;
};

// Medidas não usam separador de milhar nem unidades dentro do campo.
export function parseMeasurement(input: string): number | null {
  const text = input.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null;
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function calculateArea(measurements: Measurement[]): Result<number> {
  if (measurements.length === 0) return { ok: false, error: "Adicione pelo menos uma área." };
  let area = 0;
  for (const [index, measurement] of measurements.entries()) {
    const height = parseMeasurement(measurement.altura);
    const width = parseMeasurement(measurement.largura);
    if (height === null || width === null) return {
      ok: false, error: `Área ${index + 1}: informe altura e largura maiores que zero, como 3,50 ou 3.50, sem unidades ou separador de milhar.`,
    };
    area += height * width;
  }
  // Evita infinito, subfluxo e valores sem precisão para apresentação em centésimos.
  if (!Number.isFinite(area) || area > Number.MAX_SAFE_INTEGER / 100) {
    return { ok: false, error: "A área ultrapassa o intervalo calculável. Confira as medidas." };
  }
  if (area < 0.01) return { ok: false, error: "A área total deve ser de pelo menos 0,01 m²." };
  return { ok: true, value: area };
}

export function calculateMaterial(input: {
  superficie: string;
  medidas: Measurement[];
  comprimentoPiso: string;
  larguraPiso: string;
  precoUnitario: string;
}): Result<MaterialEstimate> {
  const area = calculateArea(input.medidas);
  if (!area.ok) return area;
  let quantity = area.value;
  let unit = "m²";
  switch (input.superficie) {
    case "piso": case "contrapiso": case "laje": case "telhado": case "impermeabilizacao":
      quantity *= 1.10;
      unit = "m² (já c/ 10% de quebra)";
      break;
    case "parede": case "reboco": case "revestimento": break;
    case "forro": unit = "m² de forro"; break;
    case "pintura": unit = "m² (Consultar rendimento)"; break;
    default: return { ok: false, error: "Selecione uma superfície válida." };
  }
  if (!Number.isFinite(quantity) || quantity > Number.MAX_SAFE_INTEGER / 100) {
    return { ok: false, error: "A quantidade ultrapassa o intervalo calculável. Confira as medidas." };
  }

  let pieces: number | undefined;
  if (input.superficie === "piso" && (input.comprimentoPiso.trim() || input.larguraPiso.trim())) {
    const length = parseMeasurement(input.comprimentoPiso);
    const width = parseMeasurement(input.larguraPiso);
    if (length === null || width === null) return {
      ok: false, error: "Informe as duas dimensões da peça em centímetros, maiores que zero, ou deixe ambas vazias.",
    };
    const pieceArea = (length / 100) * (width / 100);
    pieces = Math.ceil(quantity / pieceArea);
    if (!Number.isFinite(pieceArea) || pieceArea <= 0 || !Number.isSafeInteger(pieces) || pieces <= 0) {
      return { ok: false, error: "Não foi possível estimar as peças. Confira suas dimensões." };
    }
  }

  const price = parseMoney(input.precoUnitario, { allowEmpty: true });
  if (!price.ok) return { ok: false, error: `Preço por m²: ${price.error}` };
  const cost = calculateMoneyTotal(price.cents, quantity);
  if (!cost.ok) return cost;
  return { ok: true, value: {
    quantidade: quantity.toFixed(2).replace(".", ","),
    unidade: unit,
    area: area.value.toFixed(2).replace(".", ","),
    totalPecas: pieces,
    precoTotalEstimado: cost.value,
  } };
}
