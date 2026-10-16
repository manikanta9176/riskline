# Riskline design

Date: 2026-10-16

## Problem

A git diff shows which lines moved. It does not show what can break a running app. On every pull request, a migration, a deleted test, a removed route or GraphQL field, a new required env var, a dependency change, an auth edit, or a pasted secret can sit inside a large diff and get merged.

Riskline reads one diff and returns one card: findings a reviewer should see, each with file and line, plus a pull request description copied from those findings.

## Users and success

The user is a developer opening or reviewing a pull request. Success for v1 is: given a diff, the website and the CLI produce the same findings, the card names the risky lines, and the description can be pasted into the pull request without editing.

## Product

Two surfaces share one rules package.

- Website: a static page. The visitor pastes a unified diff. Analysis runs in the browser. The diff is not uploaded.
- CLI: `riskline` reads a unified diff from stdin, or from `git diff` against a base ref. It prints the same Markdown card.

v1 has no accounts, no saved history, no GitHub Action, and no model-written summary.

## Card

Each finding has:

- `severity`: `break` or `check`
- `rule`: stable id from the table below
- `file`: path from the diff
- `line`: the new-file line number when the line was added or is context; the old-file line number when the line was only removed
- `summary`: one sentence that states what changed. It never includes secret material, tokens, or the raw line.

The card also reports how many files were in the diff, how many `break` findings, and how many `check` findings.

Markdown shape:

```markdown
# Riskline

Files: N · Break: N · Check: N

## Break
- `path` line L — summary

## Check
- `path` line L — summary

## Pull request

<description>
```

Omit a severity section when it has no findings. When both are empty, replace them with: `No break or check findings in this diff.`

The pull request section is always present.

```markdown
## What can break
- summary (`path:line`)

## Confirm before merge
- [ ] summary (`path:line`)
```

`What can break` lists `break` findings. `Confirm before merge` lists `check` findings. When a list is empty, that section says `None.`

## Rules

Rules look at file paths and added or removed lines. They do not execute the project. A finding is emitted once per matching line, except where a rule says once per file.

| Id | Severity | When it fires |
| --- | --- | --- |
| `migration` | break | A file is added, removed, or edited under `migrations/`, `prisma/migrations/`, `drizzle/`, `alembic/versions/`, or `db/migrate/`, or a changed file is named `*.sql` inside one of those directories. One finding per file, on the first changed line. Summary: `Database migration changed.` |
| `deleted-test` | break | A test file is deleted, or a test file loses lines. Test files match `*.test.*`, `*.spec.*`, `*_test.go`, `test_*.py`, or a path containing `__tests__/`. One finding per file. Summary: `Test coverage was removed.` |
| `removed-route` | break | A removed line contains `app.get(`, `app.post(`, `app.put(`, `app.patch(`, `app.delete(`, `router.get(`, `router.post(`, `router.put(`, `router.patch(`, `router.delete(`, `@app.route(`, `@app.get(`, `@app.post(`, `@app.put(`, `@app.patch(`, `@app.delete(`, or `http.Handle(`. The method is the verb in that call. `http.Handle` and `@app.route` have no verb. The path is the first single- or double-quoted string on the line. Summary: `HTTP <method> route removed: <path>.` Omit the method or the path when it is missing. When both are missing: `HTTP route removed.` |
| `removed-graphql-field` | break | In a file ending in `.graphql`, `.gql`, or `.graphqls`, a removed line matches optional whitespace, a name, an optional `(...)` argument list, then `:`. The line must not be a `type`, `input`, `enum`, `interface`, `union`, `scalar`, `schema`, `query`, `mutation`, `subscription`, `fragment`, or `directive` declaration. Summary: `GraphQL field removed: <name>.` |
| `secret` | break | An added line matches a private key header (`BEGIN PRIVATE KEY`, `BEGIN RSA PRIVATE KEY`, `BEGIN OPENSSH PRIVATE KEY`), an AWS access key id (`AKIA` plus 16 alphanumerics), a GitHub token prefix (`ghp_`, `github_pat_`), or `sk-` followed by 20 or more letters, digits, underscores, or hyphens. Summary: `Possible secret added.` The matched text is not copied into the summary. |
| `env-without-example` | check | An added line reads an env var, with `NAME` matching `[A-Z][A-Z0-9_]*`. Accepted forms, single or double quotes: `process.env.NAME`, `process.env["NAME"]`, `os.environ["NAME"]`, `os.environ.get("NAME")`, `os.Getenv("NAME")`, `ENV.fetch("NAME")`, `ENV["NAME"]`. Fire only when that exact name is not present on an added line of a file whose name is `.env.example` or `.env.sample` in the same diff. One finding per name. Summary: `Env var NAME is read and is not added to an example env file.` |
| `dependency` | check | A dependency name is introduced, or its version text changes, in `package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`, or `pyproject.toml`. Lockfiles do not produce findings. One finding per name. Summary: `Dependency <name> was added.` or `Dependency <name> changed version.` See Dependency lines below. |
| `auth-edit` | check | Split the path on `/` and split each segment on any character that is not a letter. A file matches when any token equals `auth`, `session`, `permission`, `permissions`, or `rbac`, case-insensitive. `author` does not match. One finding per file, on the first added or removed line. Summary: `Auth or permission code changed.` |

Rules run independently. If one rule throws, the card still returns the other findings and adds one `check` finding with rule id `rule-failed`, file `(rules)`, line `1`, and summary `Rule <id> failed and was skipped.`

