import { describe, expect, it } from "vitest";
import { diffFixture, diffs } from "./fixture.js";
import { parseDiff, pathOf } from "./parse.js";

describe("parseDiff", () => {
  it("records added and removed line numbers from the hunk header", () => {
    const diff = diffFixture({
      path: "src/app.ts",
      lines: [
        { kind: " ", text: "start" },
        { kind: "-", text: "old" },
        { kind: "+", text: "new" },
      ],
    });
    const [file] = parseDiff(diff);
    expect(pathOf(file)).toBe("src/app.ts");
    expect(file.oldPath).toBe("src/app.ts");
    expect(file.newPath).toBe("src/app.ts");
    expect(file.rows).toEqual([
      { kind: "context", text: "start", oldLine: 1, newLine: 1 },
      { kind: "remove", text: "old", oldLine: 2, newLine: null },
      { kind: "add", text: "new", oldLine: null, newLine: 2 },
    ]);
  });

  it("uses the old line number when the file is deleted", () => {
    const diff = diffFixture({
      path: "src/a.test.ts",
      deleted: true,
      lines: [{ kind: "-", text: "expect(true)" }],
      oldStart: 1,
      newStart: 0,
    });
    const [file] = parseDiff(diff);
    expect(file.newPath).toBeNull();
    expect(file.rows[0]).toMatchObject({ kind: "remove", oldLine: 1, newLine: null });
  });

  it("counts a binary file and keeps no rows", () => {
    const diff = [
      "diff --git a/a.png b/a.png",
      "new file mode 100644",
      "Binary files /dev/null and b/a.png differ",
      "",
    ].join("\n");
    const [file] = parseDiff(diff);
    expect(file.binary).toBe(true);
    expect(file.rows).toEqual([]);
    expect(parseDiff(diff)).toHaveLength(1);
  });

  it("counts a rename with an empty hunk as the new path", () => {
    const diff = ["diff --git a/old.txt b/new.txt", "rename from old.txt", "rename to new.txt", "similarity index 100%", ""].join("\n");
    const [file] = parseDiff(diff);
    expect(file.oldPath).toBe("old.txt");
    expect(file.newPath).toBe("new.txt");
    expect(file.rows).toEqual([]);
  });

  it("parses two files", () => {
    const diff = diffs(
      diffFixture({ path: "a.txt", lines: [{ kind: "+", text: "a" }], created: true, oldStart: 0 }),
      diffFixture({ path: "b.txt", lines: [{ kind: "+", text: "b" }], created: true, oldStart: 0 }),
    );
    expect(parseDiff(diff).map(pathOf)).toEqual(["a.txt", "b.txt"]);
  });
});
