import type { DiffFile } from "../parse";
import type { Finding, Rule } from "../types";

export function runRules(files: DiffFile[], rules: Rule[]): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    try {
      findings.push(...rule.run(files));
    } catch {
      findings.push({
        severity: "check",
        rule: "rule-failed",
        file: "(rules)",
        line: 1,
        summary: `Rule ${rule.id} failed and was skipped.`,
      });
    }
  }
  findings.sort((a, b) => {
    const byFile = a.file.localeCompare(b.file);
    if (byFile !== 0) return byFile;
    if (a.line !== b.line) return a.line - b.line;
    return a.rule.localeCompare(b.rule);
  });
  return findings;
}
