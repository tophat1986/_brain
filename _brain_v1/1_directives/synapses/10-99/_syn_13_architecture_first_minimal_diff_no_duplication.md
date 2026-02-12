# Architecture-First Minimal Diff (No Duplication)

- Assume the host codebase is established; align to existing patterns and ownership.
- Before coding, locate where data/state/contracts already live and reuse them first.
- Do not add local fetching/caching/state orchestration if a shared layer already owns it.
- Prevent avoidable API waterfalls, duplicate transforms, and parallel contracts.
- Keep diffs tight: only code required for requested behavior; prefer subtraction over defensive additions.
- Use existing canonical enums/types/helpers; do not recreate local mappings.
- If context is missing, ask one focused question rather than guessing.

## Final Gate (must pass)

- No duplicate data ownership introduced.
- No extra request path without explicit reason.
- No needless reactive/state complexity.
- Lowest-LOC clear solution consistent with existing architecture.
