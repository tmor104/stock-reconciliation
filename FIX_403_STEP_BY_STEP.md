# Fix 403 Error - Step by Step (No Coding Required)

## The Problem
Your service account `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com` cannot create spreadsheets. This is a Google Cloud permissions issue.

## Solution: Enable Domain-Wide Delegation (REQUIRED)

Service accounts need special permissions to create files. Here's exactly what to do:

### Step 1: Enable Domain-Wide Delegation
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click on: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
3. Click the **"Details"** tab (or "Show advanced settings")
4. Find **"Domain-wide delegation"** section
5. Check the box: **"Enable Google Workspace Domain-wide Delegation"**
6. Click **"SAVE"**

**Note:** If you don't see this option, you might be using a personal Google account. In that case, see "Alternative Solution" below.

### Step 2: Verify APIs Are Enabled
1. Go to: https://console.cloud.google.com/apis/library
2. Search for **"Google Sheets API"**
   - Should show "API Enabled" ✅
   - If not, click "ENABLE"
3. Search for **"Google Drive API"**
   - Should show "API Enabled" ✅
   - If not, click "ENABLE"
4. Wait 1-2 minutes after enabling

### Step 3: Verify Service Account Key
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click on: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
3. Click **"KEYS"** tab
4. You should see at least one key listed
5. If no keys, click **"ADD KEY"** → **"Create new key"** → **"JSON"** → Download

### Step 4: Re-upload Key to Cloudflare (If You Created a New Key)
If you created a new key in Step 3, upload it:
```bash
cd stocktake-system/cloudflare-worker
cat ~/Downloads/stocktake-reconciliation-*.json | npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
npx wrangler deploy
```

## Alternative Solution: If Domain-Wide Delegation Doesn't Work

If you're using a personal Google account (not Workspace), domain-wide delegation might not be available. In that case:

### Option A: Use a Shared Drive Folder
1. Create a folder in Google Drive
2. Share it with: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
3. Give it **"Editor"** permission
4. Use that folder ID in your app

### Option B: Grant Service Account Access to Your Drive
1. Go to: https://drive.google.com
2. Create a folder (or use existing)
3. Right-click → **"Share"**
4. Add: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
5. Set permission to **"Editor"**
6. Uncheck "Notify people"
7. Click **"Share"**

## Test It
After completing the steps above, try creating a stocktake again in your app.

## Still Not Working?

Check the exact error by visiting:
https://stocktake-reconciliation.tomwmorgan47.workers.dev/debug/test-service-account

This will show you the exact error message from Google.

