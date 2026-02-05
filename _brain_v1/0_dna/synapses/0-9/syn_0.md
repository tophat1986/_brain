---
id: [syn_0]
title: Internal Immune System
pill: Maintenance
version: v1
description: The immune system of the brain. Ensures all new synapses follow the strict pattern.
---
### [syn_0] Internal Immune System

**The Rule:** All new synapses must follow the strict structural pattern to ensure parsing integrity.

**Pattern Requirement:**
1. **Filename:** `syn_{integer}.md` (no leading zeros).
2. **Magnitude Sharding:** Store synapses in numeric range buckets under `synapses/` (e.g. `0-9`, `10-99`, `100-999`) to prevent directory clutter as the brain grows.
3. **Placement:** Put `syn_{n}.md` in the bucket that contains `n`.
4. **Frontmatter:** Must include `id`, `title`, `pill`, `version`, `description`.
5. **ID Format:** `[syn_{integer}]` matching the filename.
6. **No cross-syn links:** A synapse must not reference any other synapse `id` (synapses are ephemeral).

**Trigger:** Only active during Brain Surgery (Schema modifications).
