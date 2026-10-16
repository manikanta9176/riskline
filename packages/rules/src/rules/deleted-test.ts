import type { DiffFile } from "../parse";
import type { Finding, Rule } from "../types";
import { filePath, firstChangedLine, pathsOf } from "./lines";

function isTest(path: string): boolean {
  const name = path.split("/").pop() ?? path;
  return (
    name.includes(".test.") ||
    name.includes(".spec.") ||
    name.endsWith("_test.go") ||
    (name.startsWith("test_") && name.endsWith(".py")) ||
    path.split("/").includes("__tests__")
  );
}

export const deletedTest: Rule = {
  id: "deleted-test",
  run(files: DiffFile[]): Finding[] {
    const findings: Finding[] = [];
    for (const file of files) {
      if (!pathsOf(file).some(isTest)) continue;
      const lost = file.newPath === null || file.rows.some((row) => row.kind === "remove" && row.text.trim() !== "");
      if (!lost) continue;
      const line = firstChangedLine(file);
      if (line === null) continue;
      findings.push({
        severity: "break",
        rule: "deleted-test",
        file: filePath(file),
        line,
        summary: "Test coverage was removed.",
      });
    }
    return findings;
  },
};
