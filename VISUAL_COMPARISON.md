# Visual Layout Comparison: Before and After

## Before: Website-Style Layout

```
┌─────────────────────────────────────────────────────────┐
│ Header (scrolls away)                                   │
│ ┌──────────────────┐ ┌─────────┐ ┌─────────┐          │
│ │ RepoName-Changes │ │ Badge   │ │ Badge   │ ...      │
│ └──────────────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────┘
│                                                         │
│  Main Content (no explicit overflow handling)          │
│  - Scrolls entire page including header/footer         │
│  - Badge pills everywhere                              │
│  - Outlined buttons in sidebar                         │
│                                                         │
│                                                         │
┌─────────────────────────────────────────────────────────┐
│ Footer (scrolls away)                                   │
│ Parse > Review                                          │
└─────────────────────────────────────────────────────────┘
```

### Issues:
- ❌ min-h-screen allows header/footer to scroll
- ❌ No dedicated scroll container
- ❌ Badge components everywhere (colored pills)
- ❌ Outlined buttons don't match IDE style
- ❌ Repository name/path can cause layout shifts
- ❌ Status mixed in with other badges

## After: Desktop IDE-Style Layout

```
┌─────────────────────────────────────────────────────────┐
│ Header (FIXED: h-[52px], flex-shrink-0)                │
│ ┌────────┐ ┌──────────────────┐ ┌─┐                   │
│ │RepoName│ │ /path/to/repo... │ │📁│                  │
│ │ w-32   │ │     w-80         │ └─┘                   │
│ └────────┘ └──────────────────┘                        │
│                                                         │
│ [Scope: 3] [Ignore: 5] [Suggested: 2] [Indexed: 120]  │
│  text with hover - no pills/badges                     │
└─────────────────────────────────────────────────────────┘
│ Main Content Area (overflow-y-auto)                    │
│ ┌─────────┬────────────────────────┬────────┐         │
│ │Sidebar  │  Main Panel            │Right   │         │
│ │(fixed)  │  (scrolls)             │Sidebar │         │
│ │overflow │                        │(fixed) │         │
│ │internal │  Content scrolls here  │        │         │
│ │         │  only. Header/footer   │ ghost  │         │
│ │         │  stay fixed!           │buttons │         │
│ │         │                        │        │         │
│ └─────────┴────────────────────────┴────────┘         │
│                                                         │
┌─────────────────────────────────────────────────────────┐
│ Footer (FIXED: flex-shrink-0)                          │
│ Parse > Review              [⟳ Parsing...] ←right side│
│                              plain text + icon          │
└─────────────────────────────────────────────────────────┘
```

### Improvements:
- ✅ h-screen overflow-hidden prevents body scroll
- ✅ Header/footer always visible (flex-shrink-0)
- ✅ Main content is scroll container (overflow-y-auto)
- ✅ Toolbar-style buttons (text with hover)
- ✅ Fixed-width repository controls (no shifts)
- ✅ Status clearly separated on right

## Detailed Component Changes

### Header Controls

**Before:**
```html
<Badge variant="secondary" className="cursor-pointer...">
  Scope: 3
</Badge>
```
- Colored background pills
- Multiple variant styles
- Inconsistent with desktop tools

**After:**
```html
<button className="text-xs text-muted-foreground hover:text-foreground 
                   transition-colors h-8 px-2 rounded hover:bg-accent">
  Scope: 3
</button>
```
- Plain text with subtle hover
- Consistent height (h-8)
- Matches IDE toolbar pattern

### Repository Controls

**Before:**
```html
<span>{repoName || 'Repository'}</span>  <!-- No width control -->
<input className="flex-1..." />          <!-- Takes all space -->
```
- Name could be any length → layout shifts
- Path takes all available space
- Normalizes casing with fallback

