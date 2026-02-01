# KTL Next-Gen Project - Design Document

Project to convert KTL (Knack Toolkit Library) from Classic Knack to Next-Gen Knack.

## Quick Links

| Resource | Path/URL |
|----------|----------|
| KTL Next-Gen Library | `C:\code\Lib\KTLNG\` |
| Original KTL | `C:\code\Lib\KTL\` |
| Test App | `C:\code\KnackApps\KTL-NG Tutorials\` |
| Classic Docs | https://docs.knack.com/reference/interface-events |
| Next-Gen Docs | https://docs.knack.com/reference/using-js-with-next-gen-knack |

---

## Classic vs Next-Gen: Key Differences

### Initialization

```javascript
// Classic Knack
KnackInitAsync = function($, callback) {
    LazyLoad.js(['file.js'], () => callback());
};

// Next-Gen Knack
Knack.ready().then(async () => {
    await Knack.loadScript('file.js');
});
```

### Event System

| Classic Event | Next-Gen Event |
|---------------|----------------|
| `knack-scene-render.scene_X` | `page:render:scene_X` |
| `knack-scene-render.any` | `page:render` |
| `knack-view-render.view_X` | `view:render:view_X` |
| `knack-view-render.any` | `view:render` |
| `knack-form-submit.view_X` | `form:submit:view_X` |
| `knack-record-create.view_X` | `record:create` |
| `knack-record-update.view_X` | `record:update` |
| `knack-records-render.view_X` | `records:render:view_X` |

```javascript
// Classic
$(document).on('knack-scene-render.scene_1', function(event, scene) {});

// Next-Gen
Knack.on('page:render:scene_1', ({ pageKey }) => {});
```

### Schema Access

| Operation | Classic | Next-Gen |
|-----------|---------|----------|
| Get pages | `Knack.scenes.models` | `await Knack.getPages()` |
| Get tables | `Knack.objects.models` | `await Knack.getTables()` |
| Get fields | `Knack.fields` | `await Knack.getFields(tableKey)` |
| Get views | `Knack.views` | `await Knack.getViews(pageKey)` |
| Get user | `Knack.getUserAttributes()` | `await Knack.getUser()` |
| App details | `Knack.application_id` | `await Knack.getApplicationDetails()` |

### Resource Loading

```javascript
// Classic - LazyLoad.js
LazyLoad.js(['script.js'], function() { /* loaded */ });
LazyLoad.css(['style.css'], function() { /* loaded */ });

