#!/usr/bin/env bash
# Build script for the Frontend. Usage:
# VITE_API_BASE_URL=https://rajac-finance-backend-.../ npm run build

set -e

if [ -z "$VITE_API_BASE_URL" ]; then
  echo "Warning: VITE_API_BASE_URL not set. Falling back to http://localhost:3000"
fi

# Install dependencies (if not already installed)
if [ ! -d "node_modules" ]; then
  npm ci
fi

# Build the frontend with the provided VITE_API_BASE_URL
VITE_API_BASE_URL=${VITE_API_BASE_URL:-http://localhost:3000} npm run build

echo "Build complete. Upload the contents of dist/ to your static host (Vercel/Netlify/Cloud Run static server)."