# AGENTS.md

- This repo is SOURCE mode (`_brain` template authoring), not host-project RUNTIME mode.
- Before any `_brain_v1` change: confirm SOURCE mode; if ambiguous, ask `SOURCE or RUNTIME?`
- For SOURCE work, read and obey all DNA in `@_brain_v1/0_dna/` (`_gene_*.md` and `gene_*.md`) as the single source of truth.
- Keep this file as signposting only; do not duplicate taxonomy/rules already defined in `README.md` and DNA files.
- Keep changes minimal/consolidated and never ship runtime artifacts (`mem_*.md`, `inf_*.md`, `.cursor/cortex.yaml`, `.cursor/synaptic_state.json`, `.cursor/hooks.json`).
- `.cursor/rules/_brain_on.mdc` is runtime-use behavior, not source-development governance.
