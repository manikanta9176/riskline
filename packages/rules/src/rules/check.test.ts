import { describe, expect, it } from "vitest";
import { diffs, diffFixture } from "../fixture";
import { parseDiff } from "../parse";
import { authEdit } from "./auth-edit";
import { dependency } from "./dependency";
import { envWithoutExample } from "./env-without-example";

function run(rule: { run: (files: ReturnType<typeof parseDiff>) => unknown[] }, diff: string) {
  return rule.run(parseDiff(diff));
}

describe("check rules", () => {
  it("flags an env var that is not added to an example file", () => {
    const diff = diffFixture({
      path: "app.ts",
      created: true,
      oldStart: 0,
      lines: [{ kind: "+", text: "const url = process.env.DATABASE_URL;" }],
    });
    expect(run(envWithoutExample, diff)).toEqual([
      {
        severity: "check",
        rule: "env-without-example",
        file: "app.ts",
        line: 1,
        summary: "Env var DATABASE_URL is read and is not added to an example env file.",
      },
    ]);
  });

  it("does not flag an env var added to .env.example", () => {
    const diff = diffs(
      diffFixture({
        path: "app.ts",
        created: true,
        oldStart: 0,
        lines: [{ kind: "+", text: 'const url = process.env["DATABASE_URL"];' }],
      }),
      diffFixture({
        path: ".env.example",
        created: true,
        oldStart: 0,
        lines: [{ kind: "+", text: "DATABASE_URL=" }],
      }),
    );
    expect(run(envWithoutExample, diff)).toEqual([]);
  });

  it("does not treat a shorter env name as a match", () => {
    const diff = diffs(
      diffFixture({
        path: "app.ts",
        created: true,
        oldStart: 0,
        lines: [{ kind: "+", text: "const url = process.env.DATABASE_URL;" }],
      }),
      diffFixture({
        path: ".env.example",
        created: true,
        oldStart: 0,
        lines: [{ kind: "+", text: "DATABASE=" }],
      }),
    );
    expect(run(envWithoutExample, diff)).toHaveLength(1);
  });

  it("flags an added dependency and a version change, and ignores lockfiles", () => {
    const diff = diffFixture({
      path: "package.json",
      lines: [
        { kind: " ", text: '  "dependencies": {' },
        { kind: "-", text: '    "zod": "1.0.0",' },
        { kind: "+", text: '    "zod": "2.0.0",' },
        { kind: "+", text: '    "hono": "4.0.0"' },
      ],
    });
    expect(run(dependency, diff)).toEqual([
      {
        severity: "check",
        rule: "dependency",
        file: "package.json",
        line: 2,
        summary: "Dependency zod changed version.",
      },
      {
        severity: "check",
        rule: "dependency",
        file: "package.json",
        line: 3,
        summary: "Dependency hono was added.",
      },
    ]);

    const lock = diffFixture({
      path: "package-lock.json",
      lines: [
        { kind: " ", text: '  "dependencies": {' },
        { kind: "+", text: '    "left-pad": "1.0.0"' },
      ],
    });
    expect(run(dependency, lock)).toEqual([]);
  });

  it("ignores package.json fields outside dependency sections", () => {
    const diff = diffFixture({
      path: "package.json",
      lines: [
        { kind: " ", text: '  "dependencies": {' },
        { kind: " ", text: '    "zod": "1.0.0"' },
        { kind: " ", text: "  }," },
        { kind: "+", text: '  "name": "riskline"' },
      ],
    });
    expect(run(dependency, diff)).toEqual([]);
  });

  it("flags requirements, go.mod, Cargo.toml, and pyproject.toml", () => {
    const requirements = diffFixture({
      path: "requirements.txt",
      created: true,
      oldStart: 0,
      lines: [{ kind: "+", text: "flask" }],
    });
    expect(run(dependency, requirements)[0]).toMatchObject({ summary: "Dependency flask was added." });

    const gomod = diffFixture({
      path: "go.mod",
      lines: [
        { kind: "-", text: "\tgithub.com/foo/bar v1.0.0" },
        { kind: "+", text: "\tgithub.com/foo/bar v1.2.0" },
      ],
    });
    expect(run(dependency, gomod)[0]).toMatchObject({ summary: "Dependency github.com/foo/bar changed version." });

    const cargo = diffFixture({
      path: "Cargo.toml",
      lines: [
        { kind: " ", text: "[dependencies]" },
        { kind: "+", text: 'serde = "1"' },
      ],
    });
    expect(run(dependency, cargo)[0]).toMatchObject({ summary: "Dependency serde was added." });

    const poetry = diffFixture({
      path: "pyproject.toml",
      lines: [
        { kind: " ", text: "[tool.poetry.dependencies]" },
        { kind: "+", text: 'httpx = "^0.27"' },
      ],
    });
    expect(run(dependency, poetry)[0]).toMatchObject({ summary: "Dependency httpx was added." });
  });

  it("flags go.mod require lines", () => {
    const diff = diffFixture({
      path: "go.mod",
      created: true,
      oldStart: 0,
      lines: [{ kind: "+", text: "require github.com/acme/widget v0.4.0" }],
    });
    expect(run(dependency, diff)[0]).toMatchObject({
      summary: "Dependency github.com/acme/widget was added.",
    });
  });

  it("flags requirements.txt with comparison operators", () => {
    const diff = diffFixture({
      path: "requirements.txt",
      created: true,
      oldStart: 0,
      lines: [{ kind: "+", text: "flask<3" }],
    });
    expect(run(dependency, diff)[0]).toMatchObject({ summary: "Dependency flask was added." });
  });

  it("flags auth paths by token and ignores author.ts", () => {
    const diff = diffFixture({
      path: "src/auth/session.ts",
      lines: [{ kind: "+", text: "export const ttl = 10;" }],
    });
    expect(run(authEdit, diff)).toEqual([
      {
        severity: "check",
        rule: "auth-edit",
        file: "src/auth/session.ts",
        line: 1,
        summary: "Auth or permission code changed.",
      },
    ]);
    const author = diffFixture({
      path: "src/author.ts",
      lines: [{ kind: "+", text: 'export const name = "ada";' }],
    });
    expect(run(authEdit, author)).toEqual([]);
  });
});
