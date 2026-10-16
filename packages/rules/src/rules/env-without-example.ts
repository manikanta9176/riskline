import type { DiffFile } from "../parse.js";
import type { Finding, Rule } from "../types.js";
import { filePath, rowLine } from "./lines.js";

const readers = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /os\.environ\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /os\.environ\.get\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
  /os\.Getenv\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
  /ENV\.fetch\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
  /ENV\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
];

function exampleHas(files: DiffFile[], name: string): boolean {
  const pattern = new RegExp(`(^|[^A-Z0-9_])${name}([^A-Z0-9_]|$)`);
  return files.some((file) => {
    const base = (file.newPath ?? file.oldPath ?? "").split("/").pop();
    if (base !== ".env.example" && base !== ".env.sample") return false;
    return file.rows.some((row) => row.kind === "add" && pattern.test(row.text));
  });
}

export const envWithoutExample: Rule = {
  id: "env-without-example",
  run(files: DiffFile[]): Finding[] {
    const seen = new Set<string>();
    const findings: Finding[] = [];
    for (const file of files) {
      for (const row of file.rows) {
        if (row.kind !== "add") continue;
        for (const reader of readers) {
          reader.lastIndex = 0;
          let match = reader.exec(row.text);
          while (match) {
            const name = match[1];
            if (!seen.has(name) && !exampleHas(files, name)) {
              seen.add(name);
              findings.push({
                severity: "check",
                rule: "env-without-example",
                file: filePath(file),
                line: rowLine(row),
                summary: `Env var ${name} is read and is not added to an example env file.`,
              });
            }
            match = reader.exec(row.text);
          }
        }
      }
    }
    return findings;
  },
};
