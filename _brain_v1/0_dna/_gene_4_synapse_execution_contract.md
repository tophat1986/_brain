# Gene 4: Synapse Execution Contract

Synapses must resolve to deterministic gate decisions. Free-text verbs are not contracts.

## Gate states
- `ALLOW`: proceed.
- `HOLD`: pause and ask one focused question.
- `BLOCK`: stop due to hard constraint/risk.

## Action codes
- `NONE`: no follow-up action.
- `ASK`: request one focused clarification.
- `RECONCILE_MEM`: create/update required memory before re-evaluation.
- `RUN_WBC`: run required WBC protocol(s) before re-evaluation.

## Required synapse shape (order)
1. `Purpose`
2. `Trigger`
3. `Inputs`
4. `Procedure`
5. `Decision`
6. `Output`

## Output line
`GATE=<ALLOW|HOLD|BLOCK> | ACTION=<NONE|ASK|RECONCILE_MEM|RUN_WBC> | REASON=<slug> | TARGET=<path|none>`

## Constraints
- Synapses define behavior only.
- Runtime facts live in `mem_*.md`.
- Missing required memory must resolve to `GATE=HOLD | ACTION=RECONCILE_MEM`.
