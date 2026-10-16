import { describe, expect, it } from "vitest";
import { renderCard } from "../card";
import { diffFixture } from "../fixture";
import { parseDiff } from "../parse";
import { deletedTest } from "./deleted-test";
import { migration } from "./migration";
import { removedGraphqlField } from "./removed-graphql-field";
import { removedRoute } from "./removed-route";
import { secret } from "./secret";

function run(rule: { run: (files: ReturnType<typeof parseDiff>) => unknown[] }, diff: string) {
  return rule.run(parseDiff(diff));
}

describe("break rules", () => {
  it("flags a migration once on the first changed line", () => {
    const diff = diffFixture({
      path: "prisma/migrations/001.sql",
      created: true,
      oldStart: 0,
      lines: [{ kind: "+", text: "create table users ();" }],
    });
    expect(run(migration, diff)).toEqual([
      {
        severity: "break",
        rule: "migration",
        file: "prisma/migrations/001.sql",
        line: 1,
        summary: "Database migration changed.",
      },
    ]);
  });

  it("does not flag a sql file outside a migration directory", () => {
    const diff = diffFixture({
      path: "notes.sql",
      created: true,
      oldStart: 0,
      lines: [{ kind: "+", text: "select 1;" }],
    });
    expect(run(migration, diff)).toEqual([]);
  });

  it("flags a deleted test and ignores a test that only adds lines", () => {
    const removed = diffFixture({
      path: "src/a.test.ts",
      deleted: true,
      oldStart: 1,
      newStart: 0,
      lines: [{ kind: "-", text: "expect(true)" }],
    });
    const added = diffFixture({
      path: "src/b.test.ts",
      created: true,
      oldStart: 0,
      lines: [{ kind: "+", text: "expect(true)" }],
    });
    expect(run(deletedTest, removed)).toEqual([
      {
        severity: "break",
        rule: "deleted-test",
        file: "src/a.test.ts",
        line: 1,
        summary: "Test coverage was removed.",
      },
    ]);
    expect(run(deletedTest, added)).toEqual([]);
  });

  it("flags a removed HTTP route with the verb and path", () => {
    const diff = diffFixture({
      path: "src/server.ts",
      lines: [{ kind: "-", text: 'app.get("/orders", handler)' }],
    });
    expect(run(removedRoute, diff)).toEqual([
      {
        severity: "break",
        rule: "removed-route",
        file: "src/server.ts",
        line: 1,
        summary: "HTTP get route removed: /orders.",
      },
    ]);
  });

  it("flags a removed GraphQL field and ignores a type declaration", () => {
    const diff = diffFixture({
      path: "schema.graphql",
      lines: [
        { kind: " ", text: "type Query {" },
        { kind: "-", text: "  user(id: ID): User" },
        { kind: " ", text: "}" },
      ],
    });
    expect(run(removedGraphqlField, diff)).toEqual([
      {
        severity: "break",
        rule: "removed-graphql-field",
        file: "schema.graphql",
        line: 2,
        summary: "GraphQL field removed: user.",
      },
    ]);
  });

  it("flags a removed GraphQL field whose name matches a declaration keyword", () => {
    const diff = diffFixture({
      path: "schema.graphql",
      lines: [
        { kind: " ", text: "type Query {" },
        { kind: "-", text: "  mutation: Boolean" },
        { kind: " ", text: "}" },
      ],
    });
    expect(run(removedGraphqlField, diff)).toEqual([
      {
        severity: "break",
        rule: "removed-graphql-field",
        file: "schema.graphql",
        line: 2,
        summary: "GraphQL field removed: mutation.",
      },
    ]);
  });

  it("flags a secret without copying it into the card", () => {
    const secretText = "sk-THISISASECRETVALUE1234567890";
    const diff = diffFixture({
      path: "config.ts",
      created: true,
      oldStart: 0,
      lines: [{ kind: "+", text: `const key = "${secretText}"` }],
    });
    const files = parseDiff(diff);
    const findings = secret.run(files);
    expect(findings).toEqual([
      {
        severity: "break",
        rule: "secret",
        file: "config.ts",
        line: 1,
        summary: "Possible secret added.",
      },
    ]);
    expect(renderCard(files, findings).markdown).not.toContain(secretText);
  });

  it("covers the other route, test, and secret shapes", () => {
    const route = diffFixture({
      path: "main.go",
      lines: [{ kind: "-", text: 'http.Handle("/health", nil)' }],
    });
    expect(run(removedRoute, route)[0]).toMatchObject({ summary: "HTTP route removed: /health." });

    const goTest = diffFixture({
      path: "pkg/app_test.go",
      lines: [{ kind: "-", text: "func TestApp() {}" }],
    });
    expect(run(deletedTest, goTest)).toHaveLength(1);

    const key = diffFixture({
      path: "key.pem",
      created: true,
      oldStart: 0,
      lines: [{ kind: "+", text: "-----BEGIN OPENSSH PRIVATE KEY-----" }],
    });
    expect(run(secret, key)).toHaveLength(1);
  });
});
