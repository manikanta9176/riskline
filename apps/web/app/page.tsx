"use client";

import { useState } from "react";
import { checkDiff, type CheckResult } from "../lib/check-diff";

export default function Page() {
  const [diff, setDiff] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <main>
      <h1>Riskline</h1>
      <p>Paste a unified diff. The check runs in this browser.</p>
      <label htmlFor="diff">Diff</label>
      <textarea
        id="diff"
        value={diff}
        onChange={(event) => setDiff(event.target.value)}
      />
      <div>
        <button
          type="button"
          onClick={() => {
            setCopied(false);
            setResult(checkDiff(diff));
          }}
        >
          Check diff
        </button>
        {result?.kind === "card" ? (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(result.card.pullRequest)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            Copy pull request
          </button>
        ) : null}
      </div>
      {copied ? <p>Copied.</p> : null}
      {result?.kind === "message" ? <p role="alert">{result.message}</p> : null}
      {result?.kind === "card" ? <pre>{result.card.markdown}</pre> : null}
    </main>
  );
}
