import { spawnSync } from "node:child_process";
import { analyze, screenDiff } from "@riskline/rules";

export type Io = {
  cwd: string;
  isTTY: boolean;
  readStdin: () => string;
  readFile: (path: string) => string;
};

export type CliResult = { code: number; stdout: string; stderr: string };

const cliMessages = {
  empty: "No diff to read. Pipe a diff, pass --file, or run inside a git repository.\n",
  "not-diff": "This is not a unified diff. Use git diff or git diff <base>...HEAD.\n",
  "too-large": "This diff is over 2 MB.\n",
  "no-base": "No base ref. Pass --base, or create main.\n",
};

function fail(stderr: string, code = 1): CliResult {
  return { code, stdout: "", stderr };
}

function git(cwd: string, args: string[]) {
  return spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function readGitDiff(cwd: string, base: string | null): CliResult | { text: string } {
  let resolved = base;
  if (!resolved) {
    if (git(cwd, ["rev-parse", "--verify", "--quiet", "main"]).status === 0) resolved = "main";
    else if (git(cwd, ["rev-parse", "--verify", "--quiet", "master"]).status === 0) resolved = "master";
    else return fail(cliMessages["no-base"]);
  }
  const diff = git(cwd, ["diff", `${resolved}...HEAD`]);
  if (diff.status !== 0) return fail(diff.stderr || "git diff failed\n");
  return { text: diff.stdout };
}

export async function run(argv: string[], io: Io): Promise<CliResult> {
  let file: string | null = null;
  let base: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--file") {
      const value = argv[index + 1];
      if (!value) return fail("Missing value for --file.\n");
      file = value;
      index += 1;
      continue;
    }
    if (arg === "--base") {
      const value = argv[index + 1];
      if (!value) return fail("Missing value for --base.\n");
      base = value;
      index += 1;
      continue;
    }
    return fail(`Unknown argument ${arg}.\n`);
  }

  let text = "";
  if (file) {
    try {
      text = io.readFile(file);
    } catch {
      return fail(`Cannot read ${file}.\n`);
    }
  } else if (!io.isTTY) {
    text = io.readStdin();
  } else {
    const inside = git(io.cwd, ["rev-parse", "--is-inside-work-tree"]);
    if (inside.status !== 0 || inside.stdout.trim() !== "true") return fail(cliMessages.empty);
    const diff = readGitDiff(io.cwd, base);
    if ("code" in diff) return diff;
    text = diff.text;
  }

  const screened = screenDiff(text);
  if (!screened.ok) {
    const code = screened.error === "too-large" ? 2 : 1;
    const stderr = screened.error === "empty" ? cliMessages.empty : screened.error === "too-large" ? cliMessages["too-large"] : cliMessages["not-diff"];
    return fail(stderr, code);
  }
  const card = analyze(screened.diff);
  return { code: 0, stdout: card.markdown.endsWith("\n") ? card.markdown : `${card.markdown}\n`, stderr: "" };
}
