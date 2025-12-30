# UI to Backend Wiring - Implementation Summary

## Overview

This document describes how the Inscribe desktop app UI has been wired to the backend engine, creating a fully functional end-to-end application.

## IPC Endpoints

### Existing Endpoints Used

1. **select-repository** - Opens native folder picker dialog
2. **repo-init** - Initializes repository, returns topLevelFolders, scope, ignore, suggested, indexedCount, indexStatus
3. **get-scope** - Gets current scope for a repository
4. **set-scope** - Updates scope and re-indexes
5. **read-ignore** - Reads parsed ignore rules
6. **write-ignore** - Writes ignore file and refreshes state
7. **index-repository** - Manually trigger repository indexing
8. **index-status** - Get current indexing status
9. **parse-blocks** - Parse AI response into blocks
10. **validate-blocks** - Validate blocks against repository rules
11. **build-apply-plan** - Build apply plan from validated blocks
12. **apply-changes** - Apply changes with backup
13. **undo-last-apply** - Undo last applied changes

### New Endpoints Added

1. **read-ignore-raw** - Returns raw .inscribeignore file content with path and exists flag
   - Used by the Ignore Editor modal to load and edit the raw file

## State Management

### App State Structure

The application uses a centralized state management hook (`useAppState`) that tracks:

**Repository State:**
- `repoRoot: string | null` - Current repository path
- `topLevelFolders: string[]` - Available top-level folders
- `scope: string[]` - Currently selected scope folders
- `ignore: IgnoreRules` - Parsed ignore rules with source
- `suggested: string[]` - Suggested folders to exclude
- `indexedCount: number` - Number of indexed files
- `indexStatus: IndexStatus` - Current indexing state

**Parsing/Review State:**
- `mode: 'intake' | 'review'` - Current app mode
- `aiInput: string` - User's pasted AI response
- `parseErrors: string[]` - Errors from parsing
- `parsedBlocks: ParsedBlock[]` - Successfully parsed blocks
- `validationErrors: ValidationError[]` - Validation errors
- `reviewItems: ReviewItem[]` - Items ready for review/apply
- `selectedItemId: string | null` - Currently selected item

**UI State:**
- `isEditing: boolean` - Editor mode (read-only vs editable)
- `statusMessage: string` - Current status message

**Apply/Undo/Redo State:**
- `lastAppliedPlan: any | null` - Last applied plan for redo
- `canRedo: boolean` - Whether redo is available

### State Initialization

When a repository is selected:
1. User clicks Browse button
2. `select-repository` IPC opens native folder picker
3. On selection, `repo-init` IPC is called
4. All repository state is populated from the init response
5. Top bar pills update to show real counts

## Feature Implementation

### 1. Repository Selection

**Browse Button:**
- Triggers `select-repository` IPC
- On success, calls `initRepo()` which:
  - Calls `repo-init` IPC
  - Populates all repository state
  - Updates status message

### 2. Scope Configuration

**Scope Pill (clickable):**
- Opens `ScopeModal` component
- Shows checkboxes for all top-level folders
- Current scope is pre-selected
- On Save:
  - Calls `set-scope` IPC with new scope
  - Updates state with response
  - Re-indexes repository
  - Shows updated file count

### 3. Ignore Management

**Ignore Pill (clickable):**
- Loads raw ignore file via `read-ignore-raw` IPC
- Opens `IgnoreEditorModal` component
- Appends suggested entries as comments if not present
- On Save:
  - Calls `write-ignore` IPC with new content
  - Refreshes full repository state
  - Updates suggested list

**Ignored List (clickable on Indexed pill):**
- Opens read-only `ListModal` showing `ignore.entries`

**Suggested List (clickable on Suggested pill):**
- Opens read-only `ListModal` showing suggested excludes

### 4. Parsing Flow

**Parse Code Blocks Button:**
1. Validates repoRoot is selected
2. Validates aiInput is not empty
3. Calls `parseBlocks` IPC
4. If parse errors: displays errors, stays in intake mode
5. If parse succeeds:
   - Calls `validateBlocks` IPC
   - Builds `reviewItems` from blocks + validation errors
   - Each item gets status: 'valid', 'warning', or 'invalid'
   - Navigates to review mode
   - Selects first item

**Review Item Structure:**
- Derives language from file extension
- Calculates line count from content
- Stores both originalContent and editedContent
- Includes validation error message if present
- Stores directives for range operations

### 5. Review Screen

**Sidebar:**
- Lists all review items
- Shows status icon (✅ ✔️ ❌)
- Displays validation errors as hints
- Clicking item selects it and switches to read-only