`migration`, `deleted-test`, and `auth-edit` use the first added or removed line in that file. A file with no added or removed lines produces no finding from those rules. `deleted-test` fires when the file is deleted or when any removed line in that test file contains a non-whitespace character.

Findings are ordered by file path, then line, then rule id. That order is the order in the card and in the pull request section.

### Dependency lines

Compare added lines with removed lines. A name only on an added line was added. The same name on both, with different remainder text, changed version.

- `package.json`: a line counts only when the nearest preceding section line in that file's diff is `"dependencies"`, `"devDependencies"`, `"peerDependencies"`, or `"optionalDependencies"`. A package line is `"<name>": "<range>"`.
- `Cargo.toml`: a line counts only under the nearest preceding `[dependencies]`, `[dev-dependencies]`, or `[build-dependencies]` table. A package line is `<name> = ...`.
- `go.mod`: an added or removed line matching `<module-path> v<version>`.
- `requirements.txt`: a non-comment line. The name is the leading token, stopping before `[`, a space, or `==`, `>=`, `<=`, `~=`, `!=`. Lines starting with `-` are ignored. A name with no version still counts.
- `pyproject.toml`: under `[tool.poetry.dependencies]` or `[tool.poetry.group.<group>.dependencies]`, a line `<name> = ...`. Under a `[project]` dependencies array, a quoted string; the name is the text before the first space, `==`, `>=`, `<=`, `~=`, or `!=`.

## Parser

Input must be a unified diff: at least one `diff --git ` header, or a `---` / `+++` pair followed by a `@@` hunk. The parser yields, per file: old path, new path, added lines, removed lines, and whether the file was added or deleted. Binary diffs (`Binary files` or `GIT binary patch`) count as one file and produce no finding. A rename with an empty hunk body counts as one file (the new path) and produces no finding.

Line numbers come from hunk headers. A line only in the old file uses the old line number. The number shown on the card is that line number.

## Surfaces

### Website

One page.

- A textarea labeled `Diff`, empty on load.
- A button labeled `Check diff`.
- The card rendered from the Markdown, plus a `Copy pull request` button. The button copies the description body only, from `## What can break` through the end. It does not copy the `# Riskline` heading or the `## Pull request` heading.

The check runs locally in the page. There is no API.

Empty textarea: show `Paste a unified diff.` Do not show an empty card.

Input that is not a unified diff: show `This is not a unified diff. Use git diff or git diff <base>...HEAD.`

Input larger than 2 MB (2 × 1024 × 1024 bytes): show `This diff is over 2 MB. Run the CLI on the branch.` Do not parse it.

### CLI

Command name: `riskline`.

- `--file <path>` reads that file and ignores stdin and git.
- Otherwise, if stdin is not a terminal, read stdin.
- Otherwise, in a git repository, run `git diff <base>...HEAD`. The base is `--base` when passed. When omitted, use `main` if `git rev-parse --verify --quiet main` succeeds, otherwise `master` if that verify succeeds.
- `--base <ref>` sets the base ref for the git path only.

Stdout is the Markdown card and nothing else. Logs and errors go to stderr. Exit `0` when a card is printed, including a card with zero findings. Exit `1` when there is no diff to read, git fails, the base ref is missing, or the input is not a unified diff. Exit `2` when the input is over 2 MB.

Stderr text:

- No diff: `No diff to read. Pipe a diff, pass --file, or run inside a git repository.`
- Not a diff: `This is not a unified diff. Use git diff or git diff <base>...HEAD.`
- Over 2 MB: `This diff is over 2 MB.`
- Neither `main` nor `master` exists, and `--base` was omitted: `No base ref. Pass --base, or create main.`
- `--file` path cannot be read: `Cannot read <path>.` and git's own stderr is not used in that case.

## Errors

| Case | Website | CLI |
| --- | --- | --- |
| Empty input | Inline message, no card | Exit 1, stderr message |
| Not a unified diff | Inline message, no card | Exit 1, stderr message |
| Over 2 MB | Inline message, no card | Exit 2, stderr message |
| One rule throws | Card plus `rule-failed` | Same card, exit 0 |
| `git diff` fails | Not used | Exit 1, git's stderr |
| Base ref missing | Not used | Exit 1, `No base ref. Pass --base, or create main.` |
| `--file` unreadable | Not used | Exit 1, `Cannot read <path>.` |

## Testing

Unit tests live next to the rules package. Each rule has one fixture diff that must produce its finding, and the clean fixture must produce no findings. Additional fixtures:

- secret line must not appear in the Markdown
- env var added in both code and `.env.example` produces no `env-without-example` finding
- lockfile-only change produces no `dependency` finding
- binary file produces no finding
- a thrown rule produces `rule-failed` and still returns the other rule's finding
- website and CLI tests call the same `analyze` function and compare findings

The website behavior for empty, invalid, and oversized input is covered by tests of the function the page calls before `analyze`. The CLI exit codes are covered by tests that invoke the CLI with fixtures.

## Out of scope

- GitHub App, Action, or pull request comments
- Accounts, storage, or sharing links
- Semantic GraphQL schema comparison beyond removed field lines
- Suggesting a fix or editing the repo
- Publishing the CLI to a registry (the CLI ships in this repo and runs via the repo's package runner)

## Repository layout

```text
packages/rules/     parser, rules, card, Markdown
apps/web/           static page
apps/cli/           riskline command
```

The website and the CLI depend on `packages/rules`. They do not reimplement a rule.
