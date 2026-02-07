# Tech Stack Drift Gate (Gene-backed)

**The Rule:** No new dependencies unless explicitly approved **and** reconciled against the Tech Stack Map (DNA).

**Tech Stack Map (declared facts):**
- **Source**: `@_brain_v1/0_dna/gene_4_tech_stack_map.md`
- **Constraint**: Do **not** store tech stack values inside this `_syn_` file. This is the **protocol card**, not the storage location.

**Drift Protocol:**
1. Agent checks the host repo dependency manifest(s).
2. If a dependency exists there but is **not declared** in the Tech Stack Map -> **HALT**.
3. Trigger **Scribe**: reconcile by updating the Tech Stack Map (or removing the dependency).
