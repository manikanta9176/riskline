import type { DiffFile } from "../parse";
import type { Finding, Rule } from "../types";
import { filePath, pathsOf, rowLine } from "./lines";

const declaration = /^(type|input|enum|interface|union|scalar|schema|query|mutation|subscription|fragment|directive)\s/;
const field = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(\([^)]*\))?\s*:/;

function isGraphql(path: string): boolean {
  return /\.(graphql|gql|graphqls)$/.test(path);
}

export const removedGraphqlField: Rule = {
  id: "removed-graphql-field",
  run(files: DiffFile[]): Finding[] {
    const findings: Finding[] = [];
    for (const file of files) {
      if (!pathsOf(file).some(isGraphql)) continue;
      for (const row of file.rows) {
        if (row.kind !== "remove") continue;
        if (declaration.test(row.text.trim())) continue;
        const match = field.exec(row.text);
        if (!match) continue;
        findings.push({
          severity: "break",
          rule: "removed-graphql-field",
          file: filePath(file),
          line: rowLine(row),
          summary: `GraphQL field removed: ${match[1]}.`,
        });
      }
    }
    return findings;
  },
};
