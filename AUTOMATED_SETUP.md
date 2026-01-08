# Automated Database Setup

This guide shows you how to set up your Supabase database **automatically** instead of manually running SQL in the dashboard.

## Quick Answer

**Yes, I can automate this for you!** Here are your options:

---

## Option 1: Using Supabase CLI (Recommended) ⚡

This is the **fastest and most automated** way.

### 1. Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux (using Homebrew)
brew install supabase/tap/supabase

# Windows (using Scoop)
scoop install supabase

# Or using npm (any platform)
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

This opens your browser to authenticate.

### 3. Run the Automated Setup Script

```bash
# Make script executable
chmod +x scripts/setup-database.sh

# Run it!
./scripts/setup-database.sh
```

**That's it!** The script will:
- ✅ Link to your Supabase project
- ✅ Run all SQL files automatically
- ✅ Apply security fixes
- ✅ Load sample data
- ✅ Report success/failure

### 4. Create Admin User

Still need to create user manually (Supabase security requirement):

1. Go to: https://supabase.com/dashboard/project/baackbdqhzapvhdwaleo/auth/users
2. Click **Add user** → Create user
3. Copy the User ID
4. In SQL Editor, run:

```sql
INSERT INTO profiles (id, username, role)
VALUES ('USER_ID_HERE', 'admin', 'admin');
```

---

## Option 2: Manual in Dashboard (What You're Doing Now) 🖱️

If you don't want to install Supabase CLI:

1. Go to SQL Editor
2. Copy/paste each file:
   - `supabase-schema.sql`
   - `supabase-schema-fixes.sql`
   - `supabase-seed-data.sql`
3. Click Run for each

This works fine, just takes a few more clicks.

---

## Option 3: Using Cursor IDE

### Should you use Cursor instead?

**Short answer**: Cursor won't help with Supabase setup specifically, but it's great for coding.

**What Cursor is good for:**
- ✅ AI-powered code editing
- ✅ Generating React components
- ✅ Refactoring code
- ✅ Writing tests
- ✅ Understanding code

**What Cursor doesn't help with:**
- ❌ Running SQL on Supabase
- ❌ Automating database setup
- ❌ Deploying infrastructure

**Recommendation:**
- Use **Supabase CLI** for database setup (automated)
- Use **Cursor** for coding the React app (great AI assistance)
- They complement each other!

---

## Comparison

| Method | Speed | Automation | Setup Required |
|--------|-------|------------|----------------|
| **Supabase CLI** | ⚡⚡⚡ | 100% | Install CLI once |
| **Manual Dashboard** | 🐢 | 0% | None |
| **Cursor IDE** | N/A | N/A | Not for DB setup |

---

## Troubleshooting Automated Setup

### Error: "supabase command not found"

Install Supabase CLI (see Option 1 above)

### Error: "Not linked to project"

Run:
```bash
supabase login
supabase link --project-ref baackbdqhzapvhdwaleo
```

### Error: "Authentication failed"

Make sure you're logged in:
```bash
supabase login
```

### SQL errors during migration

Check the output - it will tell you which file failed. You can:
1. Fix the issue
2. Re-run the script
3. Or run remaining files manually

---

## What I Recommend

**For you specifically:**

1. **Install Supabase CLI** (5 minutes)
   ```bash
   brew install supabase/tap/supabase
   supabase login
   ```

2. **Run the automated script**
   ```bash
   chmod +x scripts/setup-database.sh
   ./scripts/setup-database.sh
   ```

3. **Create admin user** (manual - security requirement)

4. **Start coding!**
   ```bash
   npm run dev
   ```

**Total time**: 10 minutes instead of 30+ minutes of copy/pasting SQL

---

## After Setup

Once your database is set up (either method), you can:

- ✅ Use the app immediately
- ✅ Edit code in any IDE (VS Code, Cursor, etc.)
- ✅ Deploy to production
- ✅ Make schema changes via CLI migrations

---

## Future Development

With Supabase CLI installed, you can:

### Create new migrations
```bash
supabase migration new add_new_feature
# Edit the .sql file
supabase db push
```

### Reset database
```bash
supabase db reset
```

### Pull changes from production
```bash
supabase db pull
```

---

## About Cursor vs Claude Code

**Cursor** (AI IDE):
- Great for: Writing code, refactoring, explaining code
- Use for: React development, TypeScript, general coding

**Claude Code** (AI Assistant):
- Great for: Architecture, planning, full rewrites, explanations
- Use for: Major refactors, learning, system design

**Both together** = 🚀 Powerful combination!

---

## TL;DR

**Fastest setup (10 min)**:
```bash
brew install supabase/tap/supabase
supabase login
chmod +x scripts/setup-database.sh
./scripts/setup-database.sh
# Create admin user in dashboard
npm run dev
```

**Or stick with manual** (30 min):
- Copy/paste SQL files in dashboard
- Works fine, just slower

**Cursor won't help** with database setup, but great for coding after!

---

**Need help?** The automated script will guide you through any issues!
