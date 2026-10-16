import { renderCard } from "./card.js";
import { parseDiff } from "./parse.js";
import { authEdit } from "./rules/auth-edit.js";
import { deletedTest } from "./rules/deleted-test.js";
import { dependency } from "./rules/dependency.js";
import { envWithoutExample } from "./rules/env-without-example.js";
import { migration } from "./rules/migration.js";
import { removedGraphqlField } from "./rules/removed-graphql-field.js";
import { removedRoute } from "./rules/removed-route.js";
import { runRules } from "./rules/run.js";
import { secret } from "./rules/secret.js";
import type { Card } from "./types.js";

export const rules = [
  migration,
  deletedTest,
  removedRoute,
  removedGraphqlField,
  secret,
  envWithoutExample,
  dependency,
  authEdit,
];

export function analyze(diff: string): Card {
  const files = parseDiff(diff);
  return renderCard(files, runRules(files, rules));
}
