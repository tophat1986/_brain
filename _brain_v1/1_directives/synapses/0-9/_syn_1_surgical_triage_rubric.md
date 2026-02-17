# Surgical Triage Rubric

Use this before implementation to classify blast radius and phase-lock behavior.

## Grades

1. **Grade C (Surface)**
   - Presentation-only change.
   - Typical scope: copy, docs, comments, style-only UI tweaks.
2. **Grade B (Muscle)**
   - Business logic change inside existing architecture.
   - Typical scope: functions, conditional behavior, bug fixes with local impact.
3. **Grade A (Skeletal)**
   - Architecture/infrastructure/contracts change.
   - Typical scope: dependency changes, schema/migration, build/deploy config, cross-cutting structure.

## Decision Rules

- If any Grade A signal appears, classify as **Grade A**.
- Else if only Surface signals appear, classify as **Grade C**.
- Else default to **Grade B**.

## Phase Lock

- Grade C/B: implementation may proceed.
- Grade A: **PHASE: ARCHITECT** (discussion + plan only) until explicit user confirmation.

## Output Contract

Emit a one-line decision signal:

`TRIAGE: grade=<A|B|C> | reason=<signal/default> | phase=<ARCHITECT_LOCK|SURGEON_ELIGIBLE>`
