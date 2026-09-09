// Limite comum dos campos monetários do app, compatível com numeric(10, 2).
export const MAX_MONEY_CENTS = 9_999_999_999;

type MoneyResult =
  | { ok: true; cents: number; value: number }
  | { ok: false; error: string };

const invalidFormat: MoneyResult = {
  ok: false,
  error: "Use um valor como 150,50, 150.50 ou 1.500,50, com até duas casas decimais.",
};

function fromCents(cents: number): MoneyResult {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_MONEY_CENTS) {
    return { ok: false, error: "O valor deve estar entre R$ 0,00 e R$ 99.999.999,99." };
  }
  return { ok: true, cents, value: cents / 100 };
}

// Texto digitado pelo usuário. Não usar este parser para valores vindos do banco.
export function parseMoney(
  input: string,
  { allowEmpty = false, allowZero = true } = {},
): MoneyResult {
  const text = input.trim();
  if (!text) {
    return allowEmpty && allowZero
      ? fromCents(0)
      : { ok: false, error: "Informe um valor monetário." };
  }

  let normalized: string;
  if (/^\d+(?:[.,]\d{1,2})?$/.test(text)) {
    normalized = text.replace(",", ".");
  } else if (/^[1-9]\d{0,2}(?:\.\d{3})+,\d{1,2}$/.test(text)) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else {
    return invalidFormat;
  }

  const [whole, fraction = ""] = normalized.split(".");
  // Compõe centavos inteiros, sem multiplicar um decimal binário por 100.
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!allowZero && cents === 0) {
    return { ok: false, error: "O valor deve ser maior que zero." };
  }
  return fromCents(cents);
}

export function calculateMoneyTotal(unitCents: number, quantity: number): MoneyResult {
  if (!fromCents(unitCents).ok || !Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Confira o preço e as medidas antes de calcular o custo." };
  }
  const totalCents = unitCents * quantity;
  // Corrige apenas ruído de ponto flutuante próximo ao meio centavo.
  // Ex.: 29 centavos × 3,5 m² pode resultar em 101,49999999999999.
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(totalCents)) * 4;
  return fromCents(Math.round(totalCents + tolerance));
}
