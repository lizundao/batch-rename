import type { AutoNumberConfig } from "../types";

const ROMAN_PAIRS: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** 序号上限：防止超大起始值生成天文数字长度的文件名或无限循环。 */
export const MAX_SEQUENCE_VALUE = 1_000_000_000;
export const MAX_PADDING = 32;
const MAX_ROMAN_VALUE = 100_000;

function clampInteger(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  const n = Math.trunc(value);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function toRoman(value: number): string {
  // 非有限值直接返回 0，绝不进入 while 循环（Infinity 会永久冻结界面）。
  if (!Number.isFinite(value)) return "0";
  let n = Math.trunc(value);
  if (n <= 0) return String(n);
  if (n > MAX_ROMAN_VALUE) return String(n);

  let result = "";
  for (const [threshold, symbol] of ROMAN_PAIRS) {
    while (n >= threshold) {
      result += symbol;
      n -= threshold;
    }
  }
  return result;
}

export function toAlpha(value: number, uppercase = true): string {
  if (!Number.isFinite(value)) return "0";
  let n = Math.trunc(value);
  if (n <= 0) return String(n);
  if (n > MAX_SEQUENCE_VALUE) return String(n);

  let result = "";
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode((uppercase ? 65 : 97) + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

export function formatSequenceNumber(index: number, config: AutoNumberConfig): string {
  const start = clampInteger(
    config.start,
    1,
    -MAX_SEQUENCE_VALUE,
    MAX_SEQUENCE_VALUE,
  );
  const offset = clampInteger(index, 0, 0, MAX_SEQUENCE_VALUE);
  const padding = clampInteger(config.padding, 1, 0, MAX_PADDING);
  const value = clampInteger(
    start + offset,
    start,
    -MAX_SEQUENCE_VALUE,
    MAX_SEQUENCE_VALUE,
  );

  let str: string;
  switch (config.numberType) {
    case "roman":
      str = toRoman(value);
      break;
    case "alpha":
      str = toAlpha(value);
      break;
    case "arabic":
    default:
      str = String(value);
      break;
  }

  // padding 已经被夹在 0..32，padStart 不会因超大参数抛异常。
  if (padding > 0 && str.length < padding) {
    const fill = config.numberType === "alpha" ? "A" : "0";
    return str.padStart(padding, fill);
  }

  return str;
}
