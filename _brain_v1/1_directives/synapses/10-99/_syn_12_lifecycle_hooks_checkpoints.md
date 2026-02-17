# Lifecycle Hooks Checkpoints

This card defines the expected behavior of the Cursor hook lifecycle so runtime matches the Brain blueprint.

## Hook -> checkpoint map

- `sessionStart`
  - Digest `@_brain_v1/homeostasis.yaml` and `@_brain_v1/4_evolution/vitals.yaml`.
  - Regenerate `.cursor/cortex.yaml` when session or digest hash changed.
  - Emit a compact brain pulse (mode, gates, reflex counts, freshness).
- `beforeSubmitPrompt`
  - Recheck digest and refresh context only when state changed.
  - Do not perform semantic triage in hooks; triage is Director/AI behavior via synapses.
  - Surface attention only when a gate/risk is active (avoid noise).
- `beforeReadFile` / `beforeTabFileRead`
  - Enforce sensory reflex denies from `REFLEXES.sensory` patterns.
- `preToolUse` (`Write`)
  - Enforce motor reflex denies for protected files before mutation.
- `beforeShellExecution` / `beforeMCPExecution`
  - Enforce inhibition reflex patterns from `REFLEXES.inhibition`.
- `preCompact`
  - Remind that changing homeostasis/vitals requires fresh session re-injection.

## Runtime pulse contract

Required pulse fields:

- mindset: `mode`, `caution`, `focus`
- reflex summary: counts for `sensory`, `motor`, `inhibition`
- vitals summary: `generated_at`, `inflammation`, `cortisol`, `mode`
- gate summary: `block_new_features`, `require_wbc` count
- bootstrap status: missing required core files count

Emission policy:

- Always emit one compact pulse at `sessionStart`.
- Emit attention notices only when risk/gates are active, and only once per session per unique alert set.
- Keep pulse deterministic and concise; avoid full file dumps.

Attention triggers:

- missing homeostasis/vitals/core directives
- stale vitals age beyond threshold
- `block_new_features: true`
- non-empty `require_wbc`
- elevated chemical state (`inflammation >= 1` or `cortisol >= 2`)

## Safety policy

- Hooks must be deterministic, fast, and dependency-free.
- Default to fail-open on parser/runtime faults to prevent lockout.
