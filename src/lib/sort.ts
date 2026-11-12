import type { FileItem, SortOrder } from "../types";

export function sortFiles(files: FileItem[], order: SortOrder): FileItem[] {
  const sorted = [...files];

  sorted.sort((a, b) => {
    switch (order) {
      case "name-asc":
        return a.originalName.localeCompare(b.originalName, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      case "name-desc":
        return b.originalName.localeCompare(a.originalName, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      case "modified-asc":
        return (a.modified ?? 0) - (b.modified ?? 0);
      case "modified-desc":
        return (b.modified ?? 0) - (a.modified ?? 0);
      default:
        return 0;
    }
  });

  return sorted;
}
