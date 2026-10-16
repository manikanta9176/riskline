import type { DiffFile } from "./parse.js";

export type Severity = "break" | "check";

export type Finding = {
  severity: Severity;
  rule: string;
  file: string;
  line: number;
  summary: string;
};

export type Rule = {
  id: string;
  run: (files: DiffFile[]) => Finding[];
};

export type Card = {
  files: number;
  breakCount: number;
  checkCount: number;
  findings: Finding[];
  markdown: string;
  pullRequest: string;
};