**After:**
```html
<div className="w-32 flex-shrink-0">    <!-- Fixed width -->
  <span className="truncate" title={repoName}>
    {repoName || 'Repository'}
  </span>
</div>
<input className="w-80..." />            <!-- Fixed width -->
```
- Fixed-width containers prevent shifts
- Ellipsis truncation with tooltip
- Preserves original casing

### Status Display

**Before (in header):**
```html
<Badge variant={pipelineStatusDisplay.variant} className="border-0 gap-1">
  {pipelineStatusDisplay.icon}
  {pipelineStatusDisplay.text}
</Badge>
```
- Colored badge in header
- Mixed with other badges
- Color-coded variants

**After (in footer):**
```html
<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
  {statusIcon}
  <span>{statusText}</span>
</div>
```
- Plain text and icon only
- Right-aligned in footer
- Clearly separated from navigation

### Sidebar Buttons

**Before:**
```html
<Button variant="outline" size="icon">
  <History className="h-4 w-4" />
</Button>
```
- Outlined buttons with borders
- More "website-y" appearance

**After:**
```html
<button className="h-9 w-9 flex items-center justify-center
                   text-muted-foreground hover:text-foreground
                   hover:bg-accent rounded-md transition-colors">
  <History className="h-4 w-4" />
</button>
```
- Ghost/toolbar style buttons
- Icon-only with hover states
- Matches IDE sidebar pattern

## Scroll Behavior Comparison

### Before (min-h-screen)
```
User scrolls ──→ Entire document scrolls
                 ├── Header scrolls away ❌
                 ├── Content scrolls
                 └── Footer scrolls away ❌
```

### After (h-screen overflow-hidden)
```
User scrolls ──→ Only main content scrolls
                 ├── Header stays fixed ✅
                 ├── Content scrolls (overflow-y-auto)
                 └── Footer stays fixed ✅
```

## Layout Stability

### Before: Repository Name Change
```
Step 1: "MyRepo"     [───────────────────────] <other controls>
Step 2: "ShortName"  [──────────]             <controls shift right> ❌
Step 3: "VeryLongRepositoryName" [────────────] <controls shift>
```
Layout shifts horizontally as name length changes.

### After: Repository Name Change
```
Step 1: "MyRepo"     [w-32 fixed ]  [w-80 fixed path...]  <controls>
Step 2: "ShortNa..." [w-32 fixed ]  [w-80 fixed path...]  <controls> ✅
Step 3: "VeryLon..." [w-32 fixed ]  [w-80 fixed path...]  <controls>
```
Layout remains stable due to fixed-width containers.

## Professional Desktop Tool Pattern

The new layout follows the standard pattern used by professional IDEs:

```
VS Code / IntelliJ / Sublime / Atom Pattern:
┌────────────────────────────────────────────────┐
│ Fixed Header (toolbar with icons/text)        │ ← Never scrolls
├────────┬───────────────────────┬───────────────┤
│ Left   │ Main Content          │ Right Sidebar │
│ Panel  │ (Primary scroll area) │ (Tools)       │ ← Main scroll
│(Files) │                       │               │
├────────┴───────────────────────┴───────────────┤
│ Fixed Footer (breadcrumb/status)              │ ← Never scrolls
└────────────────────────────────────────────────┘
```

This is now exactly how Inscribe behaves! 🎉

## Summary

The transformation from website-style to desktop IDE-style is complete:

| Aspect              | Before          | After           |
|---------------------|-----------------|-----------------|
| Scroll model        | Document scroll | App shell       |
| Header              | Scrolls away    | Fixed           |
| Footer              | Scrolls away    | Fixed           |
| Controls            | Badge pills     | Toolbar buttons |
| Repository name     | Dynamic width   | Fixed w-32      |
| Repository path     | flex-1          | Fixed w-80      |
| Status display      | Colored badge   | Plain text/icon |
| Sidebar buttons     | Outlined        | Ghost/toolbar   |
| Overall feel        | Website         | Desktop IDE ✅  |
