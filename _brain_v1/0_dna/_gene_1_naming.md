# Gene 1: Naming & File Creation

The file tree **is** the index. If a filename doesn’t carry enough signal to justify opening it, the file is named incorrectly.

## Naming protocol
- **Format**: `{prefix}{id}_{slug}.md`
- **Prefixes**:
  - `_gene_` (DNA / shipped laws) - declared project facts/constraints (_brain only) - Read only by Director
  - `_syn_` (System / shipped synapses) - Protocol cards only. Read only by Director. Only in folders: `1_directives` | `2_identity` | `3_context`
  - `syn_` (User / project synapses) - Protocol cards only. Read only by Director. Only in folders: `1_directives` | `2_identity` | `3_context`
  - `_wbc_` (Immune protocol / shipped) - Read only by Director. Always in folder = `3_context`
   - `inf_` (Immune report / symptom) - Set by Director. Always in folder = `3_context`
  - `mem_` (Evolution / learned memory) - time-stamped observations. Set by Director. Always in folder = `4_evolution`
- **ID**: integer, no leading zeros (e.g. `1`, `12`, `105`)
- **Slug**: `snake_case` semantic keywords
  - Use **high-signal** intent so an agent can select files without opening them (token efficiency). 


## Placement protocol
- **DNA (Genes)**: `_brain_v1/0_dna/_gene_*.md` - Shipped read only. Cannot be added by Director or User.
- **Synapses (System/Shipped)**: `_brain_v1/**/synapses/**/_syn_*.md`
- **Synapses (User)**: `_brain_v1/**/synapses/**/syn_*.md`
- **Magnitude sharding**: store synapses in numeric range buckets under `synapses/` (e.g. `0-9`, `10-99`, `100-999`) to avoid directory bloat.

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
