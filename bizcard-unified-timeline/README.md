# BizCard 2.0 - Unified Timeline Prototype

A fully interactive HTML prototype showcasing the Unified Timeline concept for BizCard 2.0.

## 🚀 Quick Start

1. Open `index.html` in any modern browser
2. Or use a local server: `npx serve .` or `python -m http.server 8000`

## ✨ Features Implemented

### Header (v2.0)
- [x] Avatar with status indicator + Settings drawer access
- [x] **Hardware status** displayed in center (BizCard Pro connection status)
- [x] QR share button next to avatar
- [x] **Collapsible search** - icon by default, expands on tap
- [x] **Filter pills inline with search** - Meetings, Calls, Date, Contacts (icons only for Date/Contacts)

### Action Hub
- [x] Sticky position below header
- [x] Badge showing pending action count
- [x] Expandable panel with action list
- [x] Checkbox to complete actions
- [x] Scope chips display active filters
- [x] Clear filters button

### Timeline Stream
- [x] Day-grouped entries with date headers
- [x] Time + dot axis (color-coded by type)
- [x] **Simplified cards** - no "Completed" badge, only red dot if pending actions
- [x] **Avatar stack** for participants (no full names, just initials)
- [x] **Expand button** instead of "详情" button
- [x] Click avatar to filter by that contact
- [x] Cluster/micro-dot support with expand/collapse

### FAB Menu
- [x] **Add Action** (✓) - Add a new action item
- [x] **Scan Card** (📷) - Scan business card → creates card entry
- [x] **Quick Record** (🎙️) - Voice recording → creates meeting entry
- [x] Processing state with skeleton loader

### Settings Drawer (Enhanced)
- [x] **Identity section** with avatar preview and edit button
- [x] **Hardware section** with card screen preview (e-ink simulation)
- [x] Hardware actions (Reverse Display, NFC Action)
- [x] Agent section (Voice & Knowledge)

### Overlays & Modals
- [x] Contact picker modal
- [x] Date range picker modal
- [x] Add action modal
- [x] Backdrop click to close
- [x] Mutual exclusion (one overlay at a time)
- [x] Scroll lock when overlay open

### Toast Notifications
- [x] Action completed feedback
- [x] Undo support

## 📁 File Structure

```
bizcard-unified-timeline/
├── index.html    # Main HTML structure
├── styles.css    # All CSS (iOS-style theme)
├── app.js        # Application logic & rendering
├── data.js       # Mock data (contacts, actions, timeline)
└── README.md     # This file
```

## 🎨 Design Decisions

### Card Simplification
- **No "Completed" badge** - presence/absence of red action dot indicates status
- **Avatar stack** instead of full name list - cleaner, more scannable
- **Arrow button** for expand - universal, language-independent

### Header Efficiency
- **Collapsible search** saves space when not in use
- **Icon-only pills** for Date/Contacts save horizontal space
- **Hardware status** visible at a glance in header center

### FAB Semantics
| Button | Action |
|--------|--------|
| Quick Record | Voice memo → Meeting card |
| Scan Card | Scan business card → Contact card |
| Add Action | Create new action item |

## 🔧 Technical Notes

- **Zero dependencies** - pure HTML/CSS/JS
- **iOS-like styling** - SF Pro font stack, proper iOS radii/shadows
- **Responsive within iPhone frame** - fixed 390x844 viewport simulation
- **Accessible** - ARIA attributes, keyboard support
