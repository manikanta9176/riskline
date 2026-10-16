import { describe, expect, it } from "vitest";
import { MAX_DIFF_BYTES } from "@riskline/rules";
import { checkDiff } from "./check-diff.js";

const diff = ["diff --git a/README.md b/README.md", "--- /dev/null", "+++ b/README.md", "@@ -0,0 +1 @@", "+# hi", ""].join("\n");

describe("checkDiff", () => {
  it("returns the website messages and no card for bad input", () => {
    expect(checkDiff("  ")).toEqual({ kind: "message", message: "Paste a unified diff." });
    expect(checkDiff("hello")).toEqual({
      kind: "message",
      message: "This is not a unified diff. Use git diff or git diff <base>...HEAD.",
    });
    expect(checkDiff("a".repeat(MAX_DIFF_BYTES + 1))).toEqual({
      kind: "message",
      message: "This diff is over 2 MB. Run the CLI on the branch.",
    });
  });

  it("returns the same card analyze would return", () => {
    const result = checkDiff(diff);
    expect(result.kind).toBe("card");
    if (result.kind !== "card") return;
    expect(result.card.markdown).toContain("# Riskline");
    expect(result.card.pullRequest.startsWith("## What can break")).toBe(true);
    expect(result.card.pullRequest).not.toContain("# Riskline");
    expect(result.card.pullRequest).not.toContain("## Pull request");
  });
});
