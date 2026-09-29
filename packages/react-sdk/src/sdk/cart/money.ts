export type MoneyCurrency = {
  prefix: string;
  suffix: string;
  code: string;
};

/** Prefijo visible. No uses Intl `style: currency` con MXN por default: Guatemala veía `$` en vez de `Q`. */
const PREFIX_BY_CODE: Record<string, string> = {
  MXN: "$",
  USD: "US$",
  GTQ: "Q",
  EUR: "€",
  GBP: "£",
  COP: "$",
  CLP: "$",
  ARS: "$",
  PEN: "S/",
  CRC: "₡",
  BRL: "R$",
};

export function prefixForCurrencyCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return "$";
  return PREFIX_BY_CODE[normalized] ?? `${normalized} `;
}

export function resolveMoneyCurrency(raw: unknown): MoneyCurrency | null {
  if (raw == null || raw === "") return null;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const upper = trimmed.toUpperCase();
    if (upper === "Q" || upper === "GTQ") {
      return { prefix: "Q", suffix: "GTQ", code: "GTQ" };
    }
    if (trimmed === "€" || upper === "EUR") {
      return { prefix: "€", suffix: "EUR", code: "EUR" };
    }
    if (upper.length === 3 && /^[A-Z]{3}$/.test(upper)) {
      return { prefix: prefixForCurrencyCode(upper), suffix: upper, code: upper };
    }
    return { prefix: trimmed, suffix: "", code: upper };
  }

  if (typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    const codeRaw = rec.code3 ?? rec.code ?? rec.iso;
    const code = typeof codeRaw === "string" ? codeRaw.trim().toUpperCase() : "";
    const prefix =
      typeof rec.prefijo === "string" && rec.prefijo.trim()
        ? rec.prefijo.trim()
        : code
          ? prefixForCurrencyCode(code)
          : "";
    if (!prefix && !code) return null;
    const suffix =
      typeof rec.sufijo === "string" && rec.sufijo.trim() ? rec.sufijo.trim() : code;
    return {
      prefix: prefix || prefixForCurrencyCode(code || "MXN"),
      suffix,
      code: code || "MXN",
    };
  }

  return null;
}

export function formatMoney(amount: number, prefix = "$", suffix = ""): string {
  const formatted = new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  const withPrefix = `${prefix}${formatted}`;
  return suffix ? `${withPrefix} ${suffix}` : withPrefix;
}

export function formatCatalogAmount(amount: number | undefined, currencyRaw: unknown): string | undefined {
  if (amount == null) return undefined;
  const currency = resolveMoneyCurrency(currencyRaw);
  if (!currency) return formatMoney(amount, "$", "");
  return formatMoney(amount, currency.prefix, "");
}
