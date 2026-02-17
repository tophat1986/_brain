# Tech Stack Memory Drift Gate

## Purpose
Prevent implementation drift from canonical tech-stack decisions.

## Trigger
- Any task that introduces or depends on stack-level choices (dependencies, styling approach, test/tooling, data/state layer).

## Inputs
- `@_brain_v1/4_evolution/mem_1_tech_stack.md`
- Minimal task-relevant evidence only (`package.json`, lockfile, relevant config).

## Procedure
1. If `mem_1_tech_stack.md` is missing, bootstrap it with:
   - `# Tech Stack Memory`
   - `## Canonical Choices`
   - `## Guardrails`
   - `## Allowed Exceptions`
   - `## Sources Checked`
   - `## Last Updated`
2. Compare requested change against `Canonical Choices` and `Guardrails`.
3. If conflict/unknown impacts requested change, stop implementation and reconcile memory first.
4. If aligned, proceed.
5. After reconciliation, append concise update note and timestamp.

## Decision

- Missing memory: `GATE=HOLD | ACTION=RECONCILE_MEM | REASON=missing_tech_stack_memory | TARGET=@_brain_v1/4_evolution/mem_1_tech_stack.md`
- Conflict/unknown that impacts requested change: `GATE=BLOCK | ACTION=ASK | REASON=tech_stack_drift | TARGET=@_brain_v1/4_evolution/mem_1_tech_stack.md`
- Aligned with memory: `GATE=ALLOW | ACTION=NONE | REASON=tech_stack_aligned | TARGET=none`

## Output
Emit exactly one line:
`GATE=<ALLOW|HOLD|BLOCK> | ACTION=<NONE|ASK|RECONCILE_MEM|RUN_WBC> | REASON=<slug> | TARGET=<path|none>`