// Next-Gen - Built-in
await Knack.loadScript('script.js');
await Knack.loadCSS('style.css');
await Knack.loadResources({ js: ['a.js', 'b.js'], css: ['a.css'] });
```

### DOM Manipulation Philosophy

**Classic**: jQuery-based DOM manipulation is the norm.

**Next-Gen**: CSS-first approach. React maintains virtual DOM - avoid structural changes.

> "React maintains a virtual representation of the DOM and expects to control all structural changes. Moving, removing, or restructuring DOM elements will break React's unmount process."

---

## Architecture Overview

### Current KTL Structure (31,000+ lines)

```
KTL.js
├── Keyword Parser (lines 46-380)
├── ktl.const - Constants
├── ktl.core - Config, API calls, utilities
├── ktl.storage - localStorage operations
├── ktl.fields - Field manipulation
├── ktl.persistentForm - Form data persistence
├── ktl.autocomplete - Autocomplete features
├── ktl.systemColors - Color management
├── ktl.userFilters - Saved filters
├── ktl.debugWnd - Debug window
├── ktl.views - View rendering (11,000+ lines)
├── ktl.scenes - Page lifecycle
├── ktl.log - Logging system
├── ktl.userPrefs - User preferences
├── ktl.account - User/auth info
├── ktl.iFrameWnd - iFrame communication
├── ktl.wndMsg - Window messaging
├── ktl.bulkOps - Bulk operations
├── ktl.sysInfo - System info
├── ktl.accountsLogs - Account logging
├── ktl.statusMonitoring - Health monitoring
├── ktl.virtualKeyboard - Touch keyboard
└── ktl.apiKey - API key management
```

### KTL Next-Gen Target Structure

Same module organization, but with:
- Vanilla JS instead of jQuery (where possible)
- Promise-based APIs
- CSS-first DOM modifications

---

## Loader Architecture

### Current KTL_Loader.js (Basic)

```javascript
Knack.ready().then(async () => {
    await Knack.loadScript('http://localhost:3000/...');
    console.log('Loaded!');
});
```

### Target KTL_Loader.js (Full Version Management)

Must support modes like KTL:
- **prod**: Production CDN (numbered or latest)
- **beta**: Pre-release testing
- **dev**: Development/bleeding-edge
- **local**: localhost:3000 for development
- **numbered**: Specific version (e.g., 0.40.1)

Configuration via localStorage:
```
${appShortName}_ktlCode    // 'prod', 'beta', 'dev', 'local', or '0.x.y'
${appShortName}_bypassKtl  // Disable KTL entirely
${appShortName}_fileName     // App file name for local mode
```

---

## Keyword System

### How Keywords Work

Keywords are embedded in Builder (view titles, field descriptions) and parsed at runtime.

Syntax: `_keyword` or `_keyword=param1,param2` or `_keyword=[group1],[group2]`

Example view title: `Active Orders _ar=30 _hc=field_45,field_67`

### Keyword Categories

**DOM-Independent (Easy Port)**
- `_ar` (auto-refresh) - Timer-based
- `_rvs` (refresh views after submit)
- `_bm` (bookmarks)

**CSS-Addressable (Use CSS Injection)**
- `_hc` (hide columns) - Generate CSS rules
- `_rc` (remove columns)
- `_cls` (add/remove class)
- `_sth` (sticky table header)
- `_stc` (sticky table columns)

**Complex (May Need Rewrite)**
- `_cfv` (conditional formatting)
- `_uvx` (user value extraction)

### CSS-First Strategy for Keywords

Instead of DOM manipulation:
```javascript
// OLD: jQuery DOM manipulation
$('#view_123 th:nth-child(3)').addClass('ktlDisplayNone');

