# Inscribe Engine Pipeline Map

## 1. Parsing
**Goal:** Extract structured blocks from raw text input.
- `parseBlocks` (src/parse/parseBlocks.ts)
  - `parseSingleBlock` (src/parse/parseSingleBlock.ts)
    - `parseDirectives` (src/parse/parseDirectives.ts)
    - `extractFencedBlock` (src/parse/parseFencedBlock.ts)
  - `parseFallbackBlocks` (src/parse/parseFallback.ts)

## 2. Validation
**Goal:** Ensure blocks are valid and safe to apply.
- `validateBlocks` (src/validate/validateBlocks.ts)
  - `validateBlock` (src/validate/validateBlocks.ts)
    - `resolveAndAssertWithinRepo` / `resolveAndAssertWithinScope` (src/paths/resolveAndAssertWithin.ts)
    - `validateRangeAnchors` (src/validate/validateRangeAnchors.ts)

## 3. Planning
**Goal:** Convert validated blocks into an execution plan.
- `buildApplyPlan` (src/plan/buildApplyPlan.ts)

## 4. Application
**Goal:** Execute the plan, modifying files with backup support.
- `applyChanges` (src/apply/applyChanges.ts)
  - `createBackup` (src/apply/backups.ts)
  - `applyOperation` (src/apply/applyOperation.ts)
    - `applyRangeReplace` (src/apply/rangeReplace.ts)
