# Complete Setup Guide - Stocktake Reconciliation System

**For users starting from scratch with no Cloudflare Worker or Google Sheets setup**

This guide will walk you through setting up everything needed to run the stocktake reconciliation system.

## ⚠️ Important: Two Separate Systems

You have **two systems**:
1. **Stock App** (barcode scanning) - Uses **Google Apps Script** ✅ (You already have this!)
2. **Stocktake System** (reconciliation) - Uses **Cloudflare Workers** ⚠️ (Need to set this up)

**You keep using Google Apps Script for Stock app!** This guide is for setting up the **stocktake system** (Cloudflare Workers).

See `ARCHITECTURE_EXPLANATION.md` for details on how they work together.

---

## Prerequisites

Before starting, you need:
- A Google account (for Google Sheets/Drive)
- A Cloudflare account (free tier is fine)
- A GitHub account (for hosting frontend)
- Node.js installed on your computer (for deploying Cloudflare Worker)

---

## Part 1: Google Cloud & Sheets Setup

### Step 1.1: Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click "Select a project" → "New Project"
3. Project name: `stocktake-reconciliation`
4. Click "Create"
5. Wait for project to be created, then select it

### Step 1.2: Enable Required APIs

1. In Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API" → Click it → Click "Enable"
3. Search for "Google Drive API" → Click it → Click "Enable"
4. Wait for both to enable (may take a minute)

### Step 1.3: Create Service Account

1. Go to "IAM & Admin" → "Service Accounts"
2. Click "Create Service Account"
3. **Service account name:** `stocktake-worker`
4. **Service account ID:** (auto-filled, keep it)
5. Click "Create and Continue"
6. **Grant access:** Skip (click "Continue")
7. Click "Done"

### Step 1.4: Create Service Account Key

1. Find your service account in the list (`stocktake-worker@...`)
2. Click on it
3. Go to "Keys" tab
4. Click "Add Key" → "Create new key"
5. Select "JSON"
6. Click "Create"
7. **IMPORTANT:** The JSON file will download - **SAVE THIS FILE SECURELY**
   - You'll need it later for Cloudflare secrets
   - This file contains credentials - don't share it publicly

### Step 1.5: Note Service Account Email

1. In the service account details, copy the **Email** address
   - Format: `stocktake-worker@YOUR-PROJECT-ID.iam.gserviceaccount.com`
   - **You'll need this to share Google Sheets with the service account**

---

## Part 2: Create Master Google Sheet (For Stock App)

**⚠️ IMPORTANT:** The Master Sheet is for your **Stock app** (barcode scanner), NOT for the stocktake system!

**If your Stock app is already working, you already have a Master Sheet - SKIP THIS SECTION!**

The Stock app needs a "Master Sheet" with specific sheets. If you don't have one, create it (or verify yours has these):

### Step 2.1: Create Master Spreadsheet

1. Go to https://sheets.google.com
2. Click "Blank" to create new spreadsheet
3. Name it: `Stocktake Master Sheet`
4. **Copy the Sheet ID from the URL:**
   - URL format: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - The `SHEET_ID_HERE` is what you need - **save this for later**

### Step 2.2: Share Master Sheet with Service Account

