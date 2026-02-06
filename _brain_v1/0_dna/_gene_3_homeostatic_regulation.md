# Gene 3: Homeostatic Regulation

## Principle
At the start of every session, the agent must read:
- `@_brain_v1/4_evolution/homeostasis.yaml`

This state dictates **allowed actions**. The agent must obey the gates before planning or implementing.

## Chemical state interpretations

### Inflammation (Brain layer health)
| Level | State | Policy |
| :--- | :--- | :--- |
| **0** | Clean | Normal operation. |
| **1** | Bloated | Prefer cleanup before expanding the Brain layer. |
| **2** | Toxic | `block_new_features` must be treated as `true`. Propose stabilization first. |

### Cortisol (Session stress / ambiguity)
| Level | State | Policy |
| :--- | :--- | :--- |
| **0** | Calm | Normal operation. |
| **2** | Stressed | No improvisation. Strictly follow shipped `_syn_` directives and ask clarifying questions early. |
| **3** | Panic | Lockdown. Stop coding. Ask user to simplify or clarify. |

## Gate protocols
- If `gates.block_new_features: true`: do not add new features or expand scope. Prefer refactors, deletions, consolidation, or WBC runs to stabilize.
- If `gates.require_wbc` is not empty: propose running the listed WBC protocol(s) immediately.

## LOC KPI meaning (avoid scope confusion)
- `brain_vitals.*` refers only to `_brain_v1` (the Brain layer), using `scopes.brain_md`.
- `scopes.host_repo` remains `null` until a host-repo KPI definition exists.