// NEW: CSS injection
const style = document.createElement('style');
style.textContent = '#view_123 th:nth-child(3) { display: none; }';
document.head.appendChild(style);
```

---

## Implementation Phases

### Phase 0: Foundation ✓
- ✅ Basic KTL_Loader.js
- ✅ Enhanced loader with version management (prod/beta/dev/local/numbered)
- ✅ Schema access via Knack.getPages/getTables/getFields/getViews

### Phase 1: Core Skeleton ✓
- ✅ KTL.js class structure with module stubs
- ✅ Keyword parser port (pages, views, fields)
- ✅ Constants (ktl.const)

### Phase 2: Core Modules (Partial)
- ✅ ktl.core (setCfg, getCfg, waitSelector, timedPopup)
- ✅ ktl.storage (localStorage/sessionStorage with prefix)
- ✅ ktl.log (clog, addLog, getLogs)
- ⬜ ktl.account (stub only)

### Phase 3: Views & Scenes (Partial)
- ⬜ ktl.scenes (stub only)
- ✅ ktl.views.autoRefresh (timer works, but view refresh blocked - see Missing API)
- ⬜ ktl.views - remaining functionality
- ⬜ CSS-first keyword handlers (_hc, _rc, etc.)

### Phase 4: Feature Modules
- ⬜ ktl.userPrefs
- ⬜ ktl.persistentForm
- ⬜ ktl.fields
- ⬜ ktl.userFilters

### Phase 5: Advanced
- ⬜ ktl.bulkOps
- ⬜ ktl.iFrameWnd
- ⬜ Remaining modules

### Phase 6: Polish
- ⬜ Full keyword testing
- ⬜ Performance optimization
- ⬜ Documentation

---

## Testing with KTL-NG Tutorials App

Test app at `C:\code\KnackApps\KTL-NG Tutorials\` should include:

1. **Scene types**: Login page, dashboard, data entry forms
2. **View types**: Table, Form, Details, Calendar, Report, Menu, Search
3. **Field types**: Text, Number, Connection, Multiple Choice, Date/Time
4. **Keywords**: At least one view per major keyword type
5. **Authentication**: Logged-in and public pages

---

## Progress Log

### 2026-01-31 (Initial)
- Initial project setup
- Created KTL Next-Gen folder structure
- Basic KTL_Loader.js working (localhost mode only)
- Created this design document
- Documented Classic vs Next-Gen differences
- **Enhanced KTL_Loader.js** with full version management (prod/beta/dev/local/numbered)
- **Created KTL.js skeleton** (~900 lines) with:
  - Keyword parser (ported from KTL, adapted for vanilla JS)
  - All module stubs: core, storage, fields, persistentForm, userFilters, views, scenes, log, userPrefs, account, iFrameWnd, wndMsg, bulkOps, sysInfo
  - Basic initialization with keyword parsing
- **Created KTL.css** with utility classes, popup styles, dark theme variables
- **Set up KTL-NG Tutorials test app** with KnackApp callback pattern

### 2026-01-31
- Extracted Knack Next-Gen API reference from decompiled code
- Documented missing view refresh API (feature request needed)
- **Git repos initialized**:
  - KTLNG: https://github.com/cortexrd/KTLNG
  - KTL-NG Tutorials: https://github.com/cortexrd/KTL-NG-Tutorials
- **Solved event race condition** - see "Event Handling Architecture" section below
- **Implemented page hiding during init** - prevents UI jitter from keyword processing

---

## Event Handling Architecture

### The Problem: Race Condition

Knack's `page:render` and `view:render` events can fire at any point during page load. KTL needs to:
1. Capture ALL events (none can be missed)
2. Process events only AFTER keywords are parsed from schema
3. Hide page during processing to prevent UI jitter

**Race condition timeline:**
```
Time →
├── Knack.ready() fires
├── KTL_Start.js begins loading
├── page:render MAY fire here ← PROBLEM: no listener yet
├── KTL.js begins loading
├── page:render MAY fire here ← PROBLEM: Ktl() not called yet
├── new Ktl() called
├── Ktl constructor runs (module definitions)
├── view:render MAY fire here ← PROBLEM: listeners not registered yet
├── Event listeners registered
├── Keywords parsing (~600-900ms)
├── view:render MAY fire here ← Need to queue, keywords not ready
├── Keywords ready
├── Process queued events
└── Future events handled normally
```

### The Solution: Two-Phase Event Capture

**Phase 1: KTL_Start.js (before KTL.js loads)**
```javascript
const queuedPages = [];
const queuedViews = [];
window._ktlListenersActive = false;

Knack.on('page:render', (data) => {
    if (!window._ktlListenersActive) {
        queuedPages.push(data);
    }
});
Knack.on('view:render', (data) => {
    if (!window._ktlListenersActive) {
        queuedViews.push(data);
    }
});

// Later: pass arrays to Ktl constructor
window.ktl = new Ktl({ lsShortName, queuedPages, queuedViews });
```

**Phase 2: KTL.js (Ktl constructor)**
```javascript
function Ktl(appInfo) {
    // Use queued events from KTL_Start.js
    const pendingPages = appInfo.queuedPages || [];
    const pendingViews = appInfo.queuedViews || [];

    // Disable KTL_Start.js listeners, enable our own
    window._ktlListenersActive = true;

    Knack.on('page:render', (data) => {
        if (keywordsReady) {
            // Process immediately
        } else {
            pendingPages.push(data);  // Same array as KTL_Start.js used
        }
    });
    // ... same for view:render
}
```

**Why this works:**
1. KTL_Start.js listeners capture events before KTL.js even loads
2. Arrays are passed by reference to Ktl constructor
3. Setting `_ktlListenersActive = true` disables KTL_Start.js listeners
4. KTL.js listeners take over, using the same arrays
5. No gap where events could be missed
6. No duplicate entries (flag prevents both listeners from pushing)

### Page Hiding During Init

To prevent UI "jitter" (columns appearing then disappearing, rows without colors then with colors):

**KTL_Start.js:**
```javascript
document.documentElement.classList.add('ktlInitializing');
```

**KTL.css:**
```css
.ktlInitializing #knack-body,
.ktlInitializing [data-testid="page-content"],
.ktlInitializing main {
    visibility: hidden !important;
}
```

**KTL.js (after processing):**
```javascript
function revealPage() {
    document.documentElement.classList.remove('ktlInitializing');
}

