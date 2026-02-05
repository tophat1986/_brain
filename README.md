# _Brain

`_brain` is a versioned logic layer for coding agents. Source of truth: `_brain_v1/`.

## What is it?
- The Cursor rule (`.cursor/rules/_brain_on.mdc`) is a dumb redirect.
- It blocks output until directives in `_brain_v1/1_directives/` are ingested.

## Entry Points
- **For Humans**: Start at [0_dna/0_dna_readme.md](_brain_v1/0_dna/0_dna_readme.md)
- **For Agents**: Enforced by `.cursor/rules/_brain_on.mdc` → `_brain_v1/1_directives/`

# _Brain_Transplant
- This is _brain_v1 and lives in the root of your repo project
- Do a "brain transplant" when you want to change version by swapping the entire "_brain_v1" folder for the new version. 
- Update the rule