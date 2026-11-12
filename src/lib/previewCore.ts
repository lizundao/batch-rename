import type {
  AutoNumberConfig,
  FileItem,
  FindReplaceConfig,
  FindReplaceRule,
  InsertConfig,
  RenameConfig,
  RenameMode,
  SmartRenameConfig,
  SortOrder,
} from "../types";
import { buildDuplicateIndex, deriveStatus } from "./validate";
import { sortFiles } from "./sort";
import { extractDateFromStem } from "./dateExtract";
import { formatSequenceNumber } from "./numberFormat";

/** 单次预览/执行的文件数上限，与后端 MAX_OPERATIONS 一致。 */
export const MAX_PREVIEW_FILES = 5_000;
export const MAX_REGEX_LENGTH = 200;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * JavaScript 正则无法中断执行，灾难性回溯会直接冻结线程。
 * 这里静态拒绝已知的高风险写法，宁可保守也不让用户输入把界面卡死。
 */
export function isSafeRegexPattern(pattern: string): boolean {
  if (!pattern || pattern.length > MAX_REGEX_LENGTH) return false;
  if (/\\[1-9]/.test(pattern)) return false; // 反向引用
  // 任何「分组 + 量词」都可能产生指数回溯（(a+)+、(a|aa)*b），保守拒绝。
  if (/\)\s*[+*{]/.test(pattern)) return false;
  if (/\{\d{4,}|\{\d*,\d{4,}\}/.test(pattern)) return false; // 超大重复次数
  if (/[+*]{2}/.test(pattern)) return false;
  if ((pattern.match(/[+*{]/g) ?? []).length > 12) return false;
  if ((pattern.match(/\(/g) ?? []).length > 12) return false;
  return true;
}

export function hasUnsafeRegexRules(config: FindReplaceConfig): boolean {
  return config.rules.some(
    (rule) => rule.useRegex && rule.find.length > 0 && !isSafeRegexPattern(rule.find),
  );
}

function replaceText(input: string, rule: FindReplaceRule): string {
  if (!rule.find) return input;

  const useRegex = rule.useRegex ?? false;
  const caseSensitive = rule.caseSensitive ?? true;

  if (useRegex) {
    if (!isSafeRegexPattern(rule.find)) return input;
    try {
      const flags = caseSensitive ? "g" : "gi";
      return input.replace(new RegExp(rule.find, flags), rule.replace);
    } catch {
      return input;
    }
  }

  if (caseSensitive) {
    return input.split(rule.find).join(rule.replace);
  }

  const re = new RegExp(escapeRegex(rule.find), "gi");
  return input.replace(re, rule.replace);
}

function applyFindReplace(
  stem: string,
  extension: string,
  config: FindReplaceConfig,
): { stem: string; extension: string } {
  let newStem = stem;
  let newExt = extension;

  for (const rule of config.rules) {
    if (!rule.find) continue;

    if (rule.replaceExtension) {
      const full = newStem + newExt;
      const replaced = replaceText(full, rule);
      const dot = replaced.lastIndexOf(".");
      if (dot <= 0) {
        newStem = replaced;
        newExt = "";
      } else {
        newStem = replaced.slice(0, dot);
        newExt = replaced.slice(dot);
      }
    } else {
      newStem = replaceText(newStem, rule);
    }
  }

  return { stem: newStem, extension: newExt };
}

function formatNumber(index: number, config: AutoNumberConfig): string {
  return formatSequenceNumber(index, config);
}

function applyAutoNumber(
  _stem: string,
  extension: string,
  config: AutoNumberConfig,
  index: number,
): string {
  const num = formatNumber(index, config);
  return `${config.prefix}${num}${config.suffix}${extension}`;
}

function formatTimestamp(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "";
  const d = new Date(seconds * 1000);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function formatFileInfo(field: InsertConfig["fileInfoField"], file: FileItem): string {
  switch (field) {
    case "size":
      return file.size !== undefined ? String(file.size) : "";
    case "width":
      return file.imageWidth !== undefined ? String(file.imageWidth) : "";
    case "height":
      return file.imageHeight !== undefined ? String(file.imageHeight) : "";
    case "dimensions":
      return file.imageWidth !== undefined && file.imageHeight !== undefined
        ? `${file.imageWidth}x${file.imageHeight}`
        : "";
    case "exif-taken":
      return file.exifTaken ?? "";
    case "id3-title":
      return file.id3Title ?? "";
    case "id3-artist":
      return file.id3Artist ?? "";
    case "id3-album":
      return file.id3Album ?? "";
    case "id3-year":
      return file.id3Year ?? "";
    // 创建时间取文件系统的 created；旧系统不提供时回退到 modified，绝不再混用。
    case "created":
      return formatTimestamp(file.created ?? file.modified);
    case "modified":
      return formatTimestamp(file.modified);
    default:
      return "";
  }
}

function applyInsert(
  stem: string,
  extension: string,
  config: InsertConfig,
  index: number,
  file: FileItem,
): string {
  let content = "";
  switch (config.contentType) {
    case "text":
      content = config.text;
      break;
    case "serial":
      content = String(config.text ? `${config.text}${index + 1}` : index + 1);
      break;
    case "file-info":
      content = formatFileInfo(config.fileInfoField, file);
      break;
  }

  const rawIndex = Number.isFinite(config.index) ? Math.trunc(config.index) : 0;
  const pos = Math.max(0, Math.min(rawIndex, stem.length));

  let newStem = stem;
  switch (config.position) {
    case "start":
      newStem = content + stem;
      break;
    case "end":
      newStem = stem + content;
      break;
    case "index":
      newStem = stem.slice(0, pos) + content + stem.slice(pos);
      break;
  }

  return newStem + extension;
}

function applySmart(
  stem: string,
  extension: string,
  config: SmartRenameConfig,
  file: FileItem,
): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const metaDate =
    file.modified !== undefined
      ? (() => {
          const d = new Date(file.modified * 1000);
          return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
        })()
      : `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

  const extracted = extractDateFromStem(stem);
  const filedate = extracted?.date ?? metaDate;
  const filetime = extracted?.time ?? "";
  const exifdate = file.exifTaken?.split("_")[0] ?? filedate;
  const exiftime = file.exifTaken?.split("_")[1] ?? filetime;
  const width = file.imageWidth !== undefined ? String(file.imageWidth) : "";
  const height = file.imageHeight !== undefined ? String(file.imageHeight) : "";
  const dimensions =
    file.imageWidth !== undefined && file.imageHeight !== undefined
      ? `${file.imageWidth}x${file.imageHeight}`
      : "";
  const artist = file.id3Artist ?? "";
  const title = file.id3Title ?? "";
  const album = file.id3Album ?? "";
  const id3year = file.id3Year ?? "";

  const result = config.template
    .split("{stem}").join(stem)
    .split("{name}").join(file.originalName)
    .split("{ext}").join(extension.replace(/^\./, ""))
    .split("{date}").join(metaDate)
    .split("{filedate}").join(filedate)
    .split("{filetime}").join(filetime)
    .split("{exifdate}").join(exifdate)
    .split("{exiftime}").join(exiftime)
    .split("{width}").join(width)
    .split("{height}").join(height)
    .split("{dimensions}").join(dimensions)
    .split("{artist}").join(artist)
    .split("{title}").join(title)
    .split("{album}").join(album)
    .split("{id3year}").join(id3year)
    .trim();

  // 空模板返回空串，由校验判为 invalid，避免生成 ".jpg" 这种残名。
  if (!result) return "";

  // 模板已显式声明扩展名时不再追加；否则一律补回原扩展名。
  // 旧逻辑用 result.includes(".") 判断，stem 含点时会把扩展名弄丢。
  const templateDeclaresExt =
    /\{ext\}/i.test(config.template) || /\.[A-Za-z0-9]{1,8}\s*$/.test(config.template);
  if (templateDeclaresExt) return result;
  if (extension && !result.toLowerCase().endsWith(extension.toLowerCase())) {
    return result + extension;
  }
  return result;
}

function computeStem(
  file: FileItem,
  mode: RenameMode,
  config: RenameConfig,
  index: number,
): string {
  switch (mode) {
    case "find-replace": {
      const { stem, extension } = applyFindReplace(file.stem, file.extension, config.findReplace);
      return stem + extension;
    }
    case "auto-number":
      return applyAutoNumber(file.stem, file.extension, config.autoNumber, index);
    case "insert":
      return applyInsert(file.stem, file.extension, config.insert, index, file);
    case "manual":
      return (file.manualName ?? file.stem) + file.extension;
    case "smart":
      return applySmart(file.stem, file.extension, config.smart, file);
    default:
      return file.originalName;
  }
}

export function computePreview(
  files: FileItem[],
  mode: RenameMode,
  config: RenameConfig,
  sortOrder: SortOrder,
): FileItem[] {
  const sorted = sortFiles(files, sortOrder);

  // 危险正则会让整个界面失去响应，直接把整批标为不可用并给出原因。
  if (mode === "find-replace" && hasUnsafeRegexRules(config.findReplace)) {
    return sorted.map((file) => ({
      ...file,
      previewName: file.originalName,
      status: "invalid" as const,
      error: "unsafe_pattern",
    }));
  }

  const limit = Math.min(sorted.length, MAX_PREVIEW_FILES);
  const active = sorted.slice(0, limit);

  const computed = active.map((file, index) => {
    let previewName = "";
    let computeError: string | undefined;
    try {
      previewName = computeStem(file, mode, config, index);
    } catch {
      computeError = "preview_error";
    }
    return { file, previewName, computeError };
  });

  const duplicates = buildDuplicateIndex(
    computed.map(({ file, previewName }) => ({ dir: file.dir, previewName })),
  );

  const result = computed.map(({ file, previewName, computeError }) => {
    const status = deriveStatus(file, previewName, duplicates);
    const pendingChange = status === "changed" || status === "conflict" || status === "invalid";

    return {
      ...file,
      previewName,
      status,
      error:
        status === "invalid"
          ? (computeError ?? "invalid")
          : status === "conflict"
            ? "conflict"
            : undefined,
      ...(pendingChange ? { renamePhase: undefined, previousName: undefined } : {}),
    };
  });

  if (sorted.length <= limit) return result;

  const overflow = sorted.slice(limit).map((file) => ({
    ...file,
    previewName: file.originalName,
    status: "invalid" as const,
    error: `file_limit|${MAX_PREVIEW_FILES}`,
    renamePhase: undefined,
    previousName: undefined,
  }));
  return [...result, ...overflow];
}
