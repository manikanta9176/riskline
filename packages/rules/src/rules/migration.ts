import type { DiffFile } from "../parse.js";
import type { Finding, Rule } from "../types.js";
import { filePath, firstChangedLine, pathsOf } from "./lines.js";

const roots = ["migrations/", "prisma/migrations/", "drizzle/", "alembic/versions/", "db/migrate/"];

function isMigration(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return roots.some((root) => normalized.startsWith(root) || normalized.includes(`/${root}`));
}

export const migration: Rule = {
  id: "migration",
  run(files: DiffFile[]): Finding[] {
    const findings: Finding[] = [];
    for (const file of files) {
      if (!pathsOf(file).some(isMigration)) continue;
      const line = firstChangedLine(file);
      if (line === null) continue;
      findings.push({
        severity: "break",
        rule: "migration",
        file: filePath(file),
        line,
        summary: "Database migration changed.",
      });
    }
    return findings;
  },
};
