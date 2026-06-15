#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

export http_proxy=
export https_proxy=
export ALL_PROXY=
export TG_LISTEN_ADDR="${TG_LISTEN_ADDR:-:4000}"
export TG_DB_PATH="${TG_DB_PATH:-$ROOT_DIR/token-gate.db}"
export TG_ADMIN_TOKEN="${TG_ADMIN_TOKEN:-dev-admin-token}"
export TG_LOG_LEVEL="${TG_LOG_LEVEL:-info}"
export GOCACHE="${GOCACHE:-$ROOT_DIR/.gocache}"
export GOMODCACHE="${GOMODCACHE:-/root/go/pkg/mod}"

mkdir -p "$GOCACHE"

echo "token-gate listening on ${TG_LISTEN_ADDR}"
echo "admin token: ${TG_ADMIN_TOKEN}"
echo "database: ${TG_DB_PATH}"
echo "log level: ${TG_LOG_LEVEL}"

exec go run ./cmd/token-gate
