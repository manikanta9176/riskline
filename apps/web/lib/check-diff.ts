import { analyze, screenDiff, type Card } from "@riskline/rules";

export type CheckResult = { kind: "message"; message: string } | { kind: "card"; card: Card };

export function checkDiff(input: string): CheckResult {
  const screened = screenDiff(input);
  if (!screened.ok) return { kind: "message", message: screened.message };
  return { kind: "card", card: analyze(screened.diff) };
}
