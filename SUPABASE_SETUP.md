# Supabase Setup Guide

This guide will walk you through setting up your Supabase database for the Stock Wizard application.

## Step 1: Database Schema Setup

Your Supabase credentials are already configured in `.env`:
- **URL**: https://baackbdqhzapvhdwaleo.supabase.co
- **Anon Key**: ✅ Configured (secured in .env)

### Run the Schema

1. Go to your Supabase project: https://supabase.com/dashboard/project/baackbdqhzapvhdwaleo

2. Navigate to **SQL Editor** in the left sidebar

3. Click **New query**

4. Copy and paste the contents of `supabase-schema.sql`

5. Click **Run** (or press Cmd/Ctrl + Enter)

6. You should see: "Success. No rows returned"

This will create:
- ✅ 15+ database tables
- ✅ Row Level Security policies
- ✅ Automatic triggers
- ✅ Indexes for performance
- ✅ Views for complex queries

## Step 2: Create Your First Admin User

### Option A: Using Supabase Dashboard (Recommended)

1. Go to **Authentication** → **Users** in your Supabase dashboard

2. Click **Add user** → **Create new user**

3. Enter:
   - **Email**: your-email@example.com
   - **Password**: (choose a strong password)
   - Click **Create user**

4. Copy the **User ID** (UUID format like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

5. Go back to **SQL Editor** and run:

```sql
-- Replace 'USER_ID_HERE' with the actual UUID from step 4
-- Replace 'admin' with your desired username

INSERT INTO profiles (id, username, role)
VALUES ('USER_ID_HERE', 'admin', 'admin');
```

### Option B: Using Seed Data Script

Run the seed data script (see Step 3) which will guide you through creating users.

## Step 3: Add Sample Data (Optional)

To test the system with sample data, run `supabase-seed-data.sql` in the SQL Editor.

This will add:
- Sample products (beverages, spirits, etc.)
- Sample locations (Bar, Cellar, Kitchen)
- Sample templates

## Step 4: Test the Connection

1. Start the development server:
```bash
npm run dev
```

2. Open http://localhost:3000

3. You should see the login page

4. Login with the email/password you created in Step 2

5. You should be redirected to the dashboard

## Troubleshooting

### "Invalid login credentials"
- Verify the email/password in Supabase Dashboard → Authentication → Users
- Make sure the user exists and is confirmed

### "User not found in profiles table"
- Run the INSERT INTO profiles query from Step 2
- Verify the UUID matches exactly

### "Failed to fetch"
- Check your `.env` file has the correct URL and key
- Restart the dev server: `npm run dev`
- Check browser console for detailed errors

### "Row Level Security policy violation"
- The profile record must exist for authentication to work
- Run: `SELECT * FROM profiles;` to verify

## Next Steps

Once logged in, you can:

1. **Create a stocktake** from the dashboard
2. **Add products** (will be implemented)
3. **Add locations** (will be implemented)
4. **Start counting** (will be implemented)

## Database Management

### Viewing Data

Use the **Table Editor** in Supabase to view/edit data:
- Authentication → Users (auth.users table)
- Table Editor → profiles, products, locations, etc.

### Backup

Supabase automatically backs up your database. You can also:
- Export data: Table Editor → Export as CSV
- Clone project: Project Settings → Database → Point-in-time Recovery

### Reset Database

To start fresh:

1. Run in SQL Editor:
```sql
-- WARNING: This deletes ALL data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

2. Re-run `supabase-schema.sql`

## Security Notes

- ✅ `.env` file is in `.gitignore` (credentials won't be committed)
- ✅ RLS policies are enabled (users can only access their data)
- ✅ Anon key is safe to use in frontend (it's public, RLS protects data)
- ⚠️ Never commit the `.env` file to git
- ⚠️ Never share your service role key (we don't use it in frontend)

## Support

If you encounter issues:
1. Check the browser console (F12)
2. Check Supabase logs: Logs → Postgres Logs
3. Verify RLS policies: Database → Policies
