import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_DIFF_BYTES } from "@riskline/rules";
import { run } from "./run.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = ["diff --git a/README.md b/README.md", "--- /dev/null", "+++ b/README.md", "@@ -0,0 +1 @@", "+# hi", ""].join("\n");

function spawnCli(args: string[], input?: string) {
  const tsxBin = path.join(packageRoot, "node_modules", ".bin", "tsx");
  return spawnSync(tsxBin, ["src/main.ts", ...args], {
    cwd: packageRoot,
    input,
    encoding: "utf8",
  });
}

describe("riskline cli", () => {
  it("prints a card from --file and exits 0", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "riskline-"));
    const file = path.join(dir, "change.diff");
    writeFileSync(file, fixture);
    const result = spawnCli(["--file", file]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("# Riskline");
    expect(result.stdout).toContain("No break or check findings in this diff.");
    expect(result.stderr).toBe("");
  });

  it("prints a card from stdin", () => {
    const result = spawnCli([], fixture);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Files: 1 · Break: 0 · Check: 0");
  });

  it("exits 1 for an empty pipe and for a non-diff", () => {
    const empty = spawnCli([], "");
    expect(empty.status).toBe(1);
    expect(empty.stderr).toContain("No diff to read. Pipe a diff, pass --file, or run inside a git repository.");

    const bad = spawnCli([], "hello");
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain("This is not a unified diff. Use git diff or git diff <base>...HEAD.");
  });

  it("exits 2 when the file is over 2 MB", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "riskline-"));
    const file = path.join(dir, "huge.diff");
    writeFileSync(file, "a".repeat(MAX_DIFF_BYTES + 1));
    const result = spawnCli(["--file", file]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("This diff is over 2 MB.");
    expect(result.stdout).toBe("");
  });

  it("exits 1 when --file cannot be read", () => {
    const result = spawnCli(["--file", "/no/such/riskline.diff"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Cannot read /no/such/riskline.diff.");
    expect(result.stdout).toBe("");
  });

  it("diffs the branch against main when stdin is a terminal", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "riskline-repo-"));
    const git = (args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    git(["init", "-b", "main"]);
    git(["config", "user.email", "riskline@example.com"]);
    git(["config", "user.name", "Riskline"]);
    writeFileSync(path.join(dir, "README.md"), "# hi\n");
    git(["add", "README.md"]);
    git(["commit", "-m", "init"]);
    git(["checkout", "-b", "feature"]);
    mkdirSync(path.join(dir, "prisma", "migrations"), { recursive: true });
    writeFileSync(path.join(dir, "prisma", "migrations", "001.sql"), "create table users ();\n");
    git(["add", "."]);
    git(["commit", "-m", "migrate"]);
    const result = await run([], {
      cwd: dir,
      isTTY: true,
      readStdin: () => {
        throw new Error("stdin should not be read");
      },
      readFile: () => {
        throw new Error("file should not be read");
      },
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Database migration changed.");
  });

  it("prints a card when --base main is passed on a feature branch", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "riskline-base-main-"));
    const git = (args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    git(["init", "-b", "main"]);
    git(["config", "user.email", "riskline@example.com"]);
    git(["config", "user.name", "Riskline"]);
    writeFileSync(path.join(dir, "README.md"), "# hi\n");
    git(["add", "README.md"]);
    git(["commit", "-m", "init"]);
    git(["checkout", "-b", "feature"]);
    mkdirSync(path.join(dir, "prisma", "migrations"), { recursive: true });
    writeFileSync(path.join(dir, "prisma", "migrations", "001.sql"), "create table users ();\n");
    git(["add", "."]);
    git(["commit", "-m", "migrate"]);
    const result = await run(["--base", "main"], {
      cwd: dir,
      isTTY: true,
      readStdin: () => {
        throw new Error("stdin should not be read");
      },
      readFile: () => {
        throw new Error("file should not be read");
      },
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("# Riskline");
    expect(result.stdout).toContain("Database migration changed.");
    expect(result.stderr).toBe("");
  });

  it("returns git's own error when an explicit --base does not exist", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "riskline-bad-base-"));
    const git = (args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    git(["init", "-b", "main"]);
    git(["config", "user.email", "riskline@example.com"]);
    git(["config", "user.name", "Riskline"]);
    writeFileSync(path.join(dir, "README.md"), "# hi\n");
    git(["add", "README.md"]);
    git(["commit", "-m", "init"]);
    git(["checkout", "-b", "feature"]);
    const result = await run(["--base", "does-not-exist"], {
      cwd: dir,
      isTTY: true,
      readStdin: () => {
        throw new Error("stdin should not be read");
      },
      readFile: () => {
        throw new Error("file should not be read");
      },
    });
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("No base ref. Pass --base, or create main.");
    expect(result.stderr).toContain("does-not-exist");
  });

  it("exits 1 when the repo has no main or master", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "riskline-nobase-"));
    spawnSync("git", ["init", "-b", "trunk"], { cwd: dir, encoding: "utf8" });
    const result = await run([], {
      cwd: dir,
      isTTY: true,
      readStdin: () => "",
      readFile: () => "",
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("No base ref. Pass --base, or create main.");
  });
});
