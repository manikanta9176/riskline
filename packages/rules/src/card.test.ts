import { describe, expect, it } from "vitest";
import { renderCard } from "./card.js";
import type { DiffFile } from "./parse.js";
import type { Finding } from "./types.js";

const files: DiffFile[] = [
  { oldPath: "a.ts", newPath: "a.ts", binary: false, rows: [] },
  { oldPath: "b.ts", newPath: "b.ts", binary: false, rows: [] },
];

const findings: Finding[] = [
  { severity: "break", rule: "secret", file: "a.ts", line: 4, summary: "Possible secret added." },
  { severity: "check", rule: "dependency", file: "b.ts", line: 2, summary: "Dependency hono was added." },
];

describe("renderCard", () => {
  it("renders break and check sections and a pull request body", () => {
    const card = renderCard(files, findings);
    expect(card.files).toBe(2);
    expect(card.breakCount).toBe(1);
    expect(card.checkCount).toBe(1);
    expect(card.markdown).toContain("Files: 2 · Break: 1 · Check: 1");
    expect(card.markdown).toContain("## Break");
    expect(card.markdown).toContain("- `a.ts` line 4 — Possible secret added.");
    expect(card.markdown).toContain("## Check");
    expect(card.markdown).toContain("- `b.ts` line 2 — Dependency hono was added.");
    expect(card.pullRequest).toBe(
      [
        "## What can break",
        "- Possible secret added. (`a.ts:4`)",
        "",
        "## Confirm before merge",
        "- [ ] Dependency hono was added. (`b.ts:2`)",
        "",
      ].join("\n"),
    );
    expect(card.pullRequest).not.toContain("# Riskline");
    expect(card.pullRequest).not.toContain("## Pull request");
    expect(card.markdown).toContain(card.pullRequest.trimEnd());
  });

  it("says none when there are no findings", () => {
    const card = renderCard(files.slice(0, 1), []);
    expect(card.markdown).toContain("No break or check findings in this diff.");
    expect(card.markdown).not.toContain("## Break");
    expect(card.markdown).not.toContain("## Check");
    expect(card.pullRequest).toContain("## What can break\nNone.");
    expect(card.pullRequest).toContain("## Confirm before merge\nNone.");
  });
});
