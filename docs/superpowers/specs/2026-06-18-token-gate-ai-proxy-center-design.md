# Token Gate - AI Proxy Center Design

Date: 2026-06-18

## Overview

This spec defines a full redesign of the Token Gate admin console into a premium SaaS control plane named `Token Gate - AI Proxy Center`.

The product goal is to manage and observe:

- Backends
- Client Keys
- Policies
- Proxies
- Usage Logs
- Events

The target experience is visually and behaviorally closer to Vercel Dashboard, Stripe Dashboard, Linear, and the OpenAI Platform than to a generic admin template.

This redesign will keep the current architecture:

- Go backend
- Server-rendered static admin assets
- Vanilla HTML, CSS, and JavaScript frontend

It will not introduce React, Next.js, Tailwind CSS, shadcn/ui, or TanStack Table. Those products remain visual references only.

## Product Goals

The redesigned console must:

- Feel like a polished unicorn startup developer tool
- Support both dark and light themes
- Present a clear product shell with sidebar, header, dashboard, resource pages, observability pages, and detail drawers
- Upgrade current interactions with global search, richer list toolbars, charts, expandable rows, and right-side drawers
- Add lightweight backend aggregation and detail APIs so the UI is real and operational, not cosmetic

The redesign must avoid:

- Ant Design Pro style
- Bootstrap style
- Material Design style
- Generic enterprise admin visuals
- Dense, spreadsheet-like tables

## Visual Direction

### Brand Positioning

Token Gate should feel like an infrastructure control plane for AI traffic rather than a CRUD panel.

Visual keywords:

- Modern
- Premium
- Elegant
- Developer Tool
- Minimal
- Enterprise SaaS
- Professional
- Clean Information Hierarchy

### Theme System

The console supports both dark and light themes.

Theme switching rules:

- Default follows system preference
- Manual override is stored locally
- Theme is applied via a root attribute such as `data-theme="dark"` or `data-theme="light"`
- All surfaces, charts, badges, inputs, drawers, tables, and overlays use the same semantic token system

#### Dark Theme

- Background: `#09090B`
- Surface: `#18181B`
- Surface Hover: `#202024`
- Border: `rgba(255,255,255,0.08)`
- Text Primary: `#FAFAFA`
- Text Secondary: `#A1A1AA`
- Primary: `#3B82F6`
- Success: `#22C55E`
- Warning: `#F59E0B`
- Danger: `#EF4444`

#### Light Theme

- Background: `#FAFAFA`
- Surface: `#FFFFFF`
- Surface Hover: `#F4F4F5`
- Border: `#E4E4E7`
- Text Primary: `#09090B`
- Text Secondary: `#71717A`
- Primary: `#2563EB`
- Success: `#16A34A`
- Warning: `#D97706`
- Danger: `#DC2626`

### Semantic Tokens

In addition to the required palette, the implementation should define semantic UI tokens:

- `--bg`
- `--surface`
- `--surface-muted`
- `--surface-strong`
- `--surface-hover`
- `--border`
- `--overlay`
- `--text-primary`
- `--text-secondary`
- `--primary`
- `--success`
- `--warning`
- `--danger`

These tokens are required so layout hierarchy can feel layered and premium without overusing gradients.

### Typography

Primary font:

- `Geist`

Fallback chain:

- `Inter`
- `PingFang SC`
- `Microsoft YaHei`
- `sans-serif`

Type scale:

- Page Title: `32px`, `600`
- Section Title: `20px`, `600`
- Metric Value: `28px` to `32px`, `600`
- Body: `14px`
- Caption: `12px`

Typography rules:

- Keep titles short and product-like
- Use secondary text for context and metadata
- Use strong hierarchy for counts, statuses, and timings
- Avoid all-caps heavy admin styling

## Layout System

### Frame

- Desktop target: `1440 x 1024`
- 12-column layout grid
- Outer margins: `32px`
- Gutter: `24px`
- Base spacing: `8px`

### App Shell

