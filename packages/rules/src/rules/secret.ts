import type { DiffFile } from "../parse.js";
import type { Finding, Rule } from "../types.js";
import { filePath, rowLine } from "./lines.js";

const patterns = [
  /BEGIN PRIVATE KEY/,
  /BEGIN RSA PRIVATE KEY/,
  /BEGIN OPENSSH PRIVATE KEY/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]+/,
  /github_pat_[A-Za-z0-9_]+/,
  /sk-[A-Za-z0-9_-]{20,}/,
];

export const secret: Rule = {
  id: "secret",
  run(files: DiffFile[]): Finding[] {
    const findings: Finding[] = [];
    for (const file of files) {
      for (const row of file.rows) {
        if (row.kind !== "add") continue;
        if (!patterns.some((pattern) => pattern.test(row.text))) continue;
        findings.push({
          severity: "break",
          rule: "secret",
          file: filePath(file),
          line: rowLine(row),
          summary: "Possible secret added.",
        });
      }
    }
    return findings;
  },
};
