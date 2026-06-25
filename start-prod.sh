#!/bin/bash

# Token Gate - Production Startup Script
# Builds frontend and starts Go backend with embedded UI

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
WEB_DIR="$PROJECT_ROOT/web"

echo "🏗️  Building Token Gate for Production"
echo "========================================"

# Build frontend
echo "📦 Building frontend..."
cd "$FRONTEND_DIR"
npm install
npm run build
cd "$PROJECT_ROOT"

# Verify build output
if [ ! -f "$WEB_DIR/index.html" ]; then
  echo "❌ Error: Frontend build failed - web/index.html not found"
  exit 1
fi

echo "✅ Frontend built successfully"
echo ""

# Start Go backend
echo "🚀 Starting Token Gate backend on :4000..."
echo "   Frontend UI: http://localhost:4000/"
echo "   Admin API:   http://localhost:4000/admin/api/*"
echo ""

go run ./cmd/token-gate
