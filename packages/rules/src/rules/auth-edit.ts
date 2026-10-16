import type { DiffFile } from "../parse.js";
import type { Finding, Rule } from "../types.js";
import { filePath, firstChangedLine, pathsOf } from "./lines.js";

const tokens = new Set(["auth", "session", "permission", "permissions", "rbac"]);

function matches(path: string): boolean {
  return path.split("/").some((segment) =>
    segment.split(/[^A-Za-z]+/).some((token) => tokens.has(token.toLowerCase())),
  );
}

export const authEdit: Rule = {
  id: "auth-edit",
  run(files: DiffFile[]): Finding[] {
    const findings: Finding[] = [];
    for (const file of files) {
      if (!pathsOf(file).some(matches)) continue;
      const line = firstChangedLine(file);
      if (line === null) continue;
      findings.push({
        severity: "check",
        rule: "auth-edit",
        file: filePath(file),
        line,
        summary: "Auth or permission code changed.",
      });
    }
    return findings;
  },
};
