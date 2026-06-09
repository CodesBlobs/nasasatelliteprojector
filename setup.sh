#!/bin/bash

set -e

echo "🚀 Orbital Setup"
echo "================"
echo ""

echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🐘 Starting Docker services..."
docker compose up -d

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 5

echo ""
echo "🗄️  Setting up database..."
cd apps/api
pnpm prisma generate
pnpm prisma migrate deploy || pnpm prisma migrate dev --name init
cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📍 Available services:"
echo "   - API:      http://localhost:3001"
echo "   - API Docs: http://localhost:3001/api"
echo "   - Web:      http://localhost:3000"
echo "   - Postgres: localhost:5432"
echo "   - Redis:    localhost:6379"
echo ""
echo "🏃 To start development:"
echo "   pnpm dev"
echo ""
