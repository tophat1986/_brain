# Subagent Delegation Protocol

Subagents are **opt-in**. Default: the main agent does the work.

## Delegation rules

- Delegate only if the subtask is one sentence and the expected output is max **10 bullets** that are directly reusable.
- Max **2** subagents per request. Use **3** only for distinct audits (security, performance, edge cases).
- When delegating, pass: **goal** + **key constraints** + an **anchor** (file path or symbol).
  - If no anchor exists, allow **one discovery subagent** to find anchors, then proceed.
- Do not delegate for:
  - live debugging
  - flaky tests
  - broad refactors

## Required subagent output format

Subagent output must be bullets under these headings (exact):

- Findings (include exact file paths, or explicitly say “none”)
- Not checked
- Next action
