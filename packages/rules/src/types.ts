export type Severity = "break" | "check";

export type Finding = {
  severity: Severity;
  rule: string;
  file: string;
  line: number;
  summary: string;
};

export type Card = {
  files: number;
  breakCount: number;
  checkCount: number;
  findings: Finding[];
  markdown: string;
  pullRequest: string;
};
