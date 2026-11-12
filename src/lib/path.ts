const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f\x7f]/;

/** Windows 保留设备名；大小写不敏感，带扩展名时同样保留（如 CON.txt）。 */
const RESERVED_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

export const MAX_FILE_NAME_LENGTH = 255;

/** 与 Rust 端 validate_new_name 保持同一套规则。 */
export function isValidFileName(name: string): boolean {
  if (!name || name.trim() === "") return false;
  if (name.length > MAX_FILE_NAME_LENGTH) return false;
  if (name === "." || name === "..") return false;
  if (INVALID_CHARS.test(name)) return false;
  if (name.startsWith(" ") || name.endsWith(" ") || name.endsWith(".")) return false;

  const stem = name.split(".")[0].trimEnd().toUpperCase();
  if (RESERVED_NAMES.has(stem)) return false;

  return true;
}

export function splitFileName(name: string): { stem: string; extension: string } {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) {
    return { stem: name, extension: "" };
  }
  return {
    stem: name.slice(0, lastDot),
    extension: name.slice(lastDot),
  };
}
