# Gene 4: Tech Stack Map (Declared)

This file is the canonical declaration of the host project's approved stack. It is a DNA fact map, not a memory log.

## Required shape

Keep entries short and explicit under these headings:

- `runtime`
- `frontend`
- `backend`
- `data`
- `testing`
- `tooling`
- `deployment`
- `disallowed_new_dependencies`

Use `"unknown"` for a slot that has not been confirmed yet.

## Drift protocol contract

- If implementation introduces a dependency not declared here, trigger the drift gate and halt expansion work.
- Reconcile by either:
  - declaring the dependency here with user approval, or
  - removing the undeclared dependency from code.

## Mutation rule

- Update this map only when evidence exists in the host repo manifests and/or explicit user confirmation is given.
- Do not store historical timeline notes here; history belongs in runtime `mem_*.md` files.
