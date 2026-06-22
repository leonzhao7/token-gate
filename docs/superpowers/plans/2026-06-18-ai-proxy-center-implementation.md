# AI Proxy Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Token Gate admin console into a premium dual-theme SaaS control plane with a modern app shell, dashboard, resource drawers, observability views, and supporting backend presentation APIs.

**Architecture:** Keep the current Go-served vanilla admin app, but split the work into phased backend presentation APIs and a modular frontend shell. The backend exposes lightweight aggregated and detail endpoints; the frontend consumes them through a small stateful SPA-like layer built with plain HTML, CSS, and JavaScript.

**Tech Stack:** Go, net/http, SQLite, embedded static web assets, vanilla HTML/CSS/JS, SVG-based charts, browser localStorage for theme persistence.

---

## File Structure

### Existing files to modify

- `internal/app/app.go`
  - Route registration
  - New dashboard, search, detail, summary, and observability handlers
- `internal/app/app_test.go`
  - HTTP handler coverage for presentation APIs and new usage/event behavior
- `internal/store/store.go`
  - Aggregation queries
  - Detail helpers
  - Search helpers
  - Optional preview and event field support
- `internal/domain/types.go`
  - New API-facing structs and added observability fields if needed
- `internal/app/web/index.html`
  - New shell markup
  - Drawer container
  - Search modal
  - Dashboard and page skeletons
- `internal/app/web/styles.css`
  - Theme tokens
  - Layout system
  - Resource list styling
  - Timeline and drawer styling
- `internal/app/web/app.js`
  - Frontend state, router, theme, search, drawer, charts, filters, page rendering

### New files likely to create

- `internal/app/dashboard.go`
  - Optional extraction for dashboard/search/detail response builders if `app.go` becomes too large
- `internal/app/web/charts.js`
  - Small SVG chart helpers
- `internal/app/web/theme.js`
  - Theme persistence and root token application
- `internal/app/web/search.js`
  - Search modal behavior and keyboard shortcuts
- `internal/app/web/drawer.js`
  - Drawer state and tab rendering
- `internal/app/web/renderers.js`
  - Shared render helpers for cards, rows, badges, empty states

The exact split should stay practical. If extracting these modules causes too much churn, keep the number of files smaller, but do not leave all new logic in one monolithic script.

### Validation commands used throughout

- Frontend syntax:
  - `node --check /root/workspace/token-gate/internal/app/web/app.js`
- If JS is split:
  - `node --check /root/workspace/token-gate/internal/app/web/<file>.js`
- Backend tests:
  - `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app ./internal/store ./internal/scheduler ./internal/proxy`

## Task 1: Add failing backend tests for dashboard, search, and drawer data APIs

**Files:**
- Modify: `internal/app/app_test.go`
- Test: `internal/app/app_test.go`

- [ ] **Step 1: Write the failing tests**

Add handler tests for:

- `GET /admin/api/dashboard/summary`
- `GET /admin/api/dashboard/usage?range=7d`
- `GET /admin/api/dashboard/activity`
- `GET /admin/api/search?q=alpha`
- `GET /admin/api/backends/{id}/detail`
- `GET /admin/api/client-keys/{id}/detail`
- `GET /admin/api/model-policies/{id}/detail`
- `GET /admin/api/socks-proxies/{id}/detail`

Use this shape as the starting point:

```go
func TestDashboardSummaryReturnsCountsAndSeries(t *testing.T) {
	application := newTestApp(t)
	ctx := context.Background()

	_, _ = application.store.CreateBackend(ctx, domain.Backend{
		Name:      "alpha",
		BaseURL:   "https://alpha.local/v1",
		APIKey:    "alpha-key",
		Enabled:   true,
		Weight:    1,
		Models:    []string{"gpt-4o"},
		Endpoints: []string{domain.EndpointChat},
	})
	_, _ = application.store.CreateClientKey(ctx, domain.ClientKey{
		Name:        "prod-web",
		TokenHash:   store.HashToken("prod-web-token"),
		Token:       "prod-web-token",
		TokenPrefix: "prod-",
		Enabled:     true,
	})

	req := httptest.NewRequest(http.MethodGet, "/admin/api/dashboard/summary", nil)
	req.Header.Set("Authorization", "Bearer test-admin")
	recorder := httptest.NewRecorder()

	application.Handler().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestDashboardSummaryReturnsCountsAndSeries|TestDashboardUsageReturnsSeries|TestDashboardActivityReturnsRecentLists|TestSearchReturnsGroupedResults|TestBackendDetailReturnsDrawerData|TestClientKeyDetailReturnsDrawerData|TestPolicyDetailReturnsDrawerData|TestProxyDetailReturnsDrawerData' -v
```

Expected:

- FAIL with `404` responses or missing route behavior

- [ ] **Step 3: Write minimal handler and store scaffolding**

Add placeholder route registrations and minimal handler responses in `internal/app/app.go`, returning stable JSON shapes with empty arrays and objects so tests can compile against real endpoints.

Use this response style:

```go
writeJSON(w, http.StatusOK, map[string]any{
	"cards": []any{},
})
```

- [ ] **Step 4: Run test to verify it still fails for content, not routing**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestDashboardSummaryReturnsCountsAndSeries|TestDashboardUsageReturnsSeries|TestDashboardActivityReturnsRecentLists|TestSearchReturnsGroupedResults|TestBackendDetailReturnsDrawerData|TestClientKeyDetailReturnsDrawerData|TestPolicyDetailReturnsDrawerData|TestProxyDetailReturnsDrawerData' -v
```

Expected:

- FAIL on missing fields, empty payloads, or assertion mismatches

- [ ] **Step 5: Commit**

```bash
git add internal/app/app.go internal/app/app_test.go
git commit -m "test: add failing admin presentation api coverage"
```

## Task 2: Implement dashboard aggregation and detail/search APIs

**Files:**
- Modify: `internal/app/app.go`
- Modify: `internal/store/store.go`
- Modify: `internal/domain/types.go`
- Test: `internal/app/app_test.go`

- [ ] **Step 1: Add store-level aggregation helpers**

Implement focused helpers in `internal/store/store.go` for:

- dashboard summary counts
- 7-day sparkline series
- usage time series by day or hour
- recent dashboard activity
- grouped search
- per-resource drawer detail lookups

Prefer dedicated functions such as:

```go
func (s *Store) DashboardUsageSeries(ctx context.Context, since time.Time, bucket string) ([]UsageSeriesPoint, error)
func (s *Store) SearchAdmin(ctx context.Context, q string, limit int) (AdminSearchResults, error)
func (s *Store) BackendDetail(ctx context.Context, id int64) (BackendDetail, error)
```

- [ ] **Step 2: Add minimal domain or app-local response structs**

In `internal/domain/types.go` or app-local structs, define stable JSON models for:

```go
type UsageSeriesPoint struct {
	Label       string  `json:"label"`
	Requests    int     `json:"requests"`
	TrafficBytes int64  `json:"traffic_bytes"`
	ErrorRate   float64 `json:"error_rate"`
}
```

Also define grouped search result structures and detail payloads for drawer tabs.

- [ ] **Step 3: Implement dashboard handlers**

In `internal/app/app.go`, implement:

- `handleDashboardSummary`
- `handleDashboardUsage`
- `handleDashboardActivity`

Register routes:

```go
a.mux.Handle("GET /admin/api/dashboard/summary", a.adminAuth(http.HandlerFunc(a.handleDashboardSummary)))
a.mux.Handle("GET /admin/api/dashboard/usage", a.adminAuth(http.HandlerFunc(a.handleDashboardUsage)))
a.mux.Handle("GET /admin/api/dashboard/activity", a.adminAuth(http.HandlerFunc(a.handleDashboardActivity)))
```

- [ ] **Step 4: Implement search and detail handlers**

Add:

- `GET /admin/api/search`
- `GET /admin/api/backends/{id}/detail`
- `GET /admin/api/client-keys/{id}/detail`
- `GET /admin/api/model-policies/{id}/detail`
- `GET /admin/api/socks-proxies/{id}/detail`

Each detail payload should contain:

- `overview`
- `configuration`
- `metadata`
- `raw`
- `activity`

- [ ] **Step 5: Run focused tests to verify they pass**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestDashboardSummaryReturnsCountsAndSeries|TestDashboardUsageReturnsSeries|TestDashboardActivityReturnsRecentLists|TestSearchReturnsGroupedResults|TestBackendDetailReturnsDrawerData|TestClientKeyDetailReturnsDrawerData|TestPolicyDetailReturnsDrawerData|TestProxyDetailReturnsDrawerData' -v
```

