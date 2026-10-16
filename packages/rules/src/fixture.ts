type Mark = " " | "+" | "-";

export function diffFixture(file: {
  path: string;
  lines: Array<{ kind: Mark; text: string }>;
  oldStart?: number;
  newStart?: number;
  deleted?: boolean;
  created?: boolean;
}): string {
  const oldCount = file.lines.filter((line) => line.kind !== "+").length;
  const newCount = file.lines.filter((line) => line.kind !== "-").length;
  const oldStart = file.oldStart ?? 1;
  const newStart = file.newStart ?? 1;
  const oldHeader = file.created ? "/dev/null" : `a/${file.path}`;
  const newHeader = file.deleted ? "/dev/null" : `b/${file.path}`;
  const body = file.lines.map((line) => `${line.kind}${line.text}`).join("\n");
  return [
    `diff --git a/${file.path} b/${file.path}`,
    `--- ${oldHeader}`,
    `+++ ${newHeader}`,
    `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
    body,
    "",
  ].join("\n");
}

export function diffs(...parts: string[]): string {
  return parts.join("");
}
