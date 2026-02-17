# _brain Development Repository Guide

This repository is the `_brain` development source, not a host project using `_brain` at runtime.

## What This Repo Is For

- Build and evolve `_brain_v1`.
- Version and maintain shipped protocol assets.
- Keep runtime hook activation disabled during `_brain` development.

## Boundary Between Repos

- `_brain` repo (this repo): authoring and shipping source.
- Host repo (your actual app): where `_brain` runs.

## Hook Activation

- This repo keeps hooks as example-only: `.cursor/hooks.example.json`.
- In a host repo, enable by creating `.cursor/hooks.json` from that example.
- Host repo also needs `.cursor/spinal_cord.js` and `_brain_v1/`.

## Portable Setup Flow

1. Develop and version `_brain` in this repo.
2. Copy `_brain_v1/` into the host repo.
3. Copy `.cursor/spinal_cord.js` into host `.cursor/spinal_cord.js`.
4. Copy `.cursor/hooks.example.json` to host `.cursor/hooks.json`.
5. Start a new Cursor session in the host repo and verify cortex injection.
