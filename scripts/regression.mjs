/**
 * 前端纯函数回归：用 esbuild 把 TS 模块打包成临时 ESM，再用 Node 跑断言。
 * 覆盖文件名校验、序号边界、正则防护、冲突检测、预览一致性与撤销还原。
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "batch-rename-regression-"));
const outFile = path.join(tempDir, "bundle.mjs");

const entry = `
export * as pathLib from "./src/lib/path.ts";
export * as numberLib from "./src/lib/numberFormat.ts";
export * as validateLib from "./src/lib/validate.ts";
export * as previewLib from "./src/lib/previewCore.ts";
export * as applyLib from "./src/lib/renameApply.ts";
`;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

try {
  await build({
    stdin: {
      contents: entry,
      resolveDir: root,
      loader: "ts",
      sourcefile: "regression-entry.ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: outFile,
    logLevel: "silent",
  });

  const m = await import(pathToFileURL(outFile).href);
  const { pathLib, numberLib, validateLib, previewLib, applyLib } = m;

  const DIR = "C:\\tmp";
  function makeFile(name, overrides = {}) {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : "";
    return {
      id: name,
      path: `${DIR}\\${name}`,
      dir: DIR,
      originalName: name,
      stem,
      extension,
      previewName: name,
      status: "unchanged",
      ...overrides,
    };
  }

  function makeConfig(overrides = {}) {
    return {
      findReplace: {
        rules: [
          {
            id: "r1",
            find: "IMG_",
            replace: "照片_",
            replaceExtension: false,
            useRegex: false,
            caseSensitive: true,
          },
        ],
      },
      autoNumber: { prefix: "", start: 1, padding: 1, suffix: "", numberType: "arabic" },
      insert: { contentType: "text", position: "end", text: "_x", index: 0, fileInfoField: "modified" },
      smart: { template: "{stem}" },
      ...overrides,
    };
  }

  console.log("文件名校验：");
  check("正常中文名与多点扩展名通过", () => {
    assert.equal(pathLib.isValidFileName("照片_001.jpg"), true);
    assert.equal(pathLib.isValidFileName("a.b.c.txt"), true);
    assert.equal(pathLib.isValidFileName(".gitignore"), true);
  });
  check("路径穿越、盘符、非法字符被拒绝", () => {
    for (const bad of ["..\\evil.txt", "../evil.txt", "C:\\x.txt", "a/b.txt", "a<b>.txt", "a|b.txt"]) {
      assert.equal(pathLib.isValidFileName(bad), false, bad);
    }
  });
  check("保留设备名 / 控制字符 / 首尾空格点 / 超长被拒绝", () => {
    for (const bad of ["CON", "con.txt", "NUL.log", "COM1.txt", "a\u0001b.txt", "trailing.", " lead.txt", "a".repeat(256)]) {
      assert.equal(pathLib.isValidFileName(bad), false, bad);
    }
  });
  check("splitFileName 保留多点 stem", () => {
    assert.deepEqual(pathLib.splitFileName("a.b.jpg"), { stem: "a.b", extension: ".jpg" });
    assert.deepEqual(pathLib.splitFileName("README"), { stem: "README", extension: "" });
  });

  console.log("序号边界：");
  check("Infinity / NaN / 超大 padding 不冻结、不抛异常", () => {
    const base = { prefix: "", start: 1, padding: 1, suffix: "", numberType: "arabic" };
    assert.equal(numberLib.formatSequenceNumber(0, { ...base, start: Infinity, numberType: "roman" }), "I");
    assert.equal(numberLib.formatSequenceNumber(0, { ...base, start: NaN, numberType: "alpha" }), "A");
    assert.equal(numberLib.formatSequenceNumber(0, { ...base, padding: 1e9 }).length, 32);
    assert.equal(numberLib.toRoman(Infinity), "0");
    assert.equal(numberLib.toAlpha(Infinity), "0");
  });
  check("正常补零 / 罗马 / 字母序号", () => {
    const base = { prefix: "", start: 1, padding: 4, suffix: "", numberType: "arabic" };
    assert.equal(numberLib.formatSequenceNumber(0, base), "0001");
    assert.equal(numberLib.formatSequenceNumber(3, { ...base, numberType: "roman", padding: 1 }), "IV");
    assert.equal(numberLib.formatSequenceNumber(27, { ...base, numberType: "alpha", padding: 1 }), "AB");
  });

  console.log("正则防护：");
  check("嵌套量词 / 反向引用 / 超长模式被拒绝", () => {
    assert.equal(previewLib.isSafeRegexPattern("(a+)+$"), false);
    assert.equal(previewLib.isSafeRegexPattern("(a|aa)*b"), false);
    assert.equal(previewLib.isSafeRegexPattern("(a)\\1"), false);
    assert.equal(previewLib.isSafeRegexPattern("a{5000}"), false);
    assert.equal(previewLib.isSafeRegexPattern("a".repeat(201)), false);
    assert.equal(previewLib.isSafeRegexPattern("\\d+"), true);
  });

  console.log("预览与冲突：");
  check("查找替换生成正确目标名", () => {
    const result = previewLib.computePreview([makeFile("IMG_001.jpg")], "find-replace", makeConfig(), "name-asc");
    assert.equal(result[0].previewName, "照片_001.jpg");
    assert.equal(result[0].status, "changed");
  });
  check("智能模板 stem 含点时仍保留扩展名", () => {
    const result = previewLib.computePreview([makeFile("a.b.jpg")], "smart", makeConfig(), "name-asc");
    assert.equal(result[0].previewName, "a.b.jpg");
  });
  check("空智能模板判为非法，不生成 .jpg 残名", () => {
    const result = previewLib.computePreview(
      [makeFile("a.jpg")],
      "smart",
      makeConfig({ smart: { template: "" } }),
      "name-asc",
    );
    assert.equal(result[0].previewName, "");
    assert.equal(result[0].status, "invalid");
  });
  check("危险正则整批标 invalid 并给出原因", () => {
    const cfg = makeConfig({
      findReplace: { rules: [{ id: "r", find: "(a+)+$", replace: "x", replaceExtension: false, useRegex: true, caseSensitive: true }] },
    });
    const result = previewLib.computePreview([makeFile("a.jpg")], "find-replace", cfg, "name-asc");
    assert.equal(result[0].status, "invalid");
    assert.equal(result[0].error, "unsafe_pattern");
  });
  check("同目录重名冲突、不同目录同名不冲突", () => {
    const cfg = makeConfig({ smart: { template: "same" } });
    const sameDir = previewLib.computePreview([makeFile("a.jpg"), makeFile("b.jpg")], "smart", cfg, "name-asc");
    assert.equal(sameDir.every((f) => f.status === "conflict"), true);
    const diffDir = previewLib.computePreview(
      [makeFile("a.jpg"), makeFile("b.jpg", { dir: "D:\\other", path: "D:\\other\\b.jpg" })],
      "smart",
      cfg,
      "name-asc",
    );
    assert.equal(diffDir.every((f) => f.status === "changed"), true);
  });
  check("大小写不敏感重名被判冲突", () => {
    const cfg = makeConfig({ smart: { template: "SAME" } });
    const files = [makeFile("a.jpg"), makeFile("b.JPG")];
    const result = previewLib.computePreview(files, "smart", cfg, "name-asc");
    assert.equal(result.every((f) => f.status === "conflict"), true);
    const dup = validateLib.buildDuplicateIndex([
      { dir: DIR, previewName: "SAME.jpg" },
      { dir: DIR, previewName: "same.JPG" },
    ]);
    assert.equal(dup.get(validateLib.duplicateKey(DIR, "SAME.jpg")), 2);
  });
  check("超过预览上限时后续条目标为 invalid", () => {
    const many = Array.from({ length: previewLib.MAX_PREVIEW_FILES + 2 }, (_, i) => makeFile(`f${String(i).padStart(5, "0")}.txt`));
    const result = previewLib.computePreview(many, "smart", makeConfig(), "name-asc");
    assert.equal(result.length, many.length);
    assert.equal(result.at(-1).status, "invalid");
    assert.ok(result.at(-1).error.startsWith("file_limit"));
  });

  console.log("撤销还原：");
  check("只还原本次成功的记录，且路径回到原名", () => {
    const files = [makeFile("new.txt", { path: `${DIR}\\new.txt` }), makeFile("keep.txt", { path: `${DIR}\\keep.txt` })];
    const records = [{ oldPath: `${DIR}\\new.txt`, newPath: `${DIR}\\old.txt` }];
    const out = applyLib.applyUndoToFiles(files, records);
    assert.equal(out[0].path, `${DIR}\\old.txt`);
    assert.equal(out[0].originalName, "old.txt");
    assert.equal(out[1].path, `${DIR}\\keep.txt`);
  });

  console.log("i18n 键一致性：");
  check("中英文案键集合完全一致", () => {
    const source = readFileSync(path.join(root, "src/i18n/index.ts"), "utf8");
    const zhBody = source.split("  zh: {")[1].split("  en: {")[0];
    const enBody = source.split("  en: {")[1].split("} as const;")[0];
    const keys = (body) => new Set([...body.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9_]*):/gm)].map((x) => x[1]));
    const zh = keys(zhBody);
    const en = keys(enBody);
    assert.deepEqual([...zh].filter((k) => !en.has(k)), []);
    assert.deepEqual([...en].filter((k) => !zh.has(k)), []);
  });

  console.log(`\n通过 ${passed} 项回归检查。`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