Expected:

- PASS

- [ ] **Step 6: Commit**

```bash
git add internal/app/app.go internal/app/app_test.go internal/store/store.go internal/domain/types.go
git commit -m "feat: add dashboard search and detail apis"
```

## Task 3: Add failing observability tests for usage stats, event summaries, and richer filters

**Files:**
- Modify: `internal/app/app_test.go`
- Test: `internal/app/app_test.go`

- [ ] **Step 1: Write failing tests for observability APIs**

Add tests for:

- `GET /admin/api/usage-logs/stats`
- `GET /admin/api/usage-logs/{id}`
- `GET /admin/api/events/summary`
- `GET /admin/api/events` with category and date filters

Test expectations should include:

- stable empty arrays
- stats totals and averages
- trace or metadata fields in usage log detail
- category counters in event summary

- [ ] **Step 2: Run the tests to verify failure**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestUsageLogStatsReturnsFilteredMetrics|TestUsageLogDetailReturnsPreviewData|TestEventSummaryReturnsCategoryCounts|TestEventsFilterByCategoryAndDateRange' -v
```

Expected:

- FAIL with missing routes or missing data assertions

- [ ] **Step 3: Add placeholder handlers and route registration**

Add route stubs in `internal/app/app.go` returning empty JSON shapes for the new endpoints.

- [ ] **Step 4: Re-run tests to ensure failures are content-related**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestUsageLogStatsReturnsFilteredMetrics|TestUsageLogDetailReturnsPreviewData|TestEventSummaryReturnsCategoryCounts|TestEventsFilterByCategoryAndDateRange' -v
```

Expected:

- FAIL on payload mismatches, not on 404

- [ ] **Step 5: Commit**

```bash
git add internal/app/app.go internal/app/app_test.go
git commit -m "test: add failing observability presentation coverage"
```

## Task 4: Implement observability APIs and log/event enrichments

**Files:**
- Modify: `internal/app/app.go`
- Modify: `internal/store/store.go`
- Modify: `internal/domain/types.go`
- Test: `internal/app/app_test.go`

- [ ] **Step 1: Extend usage log and event models where needed**

Add fields required for presentation:

- `trace_id`
- `policy_name`
- `proxy_name`
- `request_bytes`
- `response_bytes`
- event `category`
- event `severity`
- event `actor`

Only add persistence changes that are actually used by the UI in this phase.

- [ ] **Step 2: Add store queries for usage stats and detail**

Implement helpers in `internal/store/store.go` like:

```go
func (s *Store) UsageLogStats(ctx context.Context, filter UsageLogFilter) (UsageLogStats, error)
func (s *Store) GetUsageLog(ctx context.Context, id int64) (domain.UsageLog, error)
func (s *Store) EventSummary(ctx context.Context, filter EventFilter) (EventSummary, error)
```

- [ ] **Step 3: Implement HTTP handlers for stats and detail**

In `internal/app/app.go`, add:

- `handleUsageLogStats`
- `handleGetUsageLog`
- `handleEventSummary`

Register:

