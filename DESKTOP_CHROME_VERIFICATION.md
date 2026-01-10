# Desktop App Chrome Verification Checklist

This document describes the changes made to improve the desktop app chrome and how to manually verify them.

## Changes Made

### 1. Fixed App Shell Layout
**Files Changed:** `apps/desktop/src/App.tsx`

**Changes:**
- Changed root container from `min-h-screen` to `h-screen overflow-hidden`
- This ensures the app fills the viewport height exactly and doesn't allow the header/footer to scroll away

**How to Verify:**
1. Launch the application
2. Paste a large amount of content in the intake panel
3. Scroll within the content area
4. **Expected:** Header and footer remain fixed in place, only the main content area scrolls

### 2. Main Content Scroll Container
**Files Changed:** `apps/desktop/src/components/app/MainContent.tsx`

**Changes:**
- Added `overflow-hidden` to the grid container
- Added `overflow-y-auto` to the main content area
- This makes the main content area the primary scroll container

**How to Verify:**
1. In the intake panel, paste a long AI response
2. Scroll within the content area
3. **Expected:** Content scrolls smoothly within its container, header/footer stay fixed
4. Check the review panel with multiple files
5. **Expected:** Same scrolling behavior

### 3. Fixed Footer with Right-Aligned Status
**Files Changed:** `apps/desktop/src/components/StatusBar.tsx`

**Changes:**
- Added `flex-shrink-0` to footer to prevent it from shrinking
- Changed layout to `justify-between` to separate breadcrumb and status
- Moved status indicator to the right side
- Replaced Badge component with plain text and icon display
- Status shows as text with an icon (no colored backgrounds, pills, or badges)

**How to Verify:**
1. Launch the application
2. **Expected:** Footer is at the bottom of the viewport
3. Observe the breadcrumb on the left (Parse / Review)
4. Observe status indicator on the right showing the current state
5. When parsing or applying changes, status should update with appropriate icon and text
6. **Expected:** Status displays as plain text with icon, no colored badges or pills

### 4. Toolbar-Style Header Controls
**Files Changed:** `apps/desktop/src/components/app/AppHeader.tsx`

**Changes:**
- Removed Badge components for Scope, Ignore, Suggested, and Indexed counts
- Replaced with toolbar-style button elements (text with hover states)
- All controls have consistent height (h-8)
- Header has fixed height (h-[52px])
- Controls use `text-muted-foreground` with `hover:text-foreground` and `hover:bg-accent`
- No filled buttons, outlined buttons, or pill/badge styling

**How to Verify:**
1. Launch the application
2. Hover over "Scope:", "Ignore:", "Suggested:", and "Indexed:" controls
3. **Expected:** Each control changes appearance on hover (text darkens, subtle background)
4. **Expected:** No colored badges, pills, or outlined buttons visible
5. **Expected:** All controls align at the same height in the header

### 5. Fixed-Width Repository Name Container
**Files Changed:** `apps/desktop/src/components/app/AppHeader.tsx`

**Changes:**
- Repository name is in a fixed-width container (`w-32 flex-shrink-0`)
- Long repository names truncate with ellipsis
- Preserves original casing of repository name (no normalization)
- Shows full name in title attribute on hover

**How to Verify:**
1. Select different repositories with varying name lengths
2. **Expected:** Layout does not shift when repository name changes
3. Try a repository with a very long name
4. **Expected:** Name truncates with ellipsis, full name shows on hover
5. Try a repository with mixed-case name (e.g., "MyRepoName")
6. **Expected:** Casing is preserved exactly as it appears in the file system

### 6. Fixed-Width Repository Path Control
**Files Changed:** `apps/desktop/src/components/app/AppHeader.tsx`

**Changes:**
- Repository path input has fixed width (`w-80`) instead of `flex-1`
- Height increased to match other header controls (`h-8`)
- Long paths truncate cleanly with ellipsis
- Read-only input behavior preserved
- Full path shows in title attribute on hover

**How to Verify:**
1. Select a repository with a long path
2. **Expected:** Path input has reasonable, fixed width (not taking all available space)
3. **Expected:** Long paths show truncated with ellipsis in the input
4. Hover over the path input
5. **Expected:** Full path appears in tooltip
6. **Expected:** Path input height matches other header controls

### 7. Toolbar-Style Right Sidebar Buttons
**Files Changed:** `apps/desktop/src/components/app/MainContent.tsx`

**Changes:**
- Replaced outlined Button components with simple button elements
- Uses ghost/toolbar styling (icon with hover state)
- No borders, no filled backgrounds, just icon with hover effect
- Consistent with desktop IDE patterns

**How to Verify:**
1. Look at the right sidebar with History, Settings, Info icons
2. **Expected:** No outlined buttons visible
3. Hover over each icon button
4. **Expected:** Subtle background appears on hover, no borders
5. **Expected:** Icons change color on hover

## Overall Desktop App Shell Pattern

The application now follows a standard desktop IDE layout:
- **Fixed header** at the top with toolbar-style controls
- **Fixed footer** at the bottom with breadcrumb navigation and status
- **Scrollable main content area** in the middle
- **Fixed sidebars** on left and right with their own internal scrolling

This matches the behavior of desktop tools like VS Code, IntelliJ IDEA, and other professional development environments.

## Testing Scenarios

### Scenario 1: Empty State
1. Launch app without selecting a repository
2. **Expected:** Layout is stable, header/footer are visible and fixed

### Scenario 2: Content Overflow
1. Select a repository
2. Paste a very long AI response (500+ lines)
3. Scroll through the content
4. **Expected:** Only content scrolls, header/footer remain fixed
5. Switch to review panel with many files
6. **Expected:** Same behavior, only content scrolls

### Scenario 3: Repository Switching
1. Select repository A
2. Note the layout
3. Select repository B with a different name length
4. **Expected:** Header layout remains stable, no elements shift position

### Scenario 4: Status Updates
1. Parse some code blocks
2. Observe status indicator in footer (right side)
3. **Expected:** Status updates shown as plain text with icon
4. Apply changes
5. **Expected:** Status updates continue to show cleanly

### Scenario 5: Responsive Behavior
1. Resize the window to different sizes
2. **Expected:** Layout adapts but maintains fixed header/footer
3. **Expected:** Scrolling behavior remains consistent

## Desktop Sizing

The layout is designed to work well on standard desktop resolutions:
- Minimum practical width: ~1280px
- Recommended: 1440px or wider
- Works on both Windows and macOS desktop environments
- Scales appropriately with system DPI settings
