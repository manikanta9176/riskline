import type { DiffFile, DiffRow } from "../parse.js";
import { pathOf } from "../parse.js";

export function rowLine(row: DiffRow): number {
  return row.newLine ?? row.oldLine ?? 1;
}

export function firstChangedLine(file: DiffFile): number | null {
  const row = file.rows.find((item) => item.kind === "add" || item.kind === "remove");
  return row ? rowLine(row) : null;
}

export function filePath(file: DiffFile): string {
  return pathOf(file);
}

export function pathsOf(file: DiffFile): string[] {
  return [file.oldPath, file.newPath].filter((item): item is string => Boolean(item));
}
