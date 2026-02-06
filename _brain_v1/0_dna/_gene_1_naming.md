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
  - For synapses/protocols: **aim 3–5 keywords**
  - For genes: **1–5 keywords**, but must still be high-signal
- **Examples**:
  - `_syn_12_lifecycle_hooks_checkpoints.md`
  - `syn_45_auth_flow_decisions.md`
  - `_gene_2_metabolic_efficiency.md`
  - `_wbc_1_brain_loc_kpi_scan.md`

## Placement protocol
- **DNA (Genes)**: `_brain_v1/0_dna/_gene_*.md` (shipped) and `_brain_v1/0_dna/gene_*.md` (user)
- **System Synapses (shipped)**: `_brain_v1/**/synapses/**/_syn_*.md`
- **User Synapses (project)**: `_brain_v1/**/synapses/**/syn_*.md`
- **Magnitude sharding**: store synapses in numeric range buckets under `synapses/` (e.g. `0-9`, `10-99`, `100-999`) to avoid directory bloat.

## Frontmatter policy
- Do **not** add YAML frontmatter to files in `_brain_v1/`.
- Derive any “metadata” from the **path + filename**.
- If a website needs extra labels/graph data later, generate it externally from the public repo.

## Singleton state files (allowed)
Some state artifacts are intentionally not part of the `{prefix}{id}_{slug}.md` scheme:
- `@_brain_v1/4_evolution/homeostasis.yaml`

## Link policy
- Do not reference other synapses by `id` (avoid tight coupling + drift).
- Prefer stable paths (e.g. `@_brain_v1/3_context/...`) or plain text.
