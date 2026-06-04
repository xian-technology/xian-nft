/**
 * String-backed decimal helper.
 *
 * The Xian VM uses arbitrary-precision `decimal` values for currency amounts.
 * Funneling those through JS `Number` loses precision past ~15 significant
 * digits and can cause `approveAndBuy` to authorise a different amount than
 * the on-chain listing price. This helper keeps values as strings end-to-end
 * for display, validation, and comparison.
 *
 * Arithmetic isn't needed for listing/buy flows (we never sum prices on the
 * client). Only parsing, normalisation, sign, and lexicographic comparison
 * after alignment are implemented.
 */

const DEC_RE = /^[-+]?(\d+)(?:\.(\d+))?$/;

export interface ParsedDecimal {
  negative: boolean;
  intPart: string;
  fracPart: string;
}

function parse(value: string): ParsedDecimal | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = DEC_RE.exec(trimmed);
  if (!match) return null;
  const negative = trimmed.startsWith("-");
  const intPart = match[1].replace(/^0+(?=\d)/, "");
  const fracPart = (match[2] ?? "").replace(/0+$/, "");
  return { negative, intPart, fracPart };
}

/** Normalise a chain value (string | number | bigint | null) to a canonical decimal string. */
export function toDecimalString(value: unknown): string {
  if (value == null) return "0";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "0";
    // Numbers come from JSON; let JS render then re-parse to drop exponents.
    return toDecimalString(value.toString());
  }
  const raw = String(value).trim();
  if (!raw) return "0";
  // Handle "1.23e4" style values that some JSON encoders emit.
  if (/[eE]/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "0";
    return toDecimalString(n.toString());
  }
  const parsed = parse(raw);
  if (!parsed) return "0";
  const intPart = parsed.intPart || "0";
  const fracPart = parsed.fracPart;
  const body = fracPart ? `${intPart}.${fracPart}` : intPart;
  if (parsed.negative && body !== "0") return `-${body}`;
  return body;
}

export function isPositiveDecimal(value: unknown): boolean {
  const parsed = parse(toDecimalString(value));
  if (!parsed) return false;
  if (parsed.negative) return false;
  return parsed.intPart !== "0" || parsed.fracPart.length > 0;
}

export function isZeroDecimal(value: unknown): boolean {
  const parsed = parse(toDecimalString(value));
  if (!parsed) return true;
  return parsed.intPart === "0" && parsed.fracPart.length === 0;
}

/**
 * Compare two decimal strings. Returns -1 / 0 / 1.
 *
 * Used for sorting listings by price. Aligns fractional widths before
 * comparing as strings, so 9 < 10 and 0.0001 < 0.001 are correct.
 */
export function compareDecimal(a: unknown, b: unknown): number {
  const pa = parse(toDecimalString(a));
  const pb = parse(toDecimalString(b));
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  if (pa.negative !== pb.negative) return pa.negative ? -1 : 1;
  const sign = pa.negative ? -1 : 1;
  // Compare integer parts by length (since leading zeros are stripped),
  // then lexicographically.
  if (pa.intPart.length !== pb.intPart.length) {
    return sign * (pa.intPart.length < pb.intPart.length ? -1 : 1);
  }
  if (pa.intPart !== pb.intPart) {
    return sign * (pa.intPart < pb.intPart ? -1 : 1);
  }
  const fracLen = Math.max(pa.fracPart.length, pb.fracPart.length);
  const aFrac = pa.fracPart.padEnd(fracLen, "0");
  const bFrac = pb.fracPart.padEnd(fracLen, "0");
  if (aFrac === bFrac) return 0;
  return sign * (aFrac < bFrac ? -1 : 1);
}

export interface FormatDecimalOptions {
  /** Maximum significant fractional digits to keep. Default 8. */
  maxFractionDigits?: number;
  /** When set, abbreviate large magnitudes with k/M suffixes (used by aggregates, not prices). */
  abbreviate?: boolean;
}

/**
 * Render a decimal string for human display without ever going through Number.
 * Trims trailing zeros, leaves precision intact.
 */
export function formatDecimal(
  value: unknown,
  options: FormatDecimalOptions = {}
): string {
  const canonical = toDecimalString(value);
  if (canonical === "0") return "0";

  const { maxFractionDigits = 8, abbreviate = false } = options;
  const parsed = parse(canonical);
  if (!parsed) return "0";

  if (abbreviate) {
    const intLen = parsed.intPart.length;
    if (intLen > 6) {
      const head = parsed.intPart.slice(0, intLen - 6);
      const tail = parsed.intPart.slice(intLen - 6, intLen - 4);
      const tailTrimmed = tail.replace(/0+$/, "");
      const decimals = tailTrimmed ? `.${tailTrimmed}` : "";
      return `${parsed.negative ? "-" : ""}${head}${decimals}M`;
    }
    if (intLen > 3) {
      const head = parsed.intPart.slice(0, intLen - 3);
      const tail = parsed.intPart.slice(intLen - 3, intLen - 1);
      const tailTrimmed = tail.replace(/0+$/, "");
      const decimals = tailTrimmed ? `.${tailTrimmed}` : "";
      return `${parsed.negative ? "-" : ""}${head}${decimals}k`;
    }
  }

  let fracPart = parsed.fracPart;
  if (fracPart.length > maxFractionDigits) {
    fracPart = fracPart.slice(0, maxFractionDigits).replace(/0+$/, "");
  }
  const body = fracPart ? `${parsed.intPart}.${fracPart}` : parsed.intPart;
  return parsed.negative && body !== "0" ? `-${body}` : body;
}

/** Convenience: a strict price formatter (no abbreviation, never loses precision). */
export function formatPrice(value: unknown, maxFractionDigits = 8): string {
  return formatDecimal(value, { maxFractionDigits, abbreviate: false });
}
