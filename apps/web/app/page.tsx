"use client";

import { useState } from "react";
import { checkDiff, type CheckResult } from "../lib/check-diff";
import type { Finding } from "@riskline/rules";

export default function Page() {
  const [diff, setDiff] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [copied, setCopied] = useState(false);

  const card = result?.kind === "card" ? result.card : null;

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <p className="kicker">Before you merge</p>
          <h1>Riskline</h1>
        </div>
        <p className="lede">Paste a unified diff. The check runs in this browser.</p>
      </header>

      <div className="workspace">
        <section className="panel composer">
          <label htmlFor="diff">Diff</label>
          <textarea
            id="diff"
            value={diff}
            spellCheck={false}
            placeholder={"diff --git a/app.ts b/app.ts\n--- a/app.ts\n+++ b/app.ts"}
            onChange={(event) => setDiff(event.target.value)}
          />
          <div className="actions">
            <button
              className="primary"
              type="button"
              onClick={() => {
                setCopied(false);
                setResult(checkDiff(diff));
              }}
            >
              Check diff
            </button>
            {card ? (
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(card.pullRequest)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                Copy pull request
              </button>
            ) : null}
            {copied ? <p className="copied">Copied.</p> : null}
          </div>
        </section>

        <aside className="panel verdict" aria-live="polite">
          {result === null ? (
            <p className="quiet">Breaks and checks show up here, with file and line.</p>
          ) : null}
          {result?.kind === "message" ? <p role="alert" className="alert">{result.message}</p> : null}
          {card ? <CardView card={card} /> : null}
        </aside>
      </div>
    </main>
  );
}

function CardView({ card }: { card: Extract<CheckResult, { kind: "card" }>["card"] }) {
  const breaks = card.findings.filter((finding) => finding.severity === "break");
  const checks = card.findings.filter((finding) => finding.severity === "check");

  return (
    <>
      <div className="stats">
        <p className="stat">
          <span>Files</span>
          <strong>{card.files}</strong>
        </p>
        <p className="stat break">
          <span>Break</span>
          <strong>{card.breakCount}</strong>
        </p>
        <p className="stat check">
          <span>Check</span>
          <strong>{card.checkCount}</strong>
        </p>
      </div>
      {breaks.length > 0 ? <FindingGroup title="Break" severity="break" findings={breaks} /> : null}
      {checks.length > 0 ? <FindingGroup title="Check" severity="check" findings={checks} /> : null}
      {breaks.length === 0 && checks.length === 0 ? (
        <div className="clear">
          <strong>No break or check findings in this diff.</strong>
          <p className="quiet">Nothing in the rules needs a second look.</p>
        </div>
      ) : null}
    </>
  );
}

function FindingGroup({
  title,
  severity,
  findings,
}: {
  title: string;
  severity: Finding["severity"];
  findings: Finding[];
}) {
  return (
    <section className={`group ${severity}`}>
      <h2>{title}</h2>
      <ul className="findings">
        {findings.map((finding, index) => (
          <li className={`finding ${severity}`} key={`${finding.rule}-${finding.file}-${finding.line}-${index}`}>
            <small>
              {finding.file}:{finding.line}
            </small>
            <p>{finding.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
