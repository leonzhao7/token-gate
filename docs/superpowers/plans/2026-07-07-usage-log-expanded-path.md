# Usage Log Expanded Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the original request path only in the expanded row of the Usage Logs table.

**Architecture:** Reuse the existing `UsageLog.path` field already returned by the usage log list API. Update the Vue table component to render the path in the expanded detail grid and extend the existing UI text test to cover the new field.

**Tech Stack:** Vue 3 SFCs, TypeScript, Node test runner

---

### Task 1: Add Path To Expanded Usage Log Details

**Files:**
- Modify: `frontend/src/components/usageLogs/UsageLogsTable.vue`
- Test: `frontend/src/components/usageLogs/usageLogsTableUi.test.mjs`

- [ ] **Step 1: Write the failing test**

Add an assertion to `frontend/src/components/usageLogs/usageLogsTableUi.test.mjs` that the expanded row template contains the `Path:` label.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/src/components/usageLogs/usageLogsTableUi.test.mjs`
Expected: FAIL because the template does not yet render `Path:`.

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/components/usageLogs/UsageLogsTable.vue`, add a new expanded-row detail item:

```vue
<div class="detail-item">
  <span class="detail-label">Path:</span>
  <code class="detail-value detail-code">{{ log.path || 'N/A' }}</code>
</div>
```

Add a small style for `.detail-code` so the path uses monospace and wraps safely.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/src/components/usageLogs/usageLogsTableUi.test.mjs`
Expected: PASS

- [ ] **Step 5: Run broader frontend verification**

Run: `node --test frontend/src/api/*.test.mjs frontend/src/components/backends/*.test.mjs frontend/src/components/usageLogs/*.test.mjs frontend/src/utils/*.test.ts frontend/src/pages/*.test.ts`
Expected: PASS or no matching tests for paths without test files