1. In your Master Sheet, click "Share" (top right)
2. Paste the service account email (from Step 1.5)
3. **Permission:** "Viewer" (read-only is fine)
4. Uncheck "Notify people" (service account doesn't need email)
5. Click "Share"

### Step 2.3: Create "Product Database" Sheet

1. In your Master Sheet, the default sheet is "Sheet1"
2. Right-click "Sheet1" → "Rename" → `Product Database`
3. In row 1, add these headers (A1 to D1):
   ```
   A1: Barcode
   B1: Product
   C1: Current Stock
   D1: Value
   ```
4. Make row 1 bold (Format → Bold)
5. Add a few sample products:
   ```
   A2: 9300857058404
   B2: Great Northern Original 4.2% 330mL Bottle
   C2: 50
   D2: 42.50
   ```

### Step 2.4: Create "Users" Sheet

1. Click "+" to add new sheet
2. Name it: `Users`
3. In row 1, add header:
   ```
   A1: Username
   ```
4. Make row 1 bold
5. Add sample users:
   ```
   A2: admin
   A3: john
   A4: sarah
   ```

### Step 2.5: Create "Locations" Sheet

1. Click "+" to add new sheet
2. Name it: `Locations`
3. In row 1, add header:
   ```
   A1: Location
   ```
4. Make row 1 bold
5. Add sample locations:
   ```
   A2: Cooler 1
   A3: Cooler 2
   A4: Back Room
   A5: Front Display
   ```

### Step 2.6: Set User Passwords (Google Apps Script)

**Note:** If you already have Apps Script set up for Stock app, you may have already done this. Verify or update as needed.

The Stock app uses Google Apps Script to authenticate users. You need to set passwords:

1. In your Master Sheet, go to "Extensions" → "Apps Script"
2. Delete any default code
3. Paste this code:

```javascript
// Set user passwords
function setPasswords() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // Set passwords (change these to your desired passwords)
  scriptProperties.setProperty('password_admin', 'your-admin-password-here');
  scriptProperties.setProperty('password_john', 'john-password-123');
  scriptProperties.setProperty('password_sarah', 'sarah-password-123');
  
  Logger.log('Passwords set successfully');
}
```

4. **IMPORTANT:** Replace `'your-admin-password-here'` with your actual admin password
5. Replace other passwords as needed
6. Click "Run" (play button) → Select `setPasswords` → Click "Run"
7. If prompted, authorize the script (click "Review permissions" → "Allow")
8. Check the execution log to confirm "Passwords set successfully"

**Note:** These passwords are for the Stock app, not the stocktake system.

---

## Part 3: Barcode Mapping (For Stocktake System)

**✅ THIS IS WHAT YOU NEED FOR STOCKTAKE SYSTEM!**

**Good News:** The system can automatically use your Master Sheet's Product Database! You have two options:

### Option A: Auto-Use Master Sheet (EASIEST - Recommended!)

If you have a Master Sheet with a "Product Database" sheet, the system can automatically read from it. No separate sheet needed!

1. In `wrangler.toml`, set `MASTER_SHEET_ID` to your Master Sheet ID
2. Make sure your Master Sheet has a "Product Database" sheet with:
   - Column A: Barcode
   - Column B: Product
3. Share Master Sheet with service account (if not already done)
4. **Done!** No need to create a separate Barcode Mapping sheet.

### Option B: Create Separate Barcode Mapping Sheet

If you prefer a separate sheet, create one:

### Step 3.1: Create Barcode Mapping Sheet (Only if using Option B)

1. Create a new Google Sheet
2. Name it: `Barcode Mapping`
3. In row 1, add headers:
   ```
   A1: Barcode
   B1: Product
   ```
4. Make row 1 bold
5. Add sample mappings:
   ```
   A2: 9300857058404
   B2: Great Northern Original 4.2% 330mL Bottle
   
   A3: 9313419522225
   B3: Hahn Super Dry 4.6% 330mL
   ```
6. **Copy the Sheet ID from the URL** - you'll need this for `wrangler.toml`

### Step 3.2: Share Barcode Mapping Sheet (Only if using Option B)

1. Click "Share" on the Barcode Mapping sheet
2. Paste the service account email
3. Permission: "Viewer"
4. Uncheck "Notify people"
5. Click "Share"

---

**Recommended:** Use Option A (auto-use Master Sheet) - it's easier and you don't need to maintain a separate sheet!

---

## Part 4: Cloudflare Workers Setup

### Step 4.1: Install Node.js (if not installed)

1. Go to https://nodejs.org
2. Download and install LTS version
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

### Step 4.2: Install Wrangler CLI

```bash
npm install -g wrangler
```

### Step 4.3: Login to Cloudflare

```bash
wrangler login
```

This will open your browser - log in to Cloudflare and authorize Wrangler.

### Step 4.4: Navigate to Worker Directory

```bash
cd /Users/tommorgan/Documents/regatta/Code/stock-reconciliation/stocktake-system/cloudflare-worker
```

### Step 4.5: Install Dependencies

```bash
npm install
```

This installs: `itty-router`, `xlsx`, `jose`

### Step 4.6: Create KV Namespace

```bash
wrangler kv:namespace create "STOCKTAKE_KV"
```

**IMPORTANT:** Copy the `id` from the output - it looks like:
```
id = "abc123def456..."
```

### Step 4.7: Update wrangler.toml

Edit `wrangler.toml` and replace:

```toml
[vars]
# Barcode Mapping - Use ONE of these:
# Option A (Recommended): Auto-use Master Sheet
MASTER_SHEET_ID = "YOUR_MASTER_SHEET_ID"  # Your Master Sheet ID (from Stock app)
BARCODE_SHEET_ID = "YOUR_GOOGLE_SHEETS_BARCODE_MAPPING_ID"  # Leave as-is if using Option A

# Option B: Use separate Barcode Mapping sheet
# BARCODE_SHEET_ID = "YOUR_BARCODE_MAPPING_SHEET_ID"  # From Step 3.1
# MASTER_SHEET_ID = "YOUR_MASTER_SHEET_ID"  # Leave as-is if using Option B

COUNT_SHEETS_FOLDER_ID = ""  # Leave empty - Stock app creates individual spreadsheets

[[kv_namespaces]]
binding = "STOCKTAKE_KV"
id = "YOUR_KV_NAMESPACE_ID"  # From Step 4.6
```

**Recommended:** Set `MASTER_SHEET_ID` to your Master Sheet ID. The system will automatically read from the "Product Database" sheet - no separate Barcode Mapping sheet needed!

**Note:** `COUNT_SHEETS_FOLDER_ID` can be left empty - the system will search all Drive for "Stocktake -" spreadsheets.

### Step 4.8: Set Google Service Account Secret

```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
```

When prompted, paste the **entire contents** of the JSON key file you downloaded in Step 1.4.

**Tip:** You can read the file and paste:
```bash
cat /path/to/your-service-account-key.json | wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
```

### Step 4.9: Set Admin Password Secret

```bash
wrangler secret put INITIAL_ADMIN_PASSWORD
```

Enter a secure password (this will be hashed and used for the first admin user).

**Remember this password** - you'll use it to log in!

### Step 4.10: Initialize Admin User

We need to create the first admin user. A helper script is included:

```bash
cd stocktake-system/cloudflare-worker
node init-admin.js your-secure-password-here
```

Replace `your-secure-password-here` with the password you want to use for the admin account.

The script will output a command. Copy and run it:

```bash
wrangler kv:key put "users" '...' --binding=STOCKTAKE_KV
```

**OR** use the Cloudflare dashboard:
1. Go to https://dash.cloudflare.com
2. Workers & Pages → KV
3. Click your STOCKTAKE_KV namespace
4. Click "Add entry"
5. Key: `users`
6. Value: Copy the JSON from the script output
7. Click "Save"

**Remember:** The password you use here is what you'll use to log in as `admin`.

### Step 4.11: Deploy Worker

```bash
wrangler deploy
```

**IMPORTANT:** After deployment, note the Worker URL:
- Format: `https://stocktake-reconciliation.YOUR-ACCOUNT.workers.dev`
- **Save this URL** - you'll need it for the frontend

### Step 4.12: Test Worker

```bash
curl https://your-worker-url.workers.dev/auth/login
```

Should return a response (even if it's an error - that means it's working).

---

## Part 5: Frontend Setup

### Step 5.1: Update Frontend Configuration

Edit `stocktake-system/frontend/app.js`:

```javascript
const CONFIG = {
    WORKER_URL: 'https://your-worker-url.workers.dev',  // From Step 4.11
    BARCODE_SHEET_ID: 'YOUR_BARCODE_MAPPING_SHEET_ID'  // From Step 3.1
};
```

### Step 5.2: Deploy to GitHub Pages

1. Create a GitHub repository (if you haven't)
2. Push your code:
   ```bash
   cd /Users/tommorgan/Documents/regatta/Code/stock-reconciliation
   git init
   git add .
   git commit -m "Initial setup"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

3. Enable GitHub Pages:
   - Go to repository Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: `main` / `root`
   - Click "Save"

4. Wait a few minutes, then access your site at:
   `https://YOUR-USERNAME.github.io/stock-reconciliation/stocktake-system/frontend/`

---

## Part 6: Testing

### Test 1: Login

1. Go to your GitHub Pages URL
2. Login with:
   - Username: `admin`
   - Password: (the password you set in Step 4.9)

### Test 2: Create Stocktake

1. Click "Start New Stocktake"
2. Upload a sample HnL Excel file (if you have one)
3. Select a count sheet (should show any "Stocktake -" spreadsheets from Stock app)
4. Enter stocktake name
5. Click "Create Stocktake"

### Test 3: View Variance

1. Click "View Variance Report"
2. Should show variance data (if count data exists)

---

## Troubleshooting

### "Failed to get access token"
- Check that Google Service Account JSON is correct
- Verify APIs are enabled (Sheets & Drive)
- Check service account has access to sheets

### "Failed to list count sheets"
- Verify service account email has access to spreadsheets
- Check that Stock app has created at least one stocktake spreadsheet
- Try leaving `COUNT_SHEETS_FOLDER_ID` empty in wrangler.toml

### "Invalid credentials" on login
- Verify admin user was created in KV
- Check password hash is correct
- Try recreating admin user

### CORS errors
- Verify Worker URL is correct in frontend
- Check Worker is deployed and accessible
- Verify CORS headers in Worker code

---

## Quick Reference

### Important IDs to Save

1. **Master Sheet ID:** (for Stock app)
2. **Barcode Mapping Sheet ID:** (for stocktake system)
3. **Service Account Email:** (for sharing sheets)
4. **KV Namespace ID:** (in wrangler.toml)
5. **Worker URL:** (for frontend)

### Commands Reference

```bash
# Deploy worker
wrangler deploy

# View logs
wrangler tail

# Update secret
wrangler secret put SECRET_NAME

# List KV keys
wrangler kv:key list --binding=STOCKTAKE_KV

# Get KV value
wrangler kv:key get "users" --binding=STOCKTAKE_KV
```

---

## Next Steps

1. ✅ Set up Google Cloud & Sheets
2. ✅ Deploy Cloudflare Worker
3. ✅ Configure frontend
4. ✅ Test login
5. **Use Stock app to create a stocktake and scan items**
6. **Use stocktake system to view variances**

---

## Support

If you encounter issues:
1. Check Cloudflare Worker logs: `wrangler tail`
2. Check browser console for frontend errors
3. Verify all IDs and secrets are correct
4. Review the integration contract: `INTEGRATION_CONTRACT_STOCK_STOCKTAKE.md`

