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
