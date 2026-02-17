# Spinal Cord Runtime Pulse Contract

This card defines what the hook layer must surface so the user and agent can verify the Brain is active without heavy token usage.

## Required pulse fields

- mindset: `mode`, `caution`, `focus`
- reflex summary: counts for `sensory`, `motor`, `inhibition`
- vitals summary: `generated_at`, `inflammation`, `cortisol`, `mode`
- gate summary: `block_new_features`, `require_wbc` count
- bootstrap status: missing required core files count

## Emission policy

- Always emit one compact pulse at `sessionStart`.
- Emit attention notices only when risk/gates are active, and only once per session per unique alert set.
- Keep pulse deterministic and concise; avoid full file dumps.

## Attention triggers

- missing homeostasis/vitals/core directives
- stale vitals age beyond threshold
- `block_new_features: true`
- non-empty `require_wbc`
- elevated chemical state (`inflammation >= 1` or `cortisol >= 2`)
