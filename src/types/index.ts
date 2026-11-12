export type RenameMode =
  | "find-replace"
  | "insert"
  | "auto-number"
  | "manual"
  | "smart";

export type FileStatus = "unchanged" | "changed" | "conflict" | "invalid";

export type RenamePhase = "renaming" | "renamed" | "rename-failed";

export type SortOrder = "name-asc" | "name-desc" | "modified-asc" | "modified-desc";

export interface FileItem {
  id: string;
  path: string;
  dir: string;
  originalName: string;
  stem: string;
  extension: string;
  previewName: string;
  status: FileStatus;
  renamePhase?: RenamePhase;
  /** 重命名前的文件名，用于列表对比展示 */
  previousName?: string;
  error?: string;
  manualName?: string;
  created?: number;
  modified?: number;
  size?: number;
  imageWidth?: number;
  imageHeight?: number;
  exifTaken?: string;
  id3Title?: string;
  id3Artist?: string;
  id3Album?: string;
  id3Year?: string;
}

export interface FindReplaceRule {
  id: string;
  find: string;
  replace: string;
  replaceExtension: boolean;
  useRegex?: boolean;
  caseSensitive?: boolean;
}

export interface FindReplaceConfig {
  rules: FindReplaceRule[];
}

export type NumberType = "arabic" | "roman" | "alpha";

export interface AutoNumberConfig {
  prefix: string;
  start: number;
  padding: number;
  suffix: string;
  numberType: NumberType;
}

export type InsertContentType = "text" | "serial" | "file-info";
export type InsertPosition = "start" | "end" | "index";
export type FileInfoField =
  | "created"
  | "modified"
  | "size"
  | "width"
  | "height"
  | "dimensions"
  | "exif-taken"
  | "id3-title"
  | "id3-artist"
  | "id3-album"
  | "id3-year";

export interface InsertConfig {
  contentType: InsertContentType;
  position: InsertPosition;
  text: string;
  index: number;
  fileInfoField: FileInfoField;
}

export interface SmartRenameConfig {
  template: string;
}

export interface ManualConfig {
  // 手动编辑数据存在 FileItem.manualName
}

export interface RenameConfig {
  findReplace: FindReplaceConfig;
  autoNumber: AutoNumberConfig;
  insert: InsertConfig;
  smart: SmartRenameConfig;
}

export interface RawFileInfo {
  path: string;
  name: string;
  stem: string;
  extension: string;
  dir: string;
  created?: number;
  modified?: number;
  size?: number;
  imageWidth?: number;
  imageHeight?: number;
  exifTaken?: string;
  id3Title?: string;
  id3Artist?: string;
  id3Album?: string;
  id3Year?: string;
}

export const defaultFindReplaceConfig = (): FindReplaceConfig => ({
  rules: [
    {
      id: crypto.randomUUID(),
      find: "",
      replace: "",
      replaceExtension: false,
      useRegex: false,
      caseSensitive: true,
    },
  ],
});

export const defaultAutoNumberConfig = (): AutoNumberConfig => ({
  prefix: "",
  start: 1,
  padding: 1,
  suffix: "",
  numberType: "arabic",
});

export const defaultInsertConfig = (): InsertConfig => ({
  contentType: "text",
  position: "end",
  text: "",
  index: 0,
  fileInfoField: "modified",
});

export const defaultSmartConfig = (): SmartRenameConfig => ({
  template: "{stem}",
});

export const defaultRenameConfig = (): RenameConfig => ({
  findReplace: defaultFindReplaceConfig(),
  autoNumber: defaultAutoNumberConfig(),
  insert: defaultInsertConfig(),
  smart: defaultSmartConfig(),
});
