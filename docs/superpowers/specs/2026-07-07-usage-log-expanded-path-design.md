# Usage Log Expanded Path Design

## Goal

Show the original request path in the expanded row of the Usage Logs table, for example `/v1/chat/completions`, `/v1/responses`, or `/v1/messages`.

## Scope

- Only the expanded row in the Usage Logs table changes.
- The main table columns do not change.
- No backend or API contract changes are required.

## Existing State

- Each usage log list item already includes the raw request path in `UsageLog.path`.
- The expanded row currently renders `Request ID`, `IP Address`, `User Agent`, and optional `Error`.
- The frontend already has a small UI test that checks which fields appear in the expanded row.

## Design

### Data Source

Use the existing `log.path` value from the usage log list payload.

### UI Placement

Add a new detail item in the expanded detail grid alongside the existing request metadata.

- Label: `Path:`
- Value: raw request path string such as `/v1/chat/completions`

The value should use the same monospace presentation as other machine-readable identifiers in the table, so the route is easy to scan visually.

### Behavior

- If `log.path` is present, render it exactly as received.
- If `log.path` is empty, render `N/A` to avoid a blank field.

## Alternatives Considered

### Fetch detail API on expand

Rejected because the list row already contains the needed data, and an extra request would add latency and UI state complexity without providing any benefit for this field.

### Add path as a top-level table column

Rejected because the request only calls for the expanded row, and a new column would make the table wider for every log entry.

## Testing

- Update the existing usage logs table UI test to assert that the expanded row includes the `Path:` label.
- Keep the existing assertions that token counts do not appear in the expanded row.

## Risks

- Very low risk. The change is frontend-only and reuses existing list data.
