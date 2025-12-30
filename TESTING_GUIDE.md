# Testing the Wired UI

This guide explains how to manually test the fully wired Inscribe application.

## Prerequisites

1. Build the application:
```bash
npm run build
```

2. (Optional) Run in development mode:
```bash
npm run dev:desktop
```

## Test Scenarios

### Test 1: Repository Selection and Initialization

1. **Launch the app**
2. **Click the folder icon (📂)** in the top bar
3. **Select a valid Git repository** on your system
4. **Verify:**
   - Repository path appears in the input field
   - Top bar pills update with real values:
     - Scope: X (number of folders in scope)
     - Ignore: Y (number of ignore rules)
     - Suggested: Z (number of suggested excludes)
     - Indexed: N files
     - Status shows "complete"
   - Status message shows "Repository initialized: N files indexed"

### Test 2: Scope Configuration

1. **Click on "Scope: X" pill** in top bar
2. **Modal should open** showing checkboxes for top-level folders
3. **Toggle some folders** on/off
4. **Click "Save Scope"**
5. **Verify:**
   - Modal closes
   - Scope count updates in pill
   - Indexed count updates (may increase or decrease)
   - Status message confirms update

### Test 3: Ignore File Management

1. **Click on "Ignore: X" pill** in top bar
2. **Editor modal should open** with:
   - Current .inscribeignore content (if exists)
   - Suggested entries commented out at bottom
3. **Add or modify some patterns**, e.g.:
   ```
   dist/
   build/
   temp/
   ```
4. **Click "Save"**
5. **Verify:**
   - Modal closes
   - Ignore count updates
   - Indexed count may change
   - Status message confirms update

### Test 4: View Suggested and Ignored Lists

1. **Click on "Suggested: X" pill** - modal shows suggested folders to exclude
2. **Click on "Indexed: N files" pill** - modal shows currently ignored paths
3. **Verify:**
   - Lists display correctly
   - Can close modals

### Test 5: Parse AI Response

1. **Ensure repository is selected**
2. **Paste a valid AI response** with Inscribe blocks in the text area:

```
Here's an example file:

@inscribe BEGIN
@inscribe FILE: test/example.js
@inscribe MODE: create

```javascript
console.log('Hello, World!');
```
@inscribe END
```

3. **Click "Parse Code Blocks"**
4. **Verify:**
   - App switches to review mode
   - Sidebar shows "1 files"
   - File appears in list with status icon
   - Status message shows parse/validation result

### Test 6: Parse with Errors

1. **Paste invalid content** (missing @inscribe blocks)
2. **Click "Parse Code Blocks"**
3. **Verify:**
   - Error banner appears with parse errors
   - Still in intake mode
   - Can fix and try again

### Test 7: Validation Errors

1. **Paste a block targeting a file outside scope:**

```
@inscribe BEGIN
@inscribe FILE: outside_scope/test.js
@inscribe MODE: create

```javascript
// This will fail validation
```
@inscribe END
```

2. **Click "Parse Code Blocks"**
3. **Verify:**
   - Switches to review mode
   - File shows ❌ icon
   - Validation error displayed
   - Apply buttons disabled or show error

### Test 8: Review and Edit

1. **Parse valid blocks** (from Test 5)
2. **Click on a file** in sidebar
3. **Verify:**
   - File content shows in preview (read-only)
   - File details shown (language, line count, mode)
4. **Click "Edit" button**
5. **Modify the content**
6. **Verify:**
   - Content updates as you type
   - Status shows "Modified (not applied)"
7. **Click "Preview" button**
8. **Verify:** switches back to read-only view

### Test 9: Apply Selected

1. **Select a valid file** (with ✅)
2. **Click "Apply Selected"**
3. **Verify:**
   - Status shows "Applied: filename"
   - File is created/modified on disk
   - Repository state refreshes
   - Undo becomes available

### Test 10: Apply All

1. **Parse multiple valid blocks**
2. **Optionally edit some**
3. **Click "Apply All Changes"**
4. **Verify:**
   - Status shows "Applied all: X file(s)"
   - All files created/modified on disk
   - Backup created in `.inscribe/backups/`

### Test 11: Apply with Validation Errors

1. **Parse blocks with validation errors** (outside scope, ignored, etc.)
2. **Click "Apply All Changes"**
3. **Verify:**
   - Error message shows: "Cannot apply: X file(s) have validation errors"
   - No changes made
   - Status explains the issue

### Test 12: Reset All

1. **Parse blocks and edit multiple files**
2. **Click "Reset All"**
3. **Verify:**
   - All edited content reverts to original
   - Status shows "Reset all to original content"

### Test 13: Undo Apply

1. **Apply some changes** (Test 9 or 10)
2. **Click "Undo Apply"**
3. **Verify:**
   - Status shows "Undo successful"
   - Files restored from backup
   - Repository state refreshed
   - Redo becomes available

### Test 14: Redo Apply

1. **After undo** (Test 13)
2. **Click "Redo Apply"**
3. **Verify:**
   - Status shows "Redo successful"
   - Changes re-applied
   - Redo disabled after use

### Test 15: Edge Cases

**No Repository:**
1. Don't select a repository
2. Try to parse blocks
3. **Verify:** Error: "No repository selected"

**Empty Input:**
1. Select repository
2. Don't paste anything
3. Click parse
4. **Verify:** Error shown

**Scope Empty:**
1. Configure scope to deselect all folders
2. Parse blocks
3. **Verify:** All files fail validation (outside scope)

## Sample AI Response for Testing

```markdown
Let me help you with those changes:

@inscribe BEGIN
@inscribe FILE: src/utils/helpers.js
@inscribe MODE: create

```javascript
export function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```
@inscribe END

@inscribe BEGIN
@inscribe FILE: src/config/settings.json
@inscribe MODE: create

```json
{
  "appName": "Inscribe",
  "version": "0.1.0",
  "debug": false
}
```
@inscribe END

@inscribe BEGIN
@inscribe FILE: README.md
@inscribe MODE: append

## New Section

This content will be appended to the file.
@inscribe END
```

## Troubleshooting

**App won't start:**
- Ensure you've run `npm run build`
- Check for TypeScript errors in console
- Try `npm install` to ensure dependencies

**IPC errors:**
- Make sure both main and renderer processes are running
- Check Electron DevTools console (View > Toggle Developer Tools)

**Backend errors:**
- Check that engine package built successfully
- Verify repository permissions (read/write access)
- Check `.inscribe` directory is writable

**Path issues on Windows:**
- Paths should use forward slashes internally
- Backend normalizes paths automatically
- If issues persist, check console for normalization errors

## Expected File Structure After Testing

After running tests, you should see:

```
<your-repo>/
  .inscribe/
    backups/
      2024-12-30T18-00-00/
        metadata.json
        (backed up files)
    scope.json (created by engine)
  .inscribeignore (if you edited it)
  (your applied files)
```

## Notes

- All operations are real - files will be created/modified
- Backups are in `.inscribe/backups/` with timestamps
- Scope state is persisted in user data directory
- Test in a safe/test repository first!
