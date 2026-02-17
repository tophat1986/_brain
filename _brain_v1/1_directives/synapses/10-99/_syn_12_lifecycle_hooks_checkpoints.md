# Lifecycle Hooks Checkpoints

This card defines the expected behavior of the Cursor hook lifecycle so runtime matches the Brain blueprint.

## Hook -> checkpoint map

- `sessionStart`
  - Digest `@_brain_v1/homeostasis.yaml` and `@_brain_v1/4_evolution/vitals.yaml`.
  - Regenerate `.cursor/cortex.yaml` when session or digest hash changed.
  - Emit a compact brain pulse (mode, gates, reflex counts, freshness).
- `beforeSubmitPrompt`
  - Recheck digest and refresh context only when state changed.
  - Emit one-line triage decision using `_syn_1_surgical_triage_rubric.md`.
  - Surface attention only when a gate/risk is active (avoid noise).
- `beforeReadFile` / `beforeTabFileRead`
  - Enforce sensory reflex denies from `REFLEXES.sensory` patterns.
- `preToolUse` (`Write`) + `afterFileEdit`
  - Enforce motor reflex denies for protected files.
  - Keep rollback best-effort and deterministic.
- `beforeShellExecution` / `beforeMCPExecution`
  - Enforce inhibition reflex patterns from `REFLEXES.inhibition`.
- `preCompact`
  - Remind that changing homeostasis/vitals requires fresh session re-injection.

## Safety policy

- Hooks must be deterministic, fast, and dependency-free.
- Default to fail-open on parser/runtime faults to prevent lockout.
