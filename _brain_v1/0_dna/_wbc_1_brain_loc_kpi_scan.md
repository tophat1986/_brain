# Brain LOC KPI Scan

## Trigger
Run when asked for:
- LOC baseline
- LOC KPI
- “Run WBC-1”

## Scope
- Measure `_brain_v1` **Brain layer** only (not the host repo)
- Use the scope definition at:
  - `@_brain_v1/4_evolution/vitals.yaml` → `scopes.brain_md`

## Output
Update the vitals snapshot:
- `@_brain_v1/4_evolution/vitals.yaml`

Set (at minimum):
- `generated_at` (ISO timestamp with time + offset)
- `brain_vitals.last_scan_at`
- `brain_vitals.md_files`
- `brain_vitals.md_lines`
- `brain_vitals.md_bytes`

Then update `chemical_state.inflammation` and `gates.block_new_features` using `@_brain_v1/0_dna/_gene_3_homeostatic_regulation.md`.