```go
a.mux.Handle("GET /admin/api/usage-logs/stats", a.adminAuth(http.HandlerFunc(a.handleUsageLogStats)))
a.mux.Handle("GET /admin/api/usage-logs/{id}", a.adminAuth(http.HandlerFunc(a.handleGetUsageLog)))
a.mux.Handle("GET /admin/api/events/summary", a.adminAuth(http.HandlerFunc(a.handleEventSummary)))
```

- [ ] **Step 4: Enhance existing list filters**

Update event and usage-log filter parsing to accept:

- `date_from`
- `date_to`
- `category`
- `status`
- `q`

Keep unsupported filters out until backed by real store logic.

- [ ] **Step 5: Run focused tests**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestUsageLogStatsReturnsFilteredMetrics|TestUsageLogDetailReturnsPreviewData|TestEventSummaryReturnsCategoryCounts|TestEventsFilterByCategoryAndDateRange|TestUsageLogDeleteFilteredAndClear|TestUsageLogOptionsListConfiguredBackendsModelsAndClientKeys' -v
```

Expected:

- PASS

- [ ] **Step 6: Commit**

```bash
git add internal/app/app.go internal/app/app_test.go internal/store/store.go internal/domain/types.go
git commit -m "feat: add observability summary and detail apis"
```

## Task 5: Add failing frontend checks for theme shell and modular rendering structure

**Files:**
- Modify: `internal/app/web/index.html`
- Modify: `internal/app/web/app.js`
- Modify: `internal/app/web/styles.css`
- Test: manual structural verification plus `node --check`

- [ ] **Step 1: Define the new shell markup targets**

Update `index.html` with placeholders for:

- collapsible sidebar
- top header with search
- theme toggle
- drawer root
- dashboard root cards
- search modal root

Add the nodes only, without fully styling them yet.

- [ ] **Step 2: Run frontend syntax validation**

Run:

```bash
node --check /root/workspace/token-gate/internal/app/web/app.js
```

Expected:

- PASS, because this task only changes HTML or safe JS references

- [ ] **Step 3: Add minimal JS state for theme, drawer, and search shell**

In `app.js`, add placeholder state keys and no-op render functions:

```js
state.ui = {
  theme: "light",
  drawer: { open: false, kind: "", id: null, tab: "overview" },
  search: { open: false, query: "", results: null },
};
```

- [ ] **Step 4: Re-run frontend syntax validation**

Run:

```bash
node --check /root/workspace/token-gate/internal/app/web/app.js
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add internal/app/web/index.html internal/app/web/app.js internal/app/web/styles.css
git commit -m "refactor: scaffold premium admin shell structure"
```

## Task 6: Implement theme system, shell layout, and global search interactions

**Files:**
- Modify: `internal/app/web/index.html`
- Modify: `internal/app/web/styles.css`
- Modify: `internal/app/web/app.js`
- Create or Modify: `internal/app/web/theme.js`
- Create or Modify: `internal/app/web/search.js`

- [ ] **Step 1: Implement dark and light semantic tokens**

In `styles.css`, replace the current theme variables with the semantic token system from the spec.

Add root selectors such as:

```css
:root[data-theme="light"] {
  --bg: #fafafa;
  --surface: #ffffff;
  --border: #e4e4e7;
  --text-primary: #09090b;
}

