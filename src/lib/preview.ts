import type { FileItem, RawFileInfo } from "../types";

export function rawToFileItem(raw: RawFileInfo): FileItem {
  return {
    id: crypto.randomUUID(),
    path: raw.path,
    dir: raw.dir,
    originalName: raw.name,
    stem: raw.stem,
    extension: raw.extension,
    previewName: raw.name,
    status: "unchanged",
    created: raw.created,
    modified: raw.modified,
    size: raw.size,
    imageWidth: raw.imageWidth,
    imageHeight: raw.imageHeight,
    exifTaken: raw.exifTaken,
    id3Title: raw.id3Title,
    id3Artist: raw.id3Artist,
    id3Album: raw.id3Album,
    id3Year: raw.id3Year,
  };
}

export { computePreview } from "./previewCore";
