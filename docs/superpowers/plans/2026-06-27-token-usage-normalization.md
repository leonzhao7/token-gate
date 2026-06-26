# Token Usage Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record normalized `input_tokens`, `output_tokens`, and `input_cache_tokens` for Anthropic and OpenAI responses in both `usage_logs` and `backend_hourly_model_stats`, then expose those values through admin APIs.

**Architecture:** Keep normalization close to the existing response logging flow in `internal/app/app.go` so JSON and SSE responses share one extraction path. Persist the normalized values on `domain.UsageLog`, migrate SQLite tables inline in `internal/store/store.go`, and accumulate successful hourly token totals in `backend_hourly_model_stats`.

**Tech Stack:** Go, `net/http`, `database/sql`, SQLite, standard library JSON parsing, Go tests.

---

### Task 1: Add failing persistence and API tests

**Files:**
- Modify: `internal/store/store_test.go`
- Modify: `internal/app/app_test.go`

- [ ] **Step 1: Write the failing store aggregation test**

```go
func TestAppendUsageLogAggregatesHourlyTokenUsage(t *testing.T) {
	st := openTestStore(t)
	defer st.Close()
	ctx := context.Background()
	createdAt := time.Date(2026, 6, 27, 7, 10, 0, 0, time.UTC)

	for _, entry := range []domain.UsageLog{
		{
			RequestID:        "agg-success",
			BackendID:        11,
			BackendName:      "alpha",
			Model:            "gpt-4o",
			StatusCode:       200,
			InputTokens:      100,
			OutputTokens:     25,
			InputCacheTokens: 40,
			CreatedAt:        createdAt,
		},
		{
			RequestID:        "agg-failure",
			BackendID:        11,
			BackendName:      "alpha",
			Model:            "gpt-4o",
			StatusCode:       502,
			InputTokens:      999,
			OutputTokens:     999,
			InputCacheTokens: 999,
			CreatedAt:        createdAt.Add(5 * time.Minute),
		},
	} {
		if err := st.AppendUsageLog(ctx, entry); err != nil {
			t.Fatalf("AppendUsageLog(%s): %v", entry.RequestID, err)
		}
	}

	result, err := st.ListBackendHourlyModelStats(ctx, BackendHourlyModelStatsFilter{
		BackendName: "alpha",
		Model:       "gpt-4o",
	})
	if err != nil {
		t.Fatalf("ListBackendHourlyModelStats: %v", err)
	}
	row := result.Rows[0]
	if row.SuccessInputTokens != 100 || row.SuccessOutputTokens != 25 || row.SuccessInputCacheTokens != 40 {
		t.Fatalf("unexpected hourly token sums: %#v", row)
	}
}
```

- [ ] **Step 2: Run the targeted store test to verify it fails**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run TestAppendUsageLogAggregatesHourlyTokenUsage`

Expected: FAIL because the token fields do not exist yet.

- [ ] **Step 3: Write failing app-level normalization/API tests**

```go
func TestUsageLogsRecordAnthropicResponseTokenUsage(t *testing.T) {}
func TestUsageLogsRecordOpenAIStreamingResponseTokenUsage(t *testing.T) {}
func TestUsageLogsRecordAnthropicStreamingResponseTokenUsage(t *testing.T) {}
func TestBackendHourlyModelStatsEndpointReturnsTokenSums(t *testing.T) {}
func TestUsageLogDetailReturnsTokenUsage(t *testing.T) {}
```

The new assertions should verify:
- Anthropic JSON: `input_tokens == input_tokens + cache_creation_input_tokens`, `input_cache_tokens == cache_creation_input_tokens`
- OpenAI streaming: `input_tokens == usage.input_tokens`, `input_cache_tokens == usage.input_tokens_details.cached_tokens`
- Anthropic streaming: final aggregated fields survive across `message_start` + later deltas
- Usage log detail and hourly stats API include the new JSON fields

- [ ] **Step 4: Run the targeted app tests to verify they fail**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestUsageLogsRecordAnthropicResponseTokenUsage|TestUsageLogsRecordOpenAIStreamingResponseTokenUsage|TestUsageLogsRecordAnthropicStreamingResponseTokenUsage|TestBackendHourlyModelStatsEndpointReturnsTokenSums|TestUsageLogDetailReturnsTokenUsage'`

Expected: FAIL because normalized token extraction and API fields are not implemented.

### Task 2: Persist normalized token fields

**Files:**
- Modify: `internal/domain/types.go`
- Modify: `internal/store/store.go`