**Editor:**
- Shows `editedContent` for selected item
- Toggle button switches between read-only and editable
- Edits update `editedContent` in state
- Original content preserved for reset

### 6. Apply Operations

**Apply Selected:**
1. Checks if selected item is valid
2. Blocks if validation errors exist
3. Builds single-item apply plan
4. Calls `apply-changes` IPC
5. On success:
   - Stores plan for redo
   - Shows success message
   - Refreshes repository state

**Apply All Changes:**
1. Checks all items for validation errors
2. Blocks if any invalid items exist
3. Builds plan from all items
4. Calls `apply-changes` IPC
5. On success:
   - Stores plan for redo
   - Shows success message
   - Refreshes repository state

**Reset All:**
- Resets all `editedContent` back to `originalContent`
- Purely in-memory operation
- No IPC calls

### 7. Undo/Redo

**Undo:**
- Calls `undo-last-apply` IPC
- Backend restores from most recent backup
- Refreshes repository state
- Last applied plan stays in memory for redo

**Redo:**
- Re-applies the last stored plan via `apply-changes` IPC
- Only available if:
  - A plan was previously applied
  - User hasn't modified anything else
- Clears redo state after successful reapplication

## Path Normalization

All paths are normalized to use forward slashes (`/`) for consistency across Windows/macOS:
- `normalizePath()` utility converts backslashes to forward slashes
- Backend repository functions also normalize paths
- Scope entries always have trailing slashes

## Error Handling

**Parse Errors:**
- Displayed in red error banner in intake mode
- Prevents navigation to review mode
- User must fix input or AI response

**Validation Errors:**
- Shown per-item in sidebar (red X icon)
- Displayed in error banner when item selected
- Blocks Apply Selected/All if any errors exist
- Includes detailed error message

**Apply Errors:**
- Shown in status banner
- Backend returns specific error messages
- Repository state still refreshed to show current state

**Missing Repository:**
- All operations requiring repoRoot check for null
- Parse button disabled if no repo selected
- Modal operations blocked if no repo selected

## Components

### New Components Created

1. **ScopeModal** - Configure scope with folder checkboxes
2. **IgnoreEditorModal** - Edit .inscribeignore file with suggested entries
3. **ListModal** - Generic read-only list display
4. **useAppState** - Centralized state management hook
5. **utils.ts** - Helper functions (language detection, line counting, plan building)

### Component Files

- `App.tsx` - Main application component (fully rewritten)
- `ScopeModal.tsx` - Scope configuration modal
- `IgnoreEditorModal.tsx` - Ignore file editor
- `ListModal.tsx` - Read-only list viewer
- `useAppState.ts` - State management hook
- `utils.ts` - Utility functions

## Styling

Added CSS for:
- Modal overlay and content
- Clickable pills with hover effects
- Error banners for parse/validation errors
- Status icon colors (green, yellow, red)
- Validation error hints in sidebar
- Folder/item list styling
- Ignore file editor styling

## Known Limitations

1. **Redo Constraints:**
   - Only stores one level of redo (last applied plan)
   - Redo cleared if user performs any other action
   - No detection of external file modifications

2. **No Local Undo/Redo:**
   - Undo/Redo buttons only affect applied changes
   - Editor changes don't have undo/redo
   - This matches the requirement for "apply-level" undo/redo

3. **No Polling:**
   - Index status is synchronous (indexing completes before response)
   - No real-time status updates during long operations
   - Could add polling if needed for large repositories

4. **Single Repository:**
   - Only one repository can be active at a time
   - No tab/window management for multiple repos

5. **No History View:**
   - History button is placeholder
   - Could show list of backups in future

## Testing Checklist

- [x] Build system works (all packages compile)
- [x] Engine tests pass (38/38)
- [ ] Manual testing: repository selection
- [ ] Manual testing: scope configuration
- [ ] Manual testing: ignore file editing
- [ ] Manual testing: parse → validate → review flow
- [ ] Manual testing: apply operations
- [ ] Manual testing: undo/redo
- [ ] Windows path normalization
- [ ] macOS path normalization

## Future Enhancements

1. Add polling for index status during long operations
2. Implement multi-level redo stack
3. Add local editor undo/redo (per-item)
4. Show backup history in History button
5. Add keyboard shortcuts
6. Add syntax highlighting in editor
7. Add diff view showing changes
8. Add batch operations (apply subset)
9. Add search/filter for review items
10. Add settings persistence (theme, editor preferences)
