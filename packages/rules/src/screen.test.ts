import { describe, expect, it } from "vitest";
import { MAX_DIFF_BYTES, screenDiff } from "./screen";

const diff = ["diff --git a/a.txt b/a.txt", "--- a/a.txt", "+++ b/a.txt", "@@ -0,0 +1 @@", "+hi", ""].join("\n");

describe("screenDiff", () => {
  it("accepts a unified diff", () => {
    expect(screenDiff(diff)).toEqual({ ok: true, diff });
  });

  it("rejects empty input", () => {
    expect(screenDiff("  \n")).toEqual({
      ok: false,
      error: "empty",
      message: "Paste a unified diff.",
    });
  });

  it("rejects text that is not a diff", () => {
    expect(screenDiff("hello")).toEqual({
      ok: false,
      error: "not-diff",
      message: "This is not a unified diff. Use git diff or git diff <base>...HEAD.",
    });
  });

  it("rejects input over 2 MB without parsing", () => {
    expect(MAX_DIFF_BYTES).toBe(2 * 1024 * 1024);
    const huge = `${"a".repeat(MAX_DIFF_BYTES + 1)}`;
    expect(screenDiff(huge)).toEqual({
      ok: false,
      error: "too-large",
      message: "This diff is over 2 MB. Run the CLI on the branch.",
    });
  });
});
