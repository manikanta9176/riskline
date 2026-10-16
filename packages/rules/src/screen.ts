import { isUnifiedDiff } from "./parse.js";

export const MAX_DIFF_BYTES = 2 * 1024 * 1024;

export type ScreenFailure = "empty" | "not-diff" | "too-large";

export type ScreenResult =
  | { ok: true; diff: string }
  | { ok: false; error: ScreenFailure; message: string };

const messages: Record<ScreenFailure, string> = {
  empty: "Paste a unified diff.",
  "not-diff": "This is not a unified diff. Use git diff or git diff <base>...HEAD.",
  "too-large": "This diff is over 2 MB. Run the CLI on the branch.",
};

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function screenDiff(input: string): ScreenResult {
  if (byteLength(input) > MAX_DIFF_BYTES) {
    return { ok: false, error: "too-large", message: messages["too-large"] };
  }
  if (input.trim() === "") {
    return { ok: false, error: "empty", message: messages.empty };
  }
  if (!isUnifiedDiff(input)) {
    return { ok: false, error: "not-diff", message: messages["not-diff"] };
  }
  return { ok: true, diff: input };
}