function scheduleReveal() {
    // Debounce: wait 200ms after last view:render
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = setTimeout(revealPage, 200);
}
```

The debounce ensures we wait for all views to finish rendering before revealing.

---

## KTL-Specific Custom Events

These events are **not natively provided by Knack** and must be implemented by KTL:

### Scene Change (Leaving a Page)

**Purpose**: Triggered when navigating away from the current page to another.

**Classic KTL Implementation** (`KTL.js:25324`):
- Uses `sceneChangeObservers` array and `sceneChangeNotificationSubscribe()`
- Observers are notified before navigation completes
- Useful for: saving unsaved work, cleanup, analytics

**KTL Next-Gen Implementation Approach**:
- Could use History API (`popstate` event)
- Could use MutationObserver on the main content area
- May need to hook into React Router if accessible

```javascript
// Proposed API
ktl.scenes.onSceneChange(callback);  // Subscribe
ktl.scenes.offSceneChange(callback); // Unsubscribe
```

### Summary Rendered

**Purpose**: Triggered when a grid/table's summary row finishes calculating and rendering.

**Why Needed**: Some keywords need the summary data to be available before processing (e.g., conditional formatting based on totals).

**Classic KTL Implementation**:
- Watches for summary row DOM elements to appear
- Uses MutationObserver or polling

**KTL Next-Gen Implementation Approach**:
- MutationObserver watching for `.kn-table-summary` or equivalent NG class
- Dispatch custom event when detected

```javascript
// Proposed API
ktl.views.onSummaryRendered(viewId, callback);
```

### Other Potential Custom Events

| Event | Purpose | Native in NG? |
|-------|---------|---------------|
| Idle timeout | User inactivity detection | No |
| Spinner timeout | Stuck loading detection | No |
| Field value changed | Real-time field monitoring | Partial |
| Inline edit complete | After inline table edit | Check NG |
| Modal opened/closed | Modal lifecycle | Check NG |

---

## Features That May Be Native in Next-Gen

Some KTL features might be built into Next-Gen Knack natively. Before porting, verify:

- [ ] Column hiding/showing - Check NG table options
- [ ] Sticky headers - Check NG table options
- [ ] Dark theme - Check NG theme settings
- [ ] Form validation messages - Check NG form features
- [ ] Field masking/formatting - Check NG field options

---

## Notes & Decisions

### Decision: Keep Module Pattern
The IIFE module pattern from KTL works well and should be preserved in KTL Next-Gen. It provides good encapsulation and is familiar to existing KTL users.

### Decision: Prioritize CSS-First
For Next-Gen compatibility, all visual modifications should use CSS injection rather than DOM manipulation where possible.

### Decision: Maintain Keyword Compatibility
The keyword syntax (`_keyword=params`) must remain identical so existing apps can migrate without changing their Builder configuration.

### Research Needed
- How Next-Gen handles modals
- FullCalendar compatibility with React
- Performance of CSS injection vs DOM manipulation for large tables

---

## Knack Next-Gen API Reference

Extracted from decompiled Knack NG source code (`Knack-NG-Code.js`).

### Global `Knack` Object Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getApplicationDetails` | `async ()` | Returns app name, id, settings |
| `getCurrentRecordId` | `()` | Returns current record ID (sync) |
| `getField` | `async (fieldKey, tableKey)` | Get single field definition |
| `getFields` | `async (tableKey)` | Get all fields for a table |
| `getPage` | `async (pageKey)` | Get single page definition |
| `getPages` | `async ()` | Get all pages |
| `getTable` | `async (tableKey)` | Get single table definition |
| `getTables` | `async ()` | Get all tables |
| `getUser` | `async ()` | Get current logged-in user |
| `getView` | `async (viewKey, pageKey)` | Get single view definition |
| `getViews` | `async (pageKey)` | Get all views for a page |
| `hasProfileKey` | `async (profileKey)` | Check if user has profile key |
| `hasProfileObject` | `async (objectKey)` | Check if user has profile object |
| `loadCSS` | `(url)` | Load CSS file (sync) |
| `loadScript` | `(url)` | Load JS file (sync) |
| `loadResources` | `async (resources)` | Load multiple resources |
| `on` | `(event, callback)` | Add event listener |
| `off` | `(event, callback)` | Remove event listener |
| `ready` | `()` | Returns Promise when Knack ready |

