# Director Chain (Ingestion Order)

After ingesting `1_directives`, you must:

1. Ingest **runtime state first**:
   - `@_brain_v1/homeostasis.yaml` (intent/targets)
   - `@_brain_v1/4_evolution/vitals.yaml` (current biomarkers + gates)
2. Ingest **core Identity**:
   - @_brain_v1/2_identity/synapses/0-9/_syn_7_core_values_pillars.md
   - @_brain_v1/2_identity/synapses/10-99/_syn_11_tech_lead_persona.md
3. Ingest **core Context**:
   - @_brain_v1/3_context/synapses/0-9/_syn_8_tech_stack_map_drift_protocol.md

Do not plan, advise, or implement until core Identity + core Context have been ingested.

Constraint: do not “read all files” to find context. Use slugs to pick the smallest relevant file(s).
