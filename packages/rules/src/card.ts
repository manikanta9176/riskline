import type { DiffFile } from "./parse";
import type { Card, Finding } from "./types";

function findingLine(finding: Finding): string {
  return `- \`${finding.file}\` line ${finding.line} — ${finding.summary}`;
}

export function pullRequestBody(findings: Finding[]): string {
  const breaks = findings.filter((finding) => finding.severity === "break");
  const checks = findings.filter((finding) => finding.severity === "check");
  const breakBlock = breaks.length
    ? breaks.map((finding) => `- ${finding.summary} (\`${finding.file}:${finding.line}\`)`).join("\n")
    : "None.";
  const checkBlock = checks.length
    ? checks.map((finding) => `- [ ] ${finding.summary} (\`${finding.file}:${finding.line}\`)`).join("\n")
    : "None.";
  return `## What can break\n${breakBlock}\n\n## Confirm before merge\n${checkBlock}\n`;
}

export function renderCard(files: DiffFile[], findings: Finding[]): Card {
  const breaks = findings.filter((finding) => finding.severity === "break");
  const checks = findings.filter((finding) => finding.severity === "check");
  const pullRequest = pullRequestBody(findings);
  const lines = [
    "# Riskline",
    "",
    `Files: ${files.length} · Break: ${breaks.length} · Check: ${checks.length}`,
    "",
  ];
  if (breaks.length === 0 && checks.length === 0) {
    lines.push("No break or check findings in this diff.", "");
  } else {
    if (breaks.length > 0) lines.push("## Break", ...breaks.map(findingLine), "");
    if (checks.length > 0) lines.push("## Check", ...checks.map(findingLine), "");
  }
  lines.push("## Pull request", "", pullRequest.trimEnd(), "");
  return {
    files: files.length,
    breakCount: breaks.length,
    checkCount: checks.length,
    findings,
    markdown: lines.join("\n"),
    pullRequest,
  };
}