### `Knack.page` Object

| Method | Signature | Description |
|--------|-----------|-------------|
| `getViewFilters` | `(viewKey)` | Get filters for a view |
| `getForm` | `(viewKey)` | Get form instance |

### Usage Examples

```javascript
// Get all pages and iterate
const pages = await Knack.getPages();
for (const page of pages) {
    const views = await Knack.getViews(page.key);
    console.log(page.key, views.length, 'views');
}

// Get specific view on a page
const view = await Knack.getView('view_123', 'scene_456');

// Get all tables and fields
const tables = await Knack.getTables();
for (const table of tables) {
    const fields = await Knack.getFields(table.key);
    console.log(table.name, fields.length, 'fields');
}

// Get specific field
const field = await Knack.getField('field_123', 'object_456');

// Get current user
const user = await Knack.getUser();
console.log(user.email, user.profile_keys);

// Event listeners
Knack.on('page:render', (data) => {
    console.log('Page:', data.pageKey);
});

Knack.on('view:render', (data) => {
    console.log('View:', data.viewKey);
});

// Get current record ID (on details/form pages)
const recordId = Knack.getCurrentRecordId();
```

### Event Names

| Event | Data | Description |
|-------|------|-------------|
| `page:render` | `{ pageKey }` | Page finished rendering |
| `page:render:scene_X` | `{ pageKey }` | Specific page rendered |
| `view:render` | `{ viewKey }` | View finished rendering |
| `view:render:view_X` | `{ viewKey }` | Specific view rendered |
| `form:submit` | `{ viewKey, record }` | Form submitted |
| `form:submit:view_X` | `{ viewKey, record }` | Specific form submitted |
| `record:create` | `{ record }` | Record created |
| `record:update` | `{ record }` | Record updated |
| `records:render` | `{ viewKey, records }` | Records rendered in table |
| `records:render:view_X` | `{ viewKey, records }` | Specific view records rendered |

### Missing API: View Refresh

**No public view refresh API exists in Next-Gen Knack.**

Internally, Knack uses React Query with `staleTime: Infinity`. After mutations (create/update/delete), they invalidate queries:
```javascript
queryClient.invalidateQueries({ queryKey: ["view-data"] })
```

The query client is internal (`mb`, `Kc`) and not exposed to custom code.

### Feature Requests to Knack

Are these available? If not, can you implement them?

1. **onSceneChange** - Event when navigating away from current page
2. **onDataReady** - Event when data is ready for custom code, but view not yet rendered
3. **Deferred view rendering** - KTL receives view:render events before it can parse keywords. Need a way to tell Knack when to start rendering views
4. **setViewFilters / setViewSearch** - Complement to existing `Knack.page.getViewFilters(viewKey)`
5. **View pagination/sort control** - Ability to control records per page, sort column, and sort order
6. **refreshView(viewKey)** - Programmatically refresh a view's data