- Sidebar width: `240px`
- Sidebar collapsed width: `72px`
- Header height: `72px`
- Content padding: `32px`
- Card radius: `20px`
- Input radius: `12px`
- Button radius: `12px`
- Drawer radius: `24px`

### Sidebar

Top section:

- Logo icon
- Product name: `Token Gate`
- Product subtitle: `AI Proxy Center`

Navigation structure:

- Dashboard
- Resources
  - Backends
  - Client Keys
  - Policies
  - Proxies
- Observability
  - Usage Logs
  - Events
- Settings

Sidebar interactions:

- Active item uses a blue indicator bar, not a filled block
- Supports collapsed state
- Collapsed state shows icons only
- Hover on collapsed items shows labels

### Header

Header structure:

- Left: breadcrumb
- Center: global search field, width `480px`
- Right: theme toggle, notifications, profile menu

Global search placeholder:

- `Search backends, keys, policies...`

### Motion

Interaction timings:

- Card hover lift: `translateY(-2px)` over `200ms`
- Button scale: `1.02`
- Drawer slide-in: `250ms`
- Theme transitions: `150ms` to `200ms`

## Information Architecture

### Primary Sections

The UI is split into:

- Dashboard
- Resource management pages
- Observability pages
- Settings

### Dashboard

Dashboard acts as an operational home page, not just an index of admin links.

Page title:

- `Dashboard`

Subtitle:

- `Monitor infrastructure, access credentials, routing policies, and traffic usage.`

#### Row 1: Summary Cards

Four summary cards:

- Backends
- Client Keys
- Policies
- Proxies

Each card contains:

- Large count
- Growth percentage
- Status summary
- Mini sparkline

#### Row 2: Usage and Events

Left section:

- Usage Overview
- Width target: 8 columns
- Height target: `360px`
- Area chart with tabs or metric switch:
  - Daily Requests
  - Daily Traffic
  - Error Rate

Right section:

- Events Summary
- Width target: 4 columns
- Height target: `360px`
- Summary blocks:
  - Warnings
  - Errors
  - Policy Changes
  - Key Creations
  - Backend Updates

#### Row 3: Recent Activity

Two side-by-side cards:

- Recent Events
- Recent Usage Logs

Target height:

- `320px`

### Resource Pages

Pages:

- Backends
- Client Keys
- Policies
- Proxies

All resource pages share the same page frame:

- Page title and description
- Toolbar
- Non-dense data list/table
- Expandable rows
- Right-side detail drawer

### Resource Page Toolbar

Toolbar height:

- `64px`

Toolbar actions:

- Search
- Filters
- Sort
- Refresh
- Create

### Resource Lists

Design target:

- Modern Stripe-style data presentation
- Not dense
- Row height `56px`

Base columns:

- Name
- Type
- Status
- Created
- Updated
- Actions

Each row supports:

- Expand icon in the first column
- Inline row expansion for quick details
- Row click to open the right-side drawer

### Usage Logs

Usage Logs uses a specialized observability layout inspired by Stripe and Datadog.

Toolbar filters:

- Full-text search
- Date range
- Backend
- Client Key
- Policy
- Proxy
- Status

Additional actions:

- Refresh
- Delete filtered
- Clear all

Table columns:

- Timestamp
- Method
- Path
- Status
- Latency
- Client Key
- Backend
- Proxy
- Trace ID

Status badges:

- 2xx green
- 3xx blue
- 4xx orange
- 5xx red

Usage log expansion should expose:

- Request metadata
- Headers
- Payload preview
- Response preview
- Trace ID

### Events

Events uses a Linear-like timeline rather than a normal table.

Each event item shows:

- Icon
- Title
- Description
- Actor
- Timestamp
- Category

Event categories:

- System
- Backend
- Policy
- Proxy
- Client Key
- Security

## Detail Drawer Model

Each resource row opens a right-side drawer.

Drawer properties:

- Width: `720px`
- Radius: `24px`
- Slide from right
- Sticky footer

Drawer tabs:

- Overview
- Configuration
- Metadata
- Raw JSON
- Activity

Sticky footer actions:

- Edit
- Delete
- Save

Drawer behavior:

- ESC closes
- Backdrop click closes
- Opening a drawer does not navigate away from the list
- Inline expansion remains available for quick inspection, but the drawer is the full detail surface

## Page-Specific Data Presentation

### Backends

Primary fields:

- Name
- Endpoint URL
- Routing or recent-traffic state
- Region
- Connection count
- Created time

Additional UI detail:

- Protocol
- Model count
- Proxy relation
- Recent 30-minute success/failure summary
- Model mapping

### Client Keys

Primary fields:

- Name
- Masked key
- Permissions or route characteristics
- Usage count
- Last used
- Expiration

Additional UI detail:

- Route override
- Route group
- Audit info

### Policies

Primary fields:

- Name or pattern
- Type
- Priority
- Rule count or match summary
- Enabled state

Additional UI detail:

- Endpoint
- Placement
- Backend pool
- Failover behavior

### Proxies

Primary fields:

- Name
- Target or relation summary
- Policy relation
- Status
- Traffic
- Latency

Additional UI detail:

- Auth mode
- Bound backends
- Recent activity

## Backend API Additions

The frontend should not compute all presentation data by stitching many raw CRUD endpoints together. The backend will expose lightweight presentation APIs.

### Dashboard APIs

- `GET /admin/api/dashboard/summary`
- `GET /admin/api/dashboard/usage?range=24h|7d|30d`
- `GET /admin/api/dashboard/activity`

`dashboard/summary` returns:

- Card counts
- Growth percentages
- Status summaries
- 7-day sparkline series

`dashboard/usage` returns:

- Time series points
- Requests
- Traffic bytes
- Error rate

`dashboard/activity` returns:

- Recent events
- Recent usage logs
- Event category summary

### Global Search API

- `GET /admin/api/search?q=...&limit=...`

Grouped response sections:

- backends
- client_keys
- policies
- proxies
- usage_logs
- events

Each result contains:

- `kind`
- `id`
- `title`
- `subtitle`
- `meta`
- `status`
- `target_page`
- `target_id`

Initial implementation uses lightweight SQLite matching:

- exact match priority
- prefix or partial `LIKE`
- name-first ranking
- recency tie-breaks

### Resource Detail APIs

Dedicated drawer detail endpoints:

- `GET /admin/api/backends/{id}/detail`
- `GET /admin/api/client-keys/{id}/detail`
- `GET /admin/api/model-policies/{id}/detail`
- `GET /admin/api/socks-proxies/{id}/detail`

Each detail endpoint returns:

- `overview`
- `configuration`
- `metadata`
- `raw`
- `activity`

This is intentionally tab-shaped so the drawer can render directly from API data.

### Usage Log APIs

Keep:

- `GET /admin/api/usage-logs`

Add:

- `GET /admin/api/usage-logs/stats?...filters`
- `GET /admin/api/usage-logs/{id}`
- `GET /admin/api/usage-log-options`

Supported list filters:

- `q`
- `date_from`
- `date_to`
- `backend`
- `client_key`
- `policy`
- `proxy`
- `status`
- `page`
- `limit`
- `sort`

`usage-log-options` returns configured filter suggestions:

- backends
- models
- client keys

These values may be selected from suggestions or entered manually.

Bulk log actions:

- `DELETE /admin/api/usage-logs` without filters clears all logs
- `DELETE /admin/api/usage-logs` with filters deletes the matching result set

### Events APIs

Keep and enhance:

- `GET /admin/api/events`

Add:

- `GET /admin/api/events/summary`

Events must support:

- category filter
- severity filter
- actor filter
- backend or related resource filters
- date range

## Data Model Additions

### Usage Logs

Recommended new fields:

- `policy_id`
- `policy_name`
- `proxy_id`
- `proxy_name`
- `trace_id`
- `request_bytes`
- `response_bytes`
- `status_family`
- optional request preview fields
- optional response preview fields

Recommended preview fields:

- `request_headers_json`
- `request_body_preview`
- `response_headers_json`
- `response_body_preview`
- `preview_truncated`
- `is_stream`

### Audit Events

Recommended new fields:

- `actor`
- `resource_type`
- `resource_id`
- `category`
- `severity`

These additions improve timeline rendering, search, and drawer activity tabs.

## Logging and Preview Capture Strategy

Usage log retention should support premium observability UI without turning the database into a full packet archive.

Required behavior:

- Always store structured request and response metadata
- Store body previews, not unlimited raw bodies
- Mark large bodies as truncated
- For streaming responses, keep metadata and optional prefix preview only
- Redact sensitive headers such as:
  - `authorization`
  - `api-key`
  - `cookie`

Preview storage guidance:

- text preview cap around `16KB`
- binary data should not be stored as raw body text

The UI must clearly label:

- preview only
- streamed
- truncated

## Frontend Implementation Structure

Although the admin UI remains vanilla, the frontend should no longer stay as one large file-oriented script.

Recommended structure:

- `shell`
  - sidebar
  - header
  - theme manager
  - global search
  - drawer
- `pages`
  - dashboard
  - backends
  - client keys
  - policies
  - proxies
  - usage logs
  - events
- `components`
  - cards
  - toolbars
  - lists
  - table rows
  - timeline
  - charts
  - filters
  - badges
- `services/state`
  - api client
  - page state
  - drawer state
  - search state
  - theme persistence

The exact file split can be adapted to the current repository, but the implementation must reduce the current monolithic frontend structure.

## Accessibility and UX Rules

The redesign must remain practical and keyboard-friendly.

Rules:

- Clear focus states for all interactive elements
- Sidebar, search, drawer, and list rows must be keyboard accessible
- Color alone must not carry status meaning
- Empty states should be page-specific, not generic
- Failed dashboard cards or panels should degrade locally, not take down the whole page
- Drawer load failures should not break list pages
- Destructive actions require confirmation
- Bulk delete feedback should clearly state how many logs were deleted and whether filters were used

## Testing Strategy

### Backend Tests

Required coverage:

- dashboard summary aggregation
- dashboard usage time series
- dashboard activity aggregation
- global search ranking and grouping
- drawer detail APIs
- usage log stats
- filtered usage log deletion
- usage log preview fields
- event summary and filters
- empty arrays for no-data cases
- pagination and time-range edges

### Frontend Verification

Required validation:

- theme toggle persistence
- drawer open and close behavior
- global search result navigation
- usage log filters and delete-filtered flow
- timeline filters
- dashboard metric switching
- sidebar active-state routing

Minimum tool checks:

- `go test` for backend coverage
- `node --check` for frontend script syntax

## Delivery Plan

Implementation should be broken into four phases.

### Phase 1: App Shell

- Theme system
- New sidebar
- New header
- Global search shell
- Shared page layout
- Drawer shell

### Phase 2: Dashboard and Shared Components

- Summary cards
- Usage chart
- Events summary
- Recent events and recent usage logs
- Shared toolbars
- Shared badges
- Shared list and card primitives

### Phase 3: Resource Pages

- Backends
- Client Keys
- Policies
- Proxies
- Expandable rows
- Detail drawers
- Search, filters, sort, refresh

### Phase 4: Observability

- Usage Logs dedicated page
- Events timeline page
- Drawer deep detail for logs and events
- Bulk filtered actions
- Preview, trace, and stats presentation

## Risks and Constraints

Primary risks:

- Vanilla JS state complexity increases as interactions become richer
- If frontend code is not modularized, future maintenance cost will rise sharply
- Charts, global search, and drawer tabs need lightweight backend aggregation support
- Usage log preview storage must be controlled for size and sensitivity
- Rebuilding all pages in one pass would create high regression risk

Mitigation:

- Deliver in phased slices
- Keep old CRUD semantics where possible
- Introduce presentation APIs instead of overloading raw list endpoints
- Cap preview storage and redact secrets
- Keep each phase independently testable and committable

## Recommendation

Proceed with implementation in the following order:

1. App shell and theming
2. Dashboard and shared components
3. Resource page redesign
4. Observability page redesign

This order gives a visible product-quality shell early while controlling regression risk and keeping the implementation testable.