:root[data-theme="dark"] {
  --bg: #09090b;
  --surface: #18181b;
  --border: rgba(255,255,255,0.08);
  --text-primary: #fafafa;
}
```

- [ ] **Step 2: Implement theme persistence and toggle**

In `app.js` or `theme.js`, implement:

- default follow-system behavior
- local override storage
- root dataset updates
- toggle button state

- [ ] **Step 3: Replace the current shell with the new sidebar and header**

Update `index.html` to include:

- grouped sidebar navigation
- breadcrumb area
- centered global search
- notifications and profile buttons

Do not remove page IDs that current routing depends on until replacement logic is live.

- [ ] **Step 4: Implement command-k search modal**

Wire keyboard shortcuts:

- `Ctrl+K`
- `Cmd+K`
- `Escape`

Search flow:

- open modal
- debounce query
- call `/admin/api/search`
- render grouped results
- clicking a result navigates or opens a drawer target

- [ ] **Step 5: Run frontend syntax validation**

Run:

```bash
node --check /root/workspace/token-gate/internal/app/web/app.js
```

If split modules are added, also run:

```bash
node --check /root/workspace/token-gate/internal/app/web/theme.js
node --check /root/workspace/token-gate/internal/app/web/search.js
```

Expected:

- PASS

- [ ] **Step 6: Commit**

```bash
git add internal/app/web/index.html internal/app/web/styles.css internal/app/web/app.js internal/app/web/theme.js internal/app/web/search.js
git commit -m "feat: add premium shell theme and global search"
```

## Task 7: Implement dashboard cards, charts, and recent activity panels

**Files:**
- Modify: `internal/app/web/index.html`
- Modify: `internal/app/web/styles.css`
- Modify: `internal/app/web/app.js`
- Create or Modify: `internal/app/web/charts.js`

- [ ] **Step 1: Build the dashboard layout containers**

Add dashboard sections in `index.html` for:

- summary cards row
- usage overview chart card
- events summary card
- recent events card
- recent usage logs card

- [ ] **Step 2: Implement dashboard data loading**

In `app.js`, call:

- `/admin/api/dashboard/summary`
- `/admin/api/dashboard/usage?range=7d`
- `/admin/api/dashboard/activity`

Store the results separately from resource page state.

- [ ] **Step 3: Implement SVG chart rendering**

In `charts.js` or `app.js`, render:

- summary sparklines
- main usage area chart

Use lightweight SVG helpers rather than external chart libraries.

- [ ] **Step 4: Implement graceful loading and error states**

Each dashboard card or chart panel should independently handle:

- loading
- empty
- failed
- ready

- [ ] **Step 5: Run frontend syntax validation**

Run:

```bash
node --check /root/workspace/token-gate/internal/app/web/app.js
```

If split:

```bash
node --check /root/workspace/token-gate/internal/app/web/charts.js
```

Expected:

- PASS

- [ ] **Step 6: Commit**

```bash
git add internal/app/web/index.html internal/app/web/styles.css internal/app/web/app.js internal/app/web/charts.js
git commit -m "feat: add dashboard metrics charts and activity panels"
```

## Task 8: Implement shared list pages, expandable rows, and detail drawer

**Files:**
- Modify: `internal/app/web/index.html`
- Modify: `internal/app/web/styles.css`
- Modify: `internal/app/web/app.js`
- Create or Modify: `internal/app/web/drawer.js`
- Create or Modify: `internal/app/web/renderers.js`

- [ ] **Step 1: Convert resource pages to the shared premium list layout**

For:

- backends
- client keys
- policies
- proxies

Add:

- title block
- toolbar
- spacious list table
- inline expansion area
- row click behavior

- [ ] **Step 2: Implement row expansion state**

Keep first-column expand controls, but restyle and limit them to quick details:

- JSON preview excerpt
- relationships
- tags or metadata summary

- [ ] **Step 3: Implement drawer shell and tabs**

Build drawer state with:

```js
state.ui.drawer = {
  open: false,
  kind: "",
  id: null,
  tab: "overview",
  loading: false,
  data: null,
};
```

Drawer tabs:

- overview
- configuration
- metadata
- raw
- activity

- [ ] **Step 4: Wire resource detail endpoints into drawer rendering**

Open the correct endpoint per resource kind and render the tab payloads into the drawer.

- [ ] **Step 5: Run frontend syntax validation**

Run:

```bash
node --check /root/workspace/token-gate/internal/app/web/app.js
```

If split:

```bash
node --check /root/workspace/token-gate/internal/app/web/drawer.js
node --check /root/workspace/token-gate/internal/app/web/renderers.js
```

Expected:

- PASS

- [ ] **Step 6: Commit**

```bash
git add internal/app/web/index.html internal/app/web/styles.css internal/app/web/app.js internal/app/web/drawer.js internal/app/web/renderers.js
git commit -m "feat: add resource drawers and premium list pages"
```

## Task 9: Implement observability pages with stats, timeline, and drawer detail

**Files:**
- Modify: `internal/app/web/index.html`
- Modify: `internal/app/web/styles.css`
- Modify: `internal/app/web/app.js`

- [ ] **Step 1: Build the specialized usage logs layout**

Add to the usage logs page:

- full toolbar with filters
- stats summary strip
- premium observability table
- inline expand

- [ ] **Step 2: Load usage stats and detail**

Use:

- `/admin/api/usage-logs`
- `/admin/api/usage-logs/stats`
- `/admin/api/usage-log-options`
- `/admin/api/usage-logs/{id}`

Re-use the drawer shell for full usage log detail.

- [ ] **Step 3: Convert events into a timeline page**

Replace the current event table presentation with:

- timeline list
- icon and category markers
- right-side counters or summary panel

- [ ] **Step 4: Wire event summary and filters**

Use:

- `/admin/api/events`
- `/admin/api/events/summary`

Implement category, severity, and date filtering.

- [ ] **Step 5: Run frontend syntax validation**

Run:

```bash
node --check /root/workspace/token-gate/internal/app/web/app.js
```

Expected:

- PASS

- [ ] **Step 6: Run full backend verification**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app ./internal/store ./internal/scheduler ./internal/proxy
```