- [ ] **Step 1: Add token fields to domain and hourly row types**

```go
type UsageLog struct {
	InputTokens      int64 `json:"input_tokens"`
	OutputTokens     int64 `json:"output_tokens"`
	InputCacheTokens int64 `json:"input_cache_tokens"`
}

type BackendHourlyModelStatsRow struct {
	SuccessInputTokens      int64
	SuccessOutputTokens     int64
	SuccessInputCacheTokens int64
}
```

- [ ] **Step 2: Add SQLite schema columns and compatibility migrations**

Add `INTEGER NOT NULL DEFAULT 0` columns to:
- `usage_logs.input_tokens`
- `usage_logs.output_tokens`
- `usage_logs.input_cache_tokens`
- `backend_hourly_model_stats.success_input_tokens_sum`
- `backend_hourly_model_stats.success_output_tokens_sum`
- `backend_hourly_model_stats.success_input_cache_tokens_sum`

- [ ] **Step 3: Wire insert, scan, and hourly upsert logic**

Update:
- `AppendUsageLog`
- `scanUsageLog`
- every `SELECT ... FROM usage_logs`
- `ListBackendHourlyModelStats`
- `upsertBackendHourlyModelStats`

Hourly aggregation rule:
- success rows add token sums
- failure rows add zero token sums

- [ ] **Step 4: Run targeted store tests to verify they pass**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store -run 'TestAppendUsageLogAggregatesHourlyTokenUsage|TestListBackendHourlyModelStats'`

Expected: PASS

### Task 3: Normalize Anthropic/OpenAI usage from buffered responses

**Files:**
- Modify: `internal/app/app.go`

- [ ] **Step 1: Add a focused normalization helper and usage extractor tests by driving app tests**

Implement helpers that:
- parse JSON response bodies
- parse SSE event streams
- detect top-level `usage` and `response.usage`
- normalize provider-specific cache fields to one shape

Recommended helper surface:

```go
type normalizedTokenUsage struct {
	InputTokens      int64
	OutputTokens     int64
	InputCacheTokens int64
}

func extractNormalizedTokenUsage(resp *http.Response, body []byte) normalizedTokenUsage
```

- [ ] **Step 2: Apply normalized usage during response logging**

Extend `applyResponseLogFields` to set:

```go
usage := extractNormalizedTokenUsage(resp, responseBody)
log.InputTokens = usage.InputTokens
log.OutputTokens = usage.OutputTokens
log.InputCacheTokens = usage.InputCacheTokens
```

Normalization rules:
- Anthropic JSON/SSE:
  - `input_cache_tokens = cache_creation_input_tokens + cache_read_input_tokens`
  - `input_tokens = input_tokens + input_cache_tokens`
- OpenAI JSON/SSE:
  - `input_cache_tokens = input_tokens_details.cached_tokens`
  - `input_tokens = usage.input_tokens`
- Missing fields default to `0`

- [ ] **Step 3: Run targeted app tests to verify they pass**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestUsageLogsRecordAnthropicResponseTokenUsage|TestUsageLogsRecordOpenAIStreamingResponseTokenUsage|TestUsageLogsRecordAnthropicStreamingResponseTokenUsage'`

Expected: PASS

### Task 4: Expose token fields in admin APIs

**Files:**
- Modify: `internal/app/app.go`
- Modify: `internal/app/app_test.go`

- [ ] **Step 1: Extend hourly stats API response**

Add item JSON fields:

```go
InputTokens      int64 `json:"input_tokens"`
OutputTokens     int64 `json:"output_tokens"`
InputCacheTokens int64 `json:"input_cache_tokens"`
```

- [ ] **Step 2: Extend usage log detail response**

Add token fields to:
- `overview` or `response` payload sections for direct consumption
- `raw` via `domain.UsageLog`

- [ ] **Step 3: Run targeted API tests to verify they pass**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/app -run 'TestBackendHourlyModelStatsEndpointReturnsTokenSums|TestUsageLogDetailReturnsTokenUsage|TestUsageLogListAndPagination'`

Expected: PASS

### Task 5: Full verification

**Files:**
- No code changes

- [ ] **Step 1: Run store and app packages**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./internal/store ./internal/app`

Expected: PASS

- [ ] **Step 2: Run full Go suite**

Run: `GOCACHE=/root/workspace/token-gate/.gocache go test ./...`

Expected: PASS

- [ ] **Step 3: Run frontend test suite for regression coverage**

Run: `node --test internal/app/web/*.test.mjs`

Expected: PASS
