import type { DiffFile, DiffRow } from "../parse.js";
import { pathOf } from "../parse.js";
import type { Finding, Rule } from "../types.js";
import { rowLine } from "./lines.js";

const depSections = new Set(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]);
const cargoTables = new Set(["dependencies", "dev-dependencies", "build-dependencies"]);

type Touch = { name: string; text: string; kind: "add" | "remove"; line: number };

function baseName(file: DiffFile): string {
  const path = pathOf(file);
  return path.split("/").pop() ?? path;
}

function toFindings(file: DiffFile, touches: Touch[]): Finding[] {
  const grouped = new Map<string, Touch[]>();
  for (const touch of touches) {
    const list = grouped.get(touch.name) ?? [];
    list.push(touch);
    grouped.set(touch.name, list);
  }
  const findings: Finding[] = [];
  for (const [name, list] of grouped) {
    const added = list.filter((item) => item.kind === "add");
    const removed = list.filter((item) => item.kind === "remove");
    if (added.length === 0) continue;
    const addedText = added.map((item) => item.text).sort().join("\n");
    const removedText = removed.map((item) => item.text).sort().join("\n");
    const summary = removed.length === 0 ? `Dependency ${name} was added.` : `Dependency ${name} changed version.`;
    if (removed.length !== 0 && addedText === removedText) continue;
    findings.push({
      severity: "check",
      rule: "dependency",
      file: pathOf(file),
      line: added[0].line,
      summary,
    });
  }
  return findings;
}

function changed(row: DiffRow): row is DiffRow & { kind: "add" | "remove" } {
  return row.kind === "add" || row.kind === "remove";
}

function packageJsonTouches(file: DiffFile): Touch[] {
  const touches: Touch[] = [];
  let section: string | null = null;
  let depth = 0;
  for (const row of file.rows) {
    if (depth === 0) {
      const header = /^\s*"([^"]+)"\s*:\s*[{[]/.exec(row.text);
      if (header) section = header[1];
    }
    if (changed(row) && section && depSections.has(section) && depth >= 1) {
      const pkg = /^\s*"([^"]+)"\s*:\s*"([^"]*)"\s*,?\s*$/.exec(row.text);
      if (pkg) touches.push({ name: pkg[1], text: row.text.trim(), kind: row.kind, line: rowLine(row) });
    }
    for (const ch of row.text) {
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") depth--;
    }
    if (depth === 0) section = null;
  }
  return touches;
}

function cargoTouches(file: DiffFile): Touch[] {
  const touches: Touch[] = [];
  let section: string | null = null;
  for (const row of file.rows) {
    const table = /^\s*\[([^\]]+)\]\s*$/.exec(row.text);
    if (table) section = table[1];
    if (!changed(row) || !section || !cargoTables.has(section)) continue;
    const pkg = /^\s*([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(row.text);
    if (!pkg) continue;
    touches.push({ name: pkg[1], text: row.text.trim(), kind: row.kind, line: rowLine(row) });
  }
  return touches;
}

function goTouches(file: DiffFile): Touch[] {
  const touches: Touch[] = [];
  for (const row of file.rows) {
    if (!changed(row)) continue;
    const match = /^\s*([^\s]+)\s+(v\d\S*)/.exec(row.text);
    if (!match) continue;
    touches.push({ name: match[1], text: row.text.trim(), kind: row.kind, line: rowLine(row) });
  }
  return touches;
}

function requirementName(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) return null;
  const name = trimmed.split(/\[| |==|>=|<=|~=|!=/)[0];
  return name || null;
}

function requirementTouches(file: DiffFile): Touch[] {
  const touches: Touch[] = [];
  for (const row of file.rows) {
    if (!changed(row)) continue;
    const name = requirementName(row.text);
    if (!name) continue;
    touches.push({ name, text: row.text.trim(), kind: row.kind, line: rowLine(row) });
  }
  return touches;
}

function pepName(value: string): string {
  return value.split(/ |==|>=|<=|~=|!=/)[0];
}

function pyprojectTouches(file: DiffFile): Touch[] {
  const touches: Touch[] = [];
  let header: string | null = null;
  let inProjectDeps = false;
  for (const row of file.rows) {
    const table = /^\s*\[([^\]]+)\]\s*$/.exec(row.text);
    if (table) {
      header = table[1];
      inProjectDeps = false;
      continue;
    }
    const poetry = header === "tool.poetry.dependencies" || /^tool\.poetry\.group\.[^.]+\.dependencies$/.test(header ?? "");
    if (poetry && changed(row)) {
      const pkg = /^\s*([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(row.text);
      if (pkg) touches.push({ name: pkg[1], text: row.text.trim(), kind: row.kind, line: rowLine(row) });
      continue;
    }
    if (header !== "project") continue;
    if (/^\s*dependencies\s*=\s*\[/.test(row.text)) inProjectDeps = true;
    if (!inProjectDeps) continue;
    if (changed(row)) {
      const quoted = /"([^"]+)"/g;
      let match = quoted.exec(row.text);
      while (match) {
        const name = pepName(match[1]);
        if (name) touches.push({ name, text: match[1], kind: row.kind, line: rowLine(row) });
        match = quoted.exec(row.text);
      }
    }
    if (row.text.includes("]")) inProjectDeps = false;
  }
  return touches;
}

export const dependency: Rule = {
  id: "dependency",
  run(files: DiffFile[]): Finding[] {
    const findings: Finding[] = [];
    for (const file of files) {
      const name = baseName(file);
      if (name === "package.json") findings.push(...toFindings(file, packageJsonTouches(file)));
      else if (name === "Cargo.toml") findings.push(...toFindings(file, cargoTouches(file)));
      else if (name === "go.mod") findings.push(...toFindings(file, goTouches(file)));
      else if (name === "requirements.txt") findings.push(...toFindings(file, requirementTouches(file)));
      else if (name === "pyproject.toml") findings.push(...toFindings(file, pyprojectTouches(file)));
    }
    return findings;
  },
};