Expected:

- PASS

- [ ] **Step 7: Commit**

```bash
git add internal/app/web/index.html internal/app/web/styles.css internal/app/web/app.js
git commit -m "feat: add observability dashboard and timeline views"
```

## Task 10: Full verification and cleanup

**Files:**
- Modify: any touched files from previous tasks if small corrections are needed

- [ ] **Step 1: Review the implemented UI against the spec**

Check:

- dark and light themes
- sidebar hierarchy
- header search
- summary cards
- charts
- list toolbars
- drawers
- usage logs observability layout
- events timeline

- [ ] **Step 2: Run frontend syntax checks**

Run:

```bash
node --check /root/workspace/token-gate/internal/app/web/app.js
```

If split modules exist, run each of them as well.

Expected:

- PASS

- [ ] **Step 3: Run full Go test suite used by this project**

Run:

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app ./internal/store ./internal/scheduler ./internal/proxy
```

Expected:

- PASS

- [ ] **Step 4: Inspect git diff for accidental regressions**

Run:

```bash
git diff --stat
git status --short
```

Expected:

- only intentional UI and API changes remain

- [ ] **Step 5: Commit final polish**

```bash
git add .
git commit -m "feat: deliver ai proxy center admin redesign"
```

## Self-Review

### Spec coverage

Covered by this plan:

- dual theme shell
- premium sidebar and header
- dashboard cards and charts
- resource list redesign
- expandable rows
- detail drawer
- global search
- usage logs observability page
- events timeline
- lightweight backend aggregation APIs
- bulk filtered log deletion continuity

Potentially deferred but still covered within implementation tasks:

- optional preview fields for usage and response bodies are scoped as “only if actually used in UI”
- exact modular file split may vary, but modularization is explicitly required

### Placeholder scan

No `TODO`, `TBD`, or “implement later” placeholders are intentionally left in task steps. Each code step defines routes, state, or command expectations.

### Type consistency

The plan consistently uses:

- `/admin/api/dashboard/summary`
- `/admin/api/dashboard/usage`
- `/admin/api/dashboard/activity`
- `/admin/api/search`
- `/admin/api/usage-logs/stats`
- drawer tabs `overview`, `configuration`, `metadata`, `raw`, `activity`

These names should be preserved during implementation.
