# Gene 1: Naming & File Creation

The file tree **is** the index. If a filename doesn’t carry enough signal to justify opening it, the file is named incorrectly.

## Naming protocol
- **Format**: `{prefix}{id}_{slug}.md`
- **Prefixes**:
  - `_gene_` (DNA / shipped laws)
  - `gene_` (DNA / user laws)
  - `_syn_` (System / shipped synapses)
  - `syn_` (User / project synapses)
  - `_wbc_` (Immune protocol / shipped)
  - `wbc_` (Immune protocol / user)
  - `inf_` (Immune report / symptom)
  - `mem_` (Evolution / learned memory)
- **ID**: integer, no leading zeros (e.g. `1`, `12`, `105`)
- **Slug**: `snake_case` semantic keywords
  - Use **high-signal** intent so an agent can select files without opening them (token efficiency). Example: `_syn_12_dependency_drift_gate.md`


## Placement protocol
- **DNA (Genes)**: `_brain_v1/0_dna/_gene_*.md` (shipped) and `_brain_v1/0_dna/gene_*.md` (user)
- **System Synapses (shipped)**: `_brain_v1/**/synapses/**/_syn_*.md`
- **User Synapses (project)**: `_brain_v1/**/synapses/**/syn_*.md`
- **Magnitude sharding**: store synapses in numeric range buckets under `synapses/` (e.g. `0-9`, `10-99`, `100-999`) to avoid directory bloat.

## Content placement (anti-drift)
- **Synapses (`*_syn_*.md`, `syn_*.md`)**: protocol cards only. Do **not** store mutable project facts here (e.g. tech stack, code style).
- **Genes (`gene_*.md`)**: declared project facts/constraints (_brain only)
- **Memory (`mem_*.md`)**: learned, time-stamped observations (append-only).

## Frontmatter policy
- Do **not** add YAML frontmatter to files in `_brain_v1/`.
- Derive any “metadata” from the **path + filename**.


## Singleton state files (allowed)
Some state artifacts are intentionally not part of the `{prefix}{id}_{slug}.md` scheme:
- `@_brain_v1/homeostasis.yaml`
- `@_brain_v1/4_evolution/vitals.yaml`

## Link policy
- Do not reference other synapses by `id` (avoid tight coupling + drift).
- Prefer stable paths (e.g. `@_brain_v1/3_context/...`) or plain text.
