#!/bin/bash

# Token Gate - Development Startup Script
# Starts both Go backend and Vue frontend dev server

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "🚀 Starting Token Gate Development Environment"
echo "================================================"

# Check if frontend dependencies are installed
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  cd "$FRONTEND_DIR"
  npm install
  cd "$PROJECT_ROOT"
fi

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down services..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

# Start Go backend
echo "🔧 Starting Go backend on :4000..."
go run ./cmd/token-gate &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend to start..."
sleep 3

# Start frontend dev server
echo "🎨 Starting frontend dev server on :5173..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

cd "$PROJECT_ROOT"

echo ""
echo "✅ Services running:"
echo "   - Backend:  http://localhost:4000"
echo "   - Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for both processes
wait
