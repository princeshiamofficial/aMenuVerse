#!/bin/bash

# Color Hut Deployment & Maintenance Script for aMenuVerse on CyberPanel
echo "======================================================"
echo "🚀 Starting aMenuVerse Deployment & Maintenance..."
echo "======================================================"

# Exit immediately if a command exits with a non-zero status
set -e

# 1. Pull latest code from GitHub
echo "📥 [1/5] Pulling latest code from GitHub..."
git pull origin main || git pull

# 2. Install dependencies
echo "📦 [2/5] Installing dependencies..."
npm ci || npm install

# 3. Initialize database / ensure admin accounts exist
echo "🗄️ [3/5] Checking database seeding..."
node scripts/create-admin.js || true

# 4. Build application (Nitro server target: .output/server/index.mjs)
echo "🛠️ [4/5] Building TanStack Start / Nitro application..."
npm run build

# 5. Restart application via PM2
echo "🔄 [5/5] Restarting PM2 process (amenuverse)..."
pm2 restart ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs

echo "======================================================"
echo "✅ aMenuVerse Deployment Completed Successfully!"
echo "======================================================"
