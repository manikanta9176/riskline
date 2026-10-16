import { renderCard } from "./card";
import { parseDiff } from "./parse";
import { authEdit } from "./rules/auth-edit";
import { deletedTest } from "./rules/deleted-test";
import { dependency } from "./rules/dependency";
import { envWithoutExample } from "./rules/env-without-example";
import { migration } from "./rules/migration";
import { removedGraphqlField } from "./rules/removed-graphql-field";
import { removedRoute } from "./rules/removed-route";
import { runRules } from "./rules/run";
import { secret } from "./rules/secret";
import type { Card } from "./types";

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
