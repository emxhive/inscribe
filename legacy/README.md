# Legacy Archives

This directory contains archived versions of the Inscribe codebase. These archives are maintained for reference purposes only.

## Layout

- `v0/`: The original archived range-replacement prototype.
- `v1/`: Frozen text-engine snapshot captured prior to the redesign into the V2 structural-engine.

## Rules & Integration

- **Reference-Only**: All code in this directory is read-only reference material.
- **No Imports**: Active code must never import from the `legacy/` directory.
- **Inert**: Legacy code is excluded from TypeScript compilation, active workspace packages, and test discovery.
