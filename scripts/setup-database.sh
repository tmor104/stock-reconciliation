#!/bin/bash

# =====================================================
# Automated Supabase Database Setup Script
# =====================================================
# This script automates the database setup process
# Usage: ./scripts/setup-database.sh
# =====================================================

set -e  # Exit on error

echo "🚀 Starting Supabase Database Setup..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${RED}❌ Error: .env file not found${NC}"
  echo "   Please create .env file with your Supabase credentials"
  exit 1
fi

# Load environment variables
source .env

if [ -z "$VITE_SUPABASE_URL" ]; then
  echo -e "${RED}❌ Error: VITE_SUPABASE_URL not found in .env${NC}"
  exit 1
fi

echo -e "${BLUE}📍 Supabase URL: $VITE_SUPABASE_URL${NC}"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo -e "${YELLOW}⚠️  Supabase CLI not installed${NC}"
  echo ""
  echo "Option 1: Install Supabase CLI (recommended)"
  echo "  macOS:   brew install supabase/tap/supabase"
  echo "  Linux:   brew install supabase/tap/supabase"
  echo "  Windows: scoop install supabase"
  echo ""
  echo "Option 2: Run SQL files manually in Supabase Dashboard"
  echo "  1. Go to: https://supabase.com/dashboard/project/baackbdqhzapvhdwaleo/sql"
  echo "  2. Run: supabase-schema.sql"
  echo "  3. Run: supabase-schema-fixes.sql"
  echo "  4. Run: supabase-seed-data.sql"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"
echo ""

# Check if linked to project
echo "🔗 Linking to Supabase project..."
supabase link --project-ref baackbdqhzapvhdwaleo || {
  echo -e "${YELLOW}⚠️  Not linked yet. Please run:${NC}"
  echo "   supabase login"
  echo "   supabase link --project-ref baackbdqhzapvhdwaleo"
  exit 1
}

echo ""
echo "📄 Running database migrations..."
echo ""

# Run schema
echo -e "${BLUE}[1/3] Creating schema (tables, RLS, triggers)...${NC}"
supabase db execute < supabase-schema.sql && \
  echo -e "${GREEN}✅ Schema created${NC}" || \
  echo -e "${RED}❌ Schema failed${NC}"

echo ""

# Run security fixes
echo -e "${BLUE}[2/3] Applying security fixes...${NC}"
supabase db execute < supabase-schema-fixes.sql && \
  echo -e "${GREEN}✅ Security fixes applied${NC}" || \
  echo -e "${RED}❌ Security fixes failed${NC}"

echo ""

# Run seed data
echo -e "${BLUE}[3/3] Loading sample data...${NC}"
supabase db execute < supabase-seed-data.sql && \
  echo -e "${GREEN}✅ Sample data loaded${NC}" || \
  echo -e "${RED}❌ Sample data failed${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Database setup complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo "   1. Create admin user in Supabase Dashboard:"
echo "      https://supabase.com/dashboard/project/baackbdqhzapvhdwaleo/auth/users"
echo ""
echo "   2. Add user to profiles table (SQL Editor):"
echo "      INSERT INTO profiles (id, username, role)"
echo "      VALUES ('USER_ID_HERE', 'admin', 'admin');"
echo ""
echo "   3. Start the app:"
echo "      npm run dev"
echo ""
echo "✨ Happy counting!"
echo ""
