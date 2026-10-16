import { readFileSync } from "node:fs";
import { run } from "./run.js";

const result = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  isTTY: process.stdin.isTTY === true,
  readStdin: () => readFileSync(0, "utf8"),
  readFile: (file) => readFileSync(file, "utf8"),
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.code);
