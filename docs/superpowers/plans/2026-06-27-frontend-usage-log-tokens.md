# Frontend Usage Log Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `Tokens` column to the Vue `frontend/` Usage Logs table and show input/cache/output token details in the expanded row without changing backend APIs or adding frontend tests.

**Architecture:** Keep the change local to the existing Vue data flow. Extend the shared `UsageLog` type in `frontend/src/api/types.ts`, then render the new token summary and expanded token detail inside `frontend/src/components/usageLogs/UsageLogsTable.vue` using small formatting helpers. Verification stays lightweight with `npm run build:check`, per the user's instruction not to add frontend tests for this small feature.

**Tech Stack:** Vue 3 SFCs, TypeScript, Vite, `vue-tsc`

---

## File Structure

- Modify: `frontend/src/api/types.ts`
  - Add the three token fields to the `UsageLog` interface so the table can read backend data safely.
- Modify: `frontend/src/components/usageLogs/UsageLogsTable.vue`
  - Add the `Tokens` column, render compact token summaries in the main row, render token details in the expanded row, and add a token-specific formatter.

### Task 1: Align Usage Log Types

**Files:**
- Modify: `frontend/src/api/types.ts`

- [ ] **Step 1: Run the current frontend type/build check as a baseline**

Run:

```bash
cd frontend && npm run build:check
```

Expected:

- PASS
- Confirms the current frontend compiles before any edits

- [ ] **Step 2: Extend the `UsageLog` interface with token fields**

Update `frontend/src/api/types.ts` so the interface includes:

```ts
export interface UsageLog {
  id: number
  request_id: string
  client_id: number
  client_name?: string
  client_token_prefix?: string
  client_key_id?: number
  client_key_name?: string
  method: string
  path: string
  query?: string
  endpoint: string
  model: string
  backend_id: number | null
  backend_name?: string
  proxy_id?: number | null
  proxy_name?: string
  status_code: number
  status_family?: string
  duration_ms: number
  latency_ms?: number
  request_bytes?: number
  response_bytes?: number
  input_tokens?: number
  input_cache_tokens?: number
  output_tokens?: number
  request_body_preview?: string
  response_body_preview?: string
  request_headers_json?: string
  response_headers_json?: string
  is_stream?: boolean
  attempts?: number
  trace_id?: string
  error_message?: string
  client_ip?: string
  ip_address?: string
  user_agent?: string
  preview_truncated?: boolean
  created_at: string
}
```

- [ ] **Step 3: Re-run frontend type/build check**

Run:

```bash
cd frontend && npm run build:check
```

Expected:

- PASS
- Confirms the type update did not break imports or strict TypeScript checks

- [ ] **Step 4: Commit the type-only change**

```bash
git add frontend/src/api/types.ts
git commit -m "feat(frontend): add usage log token fields"
```

### Task 2: Add the Tokens Column and Expanded Token Details

**Files:**
- Modify: `frontend/src/components/usageLogs/UsageLogsTable.vue`

- [ ] **Step 1: Add the new `Tokens` header and widen the expanded row colspan**

Update the table header and expanded row shell in `frontend/src/components/usageLogs/UsageLogsTable.vue`:

```vue
<thead>
  <tr>
    <th></th>
    <th>Time</th>
    <th>Client</th>
    <th>Model</th>
    <th>Backend</th>
    <th>Status</th>
    <th>Latency</th>
    <th>Tokens</th>
    <th>Bytes</th>
  </tr>
</thead>
```

```vue
<tr v-if="expandedRows.has(log.id)" class="expanded-row">
  <td colspan="9">
```

- [ ] **Step 2: Render the compact token summary in the main row**

Insert the new cell between `Latency` and `Bytes`:

```vue
<td>
  <div class="tokens-cell">
    <span class="token-count">{{ formatTokenCount(log.input_tokens) }}</span>
    <span class="token-detail">
      Cache {{ formatTokenCount(log.input_cache_tokens) }} · Out {{ formatTokenCount(log.output_tokens) }}
    </span>
  </div>
</td>
```

- [ ] **Step 3: Render the expanded token detail items**

Add these items inside the existing `detail-grid` before the optional error block:

```vue
<div class="detail-item">
  <span class="detail-label">Input Tokens:</span>
  <span class="detail-value">{{ formatTokenCount(log.input_tokens) }}</span>
</div>
<div class="detail-item">
  <span class="detail-label">Cache Tokens:</span>
  <span class="detail-value">{{ formatTokenCount(log.input_cache_tokens) }}</span>
</div>
<div class="detail-item">
  <span class="detail-label">Output Tokens:</span>
  <span class="detail-value">{{ formatTokenCount(log.output_tokens) }}</span>
</div>
```

- [ ] **Step 4: Add a token-specific formatter**

Add this helper in the `<script setup lang="ts">` block near `formatBytes`:

```ts
const formatTokenCount = (value?: number): string => {
  const count = Number(value ?? 0)
  if (!Number.isFinite(count) || count <= 0) return '0'
  if (count < 1000) return String(Math.round(count))
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`
  return `${(count / 1_000_000).toFixed(1)}M`
}
```

- [ ] **Step 5: Add small layout styles for the new token cell if needed**

Keep the existing stacked cell pattern and only tighten it where needed:

```css
.tokens-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 136px;
}

.token-count {
  font-weight: 600;
}

.token-detail {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}
```

If a token-specific class already exists, update it instead of duplicating styles.

- [ ] **Step 6: Run frontend build verification**

Run:

```bash
cd frontend && npm run build:check
```

Expected:

- PASS
- Confirms the SFC template, styles, and TypeScript all compile after the UI change

- [ ] **Step 7: Commit the table rendering change**

```bash
git add frontend/src/components/usageLogs/UsageLogsTable.vue
git commit -m "feat(frontend): show usage log token metrics"
```

### Task 3: Final Verification

**Files:**
- No code changes

- [ ] **Step 1: Run the final frontend verification again from a clean index**

Run:

```bash
cd frontend && npm run build:check
```

Expected:

- PASS

- [ ] **Step 2: Capture the final git status**

Run:

```bash
git status --short
```

Expected:

- No unexpected modified files beyond the planned frontend files if commits were not skipped
- Clean worktree if both commit steps were executed exactly as written
