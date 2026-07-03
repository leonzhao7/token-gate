# New API Backend Console Design

## Goal

Add manual backend console operations for `new-api` relay stations without changing public request routing or scheduler behavior.

## Scope

Backend records gain console-account state:

- `backend_type`: backend console integration type. The only implemented value is `new-api`.
- `console_cookie`: editable cookie string used for console API calls.
- `console_account_json`: JSON object containing the saved `/api/user/self` balance summary: `username`, `id`, `quota`, and `used_quota`.
- `console_pricing_json`: JSON object containing the complete `/api/pricing` model plaza response.

These fields are separate from existing `models`, `model_mapping`, and `endpoint_list`. The pricing response never feeds scheduler candidate selection.

## Admin Actions

The static admin UI exposes only two buttons on backend rows:

- Check in
- Model plaza

The check-in action is server-side and executes this sequence:

1. `POST {console_url}/api/user/checkin` with the saved `console_cookie`.
2. If the response indicates the cookie is not logged in, call `POST {console_url}/api/user/login` with body `{"username":"<console_username>","password":"<console_password>"}`.
3. On successful login, extract the `session` cookie from `Set-Cookie`, merge it into `console_cookie`, and persist it.
4. Retry `POST {console_url}/api/user/checkin` with the updated cookie.
5. Call `GET {console_url}/api/user/self`, extract `username`, `id`, `quota`, and `used_quota`, and persist that object in `console_account_json`.

The model plaza action executes:

1. `GET {console_url}/api/pricing`.
2. Persist the complete JSON response in `console_pricing_json`.

The implementation does not call `/api/user/models` or `/api/models`.

## API Shape

Add admin endpoints:

- `POST /admin/api/backends/{id}/console/checkin`
- `POST /admin/api/backends/{id}/console/pricing`

Both endpoints require `backend_type == "new-api"` and a valid `console_url`. Check-in also requires username/password if login is needed.

Responses return the updated backend plus the upstream action result summary. Stored secrets are still masked in backend detail payloads where existing code masks secrets.

## Persistence And Compatibility

SQLite schema is managed inline in `store.Open`. New columns are created in the base `backends` table definition and added through compatibility migrations for legacy local databases.

Backend create, update, import, export, list, detail, proxy detail, and scan helpers are updated to include the new fields.

## Testing

Backend tests cover:

- Create/update/list round-trip for new console fields.
- Legacy backend table migration creates the new columns.
- Check-in with a valid cookie calls checkin then self and saves the account JSON.
- Check-in with an expired cookie logs in, saves `session`, retries checkin, and saves account JSON.
- Pricing action saves the full `/api/pricing` JSON and does not touch scheduler model fields.

Frontend tests cover:

- Backend form payload includes `backend_type` and `console_cookie`.
- Backend rows render only the two manual operation buttons.

Verification:

- Targeted Go tests for store/app behavior.
- `node --test internal/app/web/*.test.mjs`.
- `GOCACHE=/root/workspace/token-gate/.gocache go test ./...` where possible; current baseline is blocked by unrelated untracked `internal/utils/`.
