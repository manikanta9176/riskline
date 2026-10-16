export type DiffRow = {
  kind: "context" | "add" | "remove";
  text: string;
  oldLine: number | null;
  newLine: number | null;
};

export type DiffFile = {
  oldPath: string | null;
  newPath: string | null;
  binary: boolean;
  rows: DiffRow[];
};

export function pathOf(file: DiffFile): string {
  return file.newPath ?? file.oldPath ?? "(unknown)";
}

export function isUnifiedDiff(input: string): boolean {
  if (input.includes("diff --git ")) return true;
  const lines = input.split(/\r?\n/);
  let sawMinus = false;
  let sawPlus = false;
  let sawHunk = false;
  for (const line of lines) {
    if (line.startsWith("--- ")) sawMinus = true;
    else if (line.startsWith("+++ ")) sawPlus = true;
    else if (line.startsWith("@@")) sawHunk = true;
  }
  return sawMinus && sawPlus && sawHunk;
}

function stripGitPrefix(path: string): string {
  if (path.startsWith("a/") || path.startsWith("b/")) return path.slice(2);
  return path;
}

function nullIfDevNull(path: string): string | null {
  return path === "/dev/null" ? null : path;
}

function parseGitHeader(line: string): { oldPath: string | null; newPath: string | null } {
  const rest = line.slice("diff --git ".length);
  const quoted = /^"((?:\\.|[^"])*)"\s+"((?:\\.|[^"])*)"$/.exec(rest);
  if (quoted) {
    return {
      oldPath: nullIfDevNull(stripGitPrefix(quoted[1].replace(/\\"/g, '"'))),
      newPath: nullIfDevNull(stripGitPrefix(quoted[2].replace(/\\"/g, '"'))),
    };
  }
  if (rest.startsWith("a/")) {
    const splitAt = rest.indexOf(" b/");
    if (splitAt !== -1) {
      return {
        oldPath: nullIfDevNull(stripGitPrefix(rest.slice(0, splitAt))),
        newPath: nullIfDevNull(stripGitPrefix(rest.slice(splitAt + 1))),
      };
    }
  }
  const [left, right] = rest.split(" ");
  return {
    oldPath: left ? nullIfDevNull(stripGitPrefix(left)) : null,
    newPath: right ? nullIfDevNull(stripGitPrefix(right)) : null,
  };
}

export function parseDiff(input: string): DiffFile[] {
  const lines = input.split(/\r?\n/);
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  let binaryPatch = false;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      binaryPatch = false;
      inHunk = false;
      const paths = parseGitHeader(line);
      current = { oldPath: paths.oldPath, newPath: paths.newPath, binary: false, rows: [] };
      files.push(current);
      continue;
    }

    if (!current && (line.startsWith("--- ") || line.startsWith("Binary files ") || line.startsWith("GIT binary patch"))) {
      current = { oldPath: null, newPath: null, binary: false, rows: [] };
      files.push(current);
    }

    if (!current) continue;

    if (line.startsWith("rename from ")) {
      current.oldPath = line.slice("rename from ".length).trim();
      continue;
    }
    if (line.startsWith("rename to ")) {
      current.newPath = line.slice("rename to ".length).trim();
      continue;
    }
    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      current.binary = true;
      current.rows = [];
      binaryPatch = line.startsWith("GIT binary patch");
      inHunk = false;
      continue;
    }
    if (binaryPatch) continue;

    if (line.startsWith("--- ")) {
      const path = line.slice(4).split("\t")[0];
      current.oldPath = nullIfDevNull(path === "/dev/null" ? path : stripGitPrefix(path));
      inHunk = false;
      continue;
    }
    if (line.startsWith("+++ ")) {
      const path = line.slice(4).split("\t")[0];
      current.newPath = nullIfDevNull(path === "/dev/null" ? path : stripGitPrefix(path));
      inHunk = false;
      continue;
    }

    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      inHunk = true;
      continue;
    }
    if (!inHunk || line.startsWith("\\")) continue;

    if (line.startsWith("+")) {
      current.rows.push({ kind: "add", text: line.slice(1), oldLine: null, newLine });
      newLine += 1;
      continue;
    }
    if (line.startsWith("-")) {
      current.rows.push({ kind: "remove", text: line.slice(1), oldLine, newLine: null });
      oldLine += 1;
      continue;
    }
    if (line.startsWith(" ")) {
      current.rows.push({ kind: "context", text: line.slice(1), oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    }
  }

  return files;
}
