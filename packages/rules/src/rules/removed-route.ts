import type { DiffFile } from "../parse";
import type { Finding, Rule } from "../types";
import { filePath, rowLine } from "./lines";

const calls: Array<{ needle: string; method: string | null }> = [
  { needle: "app.get(", method: "get" },
  { needle: "app.post(", method: "post" },
  { needle: "app.put(", method: "put" },
  { needle: "app.patch(", method: "patch" },
  { needle: "app.delete(", method: "delete" },
  { needle: "router.get(", method: "get" },
  { needle: "router.post(", method: "post" },
  { needle: "router.put(", method: "put" },
  { needle: "router.patch(", method: "patch" },
  { needle: "router.delete(", method: "delete" },
  { needle: "@app.get(", method: "get" },
  { needle: "@app.post(", method: "post" },
  { needle: "@app.put(", method: "put" },
  { needle: "@app.patch(", method: "patch" },
  { needle: "@app.delete(", method: "delete" },
  { needle: "@app.route(", method: null },
  { needle: "http.Handle(", method: null },
];

function summary(method: string | null, path: string | null): string {
  if (method && path) return `HTTP ${method} route removed: ${path}.`;
  if (method) return `HTTP ${method} route removed.`;
  if (path) return `HTTP route removed: ${path}.`;
  return "HTTP route removed.";
}

export const removedRoute: Rule = {
  id: "removed-route",
  run(files: DiffFile[]): Finding[] {
    const findings: Finding[] = [];
    for (const file of files) {
      for (const row of file.rows) {
        if (row.kind !== "remove") continue;
        const call = calls.find((item) => row.text.includes(item.needle));
        if (!call) continue;
        const quoted = /(['"])(.*?)\1/.exec(row.text);
        findings.push({
          severity: "break",
          rule: "removed-route",
          file: filePath(file),
          line: rowLine(row),
          summary: summary(call.method, quoted ? quoted[2] : null),
        });
      }
    }
    return findings;
  },
};
