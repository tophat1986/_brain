---
id: [syn_10]
title: Director Chain
pill: Flow
version: v1
description: Enforces the ingestion order after directives: Identity, then Context.
---

### [syn_10] Director Chain

After ingesting `1_directives`, you must:

1. Read all `syn_*.md` under `@_brain_v1/2_identity/` (recursive), sorted by the integer in `syn_{n}.md` ascending.
2. Read all `syn_*.md` under `@_brain_v1/3_context/` (recursive), sorted by the integer in `syn_{n}.md` ascending.

Do not plan, advise, or implement until Identity + Context have been ingested.
