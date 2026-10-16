import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import { diffs, diffFixture } from "./fixture";
import { parseDiff } from "./parse";
import { runRules } from "./rules/run";
import type { Finding, Rule } from "./types";

describe("analyze", () => {
  it("returns no findings for a readme-only diff", () => {
    const diff = diffFixture({
      path: "README.md",
      created: true,
      oldStart: 0,
      lines: [{ kind: "+", text: "# hi" }],
    });
    const card = analyze(diff);
    expect(card.findings).toEqual([]);
    expect(card.markdown).toContain("No break or check findings in this diff.");
    expect(card.files).toBe(1);
  });

  it("sorts findings by file, line, then rule id", () => {
    const diff = diffs(
      diffFixture({
        path: "migrations/z.sql",
        created: true,
        oldStart: 0,
        lines: [{ kind: "+", text: "select 1;" }],
      }),
      diffFixture({
        path: "a.ts",
        created: true,
        oldStart: 0,
        lines: [{ kind: "+", text: 'const key = "sk-THISISASECRETVALUE1234567890"' }],
      }),
    );
    const card = analyze(diff);
    expect(card.findings.map((finding) => finding.file)).toEqual(["a.ts", "migrations/z.sql"]);
    expect(card.pullRequest.indexOf("a.ts")).toBeLessThan(card.pullRequest.indexOf("migrations/z.sql"));
  });

  it("keeps the other finding when one rule throws", () => {
    const boom: Rule = {
      id: "boom",
      run() {
        throw new Error("nope");
      },
    };
    const ok: Rule = {
      id: "ok",
      run(): Finding[] {
        return [{ severity: "break", rule: "ok", file: "z.ts", line: 3, summary: "Kept." }];
      },
    };
    const findings = runRules(parseDiff("diff --git a/z.ts b/z.ts\n"), [boom, ok]);
    expect(findings).toEqual([
      {
        severity: "check",
        rule: "rule-failed",
        file: "(rules)",
        line: 1,
        summary: "Rule boom failed and was skipped.",
      },
      { severity: "break", rule: "ok", file: "z.ts", line: 3, summary: "Kept." },
    ]);
  });

  it("counts a binary file and does not flag it", () => {
    const diff = ["diff --git a/a.png b/a.png", "Binary files /dev/null and b/a.png differ", ""].join("\n");
    const card = analyze(diff);
    expect(card.files).toBe(1);
    expect(card.findings).toEqual([]);
  });
});
