#!/usr/bin/env node

/**
 * Automated Supabase Database Setup
 *
 * This script automatically sets up your Supabase database by:
 * 1. Running the schema (tables, RLS, triggers, views)
 * 2. Applying security fixes
 * 3. Loading sample data
 *
 * Usage: node scripts/setup-database.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Load environment variables
dotenv.config({ path: join(rootDir, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // We'll need this

if (!supabaseUrl) {
  console.error('❌ Error: VITE_SUPABASE_URL not found in .env')
  process.exit(1)
}

console.log('🚀 Starting Supabase Database Setup...\n')

// For now, we'll use the anon key but explain they need service key for full automation
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseServiceKey && !supabaseAnonKey) {
  console.error('❌ Error: No Supabase key found in .env')
  console.error('   Add either SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey
)

async function runSqlFile(filePath, description) {
  console.log(`📄 Running: ${description}...`)

  try {
    const sql = readFileSync(filePath, 'utf-8')

    // Note: Supabase JS client doesn't support raw SQL execution for security
    // We need to use the REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey || supabaseAnonKey,
        'Authorization': `Bearer ${supabaseServiceKey || supabaseAnonKey}`,
      },
      body: JSON.stringify({ query: sql })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    console.log(`✅ ${description} completed\n`)
    return true
  } catch (error) {
    console.error(`❌ Error in ${description}:`, error.message)
    return false
  }
}

async function main() {
  console.log('🔧 Setting up Supabase database...\n')

  // Step 1: Schema
  const schemaSuccess = await runSqlFile(
    join(rootDir, 'supabase-schema.sql'),
    'Database schema (tables, RLS, triggers)'
  )

  if (!schemaSuccess) {
    console.log('\n⚠️  Schema setup failed. Please run manually in Supabase SQL Editor.')
    console.log('   File: supabase-schema.sql\n')
  }

  // Step 2: Security Fixes
  const fixesSuccess = await runSqlFile(
    join(rootDir, 'supabase-schema-fixes.sql'),
    'Security fixes'
  )

  if (!fixesSuccess) {
    console.log('\n⚠️  Security fixes failed. Please run manually in Supabase SQL Editor.')
    console.log('   File: supabase-schema-fixes.sql\n')
  }

  // Step 3: Sample Data
  const seedSuccess = await runSqlFile(
    join(rootDir, 'supabase-seed-data.sql'),
    'Sample data (products, locations, templates)'
  )

  if (!seedSuccess) {
    console.log('\n⚠️  Sample data failed. Please run manually in Supabase SQL Editor.')
    console.log('   File: supabase-seed-data.sql\n')
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Setup Summary')
  console.log('='.repeat(50))
  console.log(`Schema:        ${schemaSuccess ? '✅' : '❌'}`)
  console.log(`Security:      ${fixesSuccess ? '✅' : '❌'}`)
  console.log(`Sample Data:   ${seedSuccess ? '✅' : '❌'}`)
  console.log('='.repeat(50) + '\n')

  if (schemaSuccess && fixesSuccess && seedSuccess) {
    console.log('🎉 Database setup complete!\n')
    console.log('Next steps:')
    console.log('1. Go to Supabase Dashboard → Authentication → Users')
    console.log('2. Create a new user')
    console.log('3. Run: node scripts/create-admin-user.js <user-id> <username>')
    console.log('\nOr just login and the app will guide you!\n')
  } else {
    console.log('⚠️  Some steps failed. You may need to run SQL files manually.')
    console.log('\nManual setup instructions:')
    console.log('1. Go to: https://supabase.com/dashboard/project/baackbdqhzapvhdwaleo')
    console.log('2. Open SQL Editor')
    console.log('3. Run each .sql file in order:')
    console.log('   - supabase-schema.sql')
    console.log('   - supabase-schema-fixes.sql')
    console.log('   - supabase-seed-data.sql\n')
  }
}

main().catch(console.error)
