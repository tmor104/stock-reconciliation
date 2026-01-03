# Quick Fix: Give Service Account Access to Google Drive

## The Problem
You've shared the Master Sheet, but the service account can't search Drive for "Stocktake -" spreadsheets created by the Stock app.

## Quick Solution (2 minutes)

### Step 1: Get Your Service Account Email

Your service account email is in the JSON key file you downloaded. It looks like:
```
stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com
```

**OR** check your service account in Google Cloud Console:
1. Go to https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click on `stocktake-worker`
3. Copy the email address

### Step 2: Share Existing Stocktake Spreadsheets

For each spreadsheet the Stock app has created:

1. Open the spreadsheet in Google Sheets
2. Click "Share" (top right)
3. Paste the service account email
4. Permission: "Viewer"
5. Uncheck "Notify people"
6. Click "Share"

**Do this for all existing "Stocktake -" spreadsheets.**

### Step 3: Share Future Spreadsheets

When the Stock app creates a new spreadsheet, share it with the service account using the same steps above.

---

## Better Solution: Use a Folder (5 minutes)

### Step 1: Create Folder

1. Go to https://drive.google.com
2. Click "New" → "Folder"
3. Name: `Stocktake Count Sheets`
4. **Copy Folder ID from URL:**
   - URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Copy the `FOLDER_ID_HERE` part

### Step 2: Share Folder

1. Right-click folder → "Share"
2. Paste service account email
3. Permission: "Viewer"
4. Uncheck "Notify people"
5. Click "Share"

### Step 3: Update wrangler.toml

Edit `stocktake-system/cloudflare-worker/wrangler.toml`:

```toml
COUNT_SHEETS_FOLDER_ID = "YOUR_FOLDER_ID_HERE"
```

### Step 4: Redeploy Worker

```bash
cd stocktake-system/cloudflare-worker
npx wrangler deploy
```

### Step 5: Move or Create Spreadsheets in Folder

**Option A:** Move existing spreadsheets:
- Drag existing "Stocktake -" spreadsheets into the folder

**Option B:** Update Stock app (if possible):
- Have Stock app create new spreadsheets in this folder

---

## Verify It Works

1. Refresh the stocktake system home page
2. Count sheets should now appear
3. If not, check browser console for error message

---

## Why This Is Needed

Google Drive API requires explicit sharing. Sharing one sheet doesn't give access to search Drive. You need to either:
- Share each spreadsheet individually, OR
- Share a folder containing the spreadsheets

The folder approach is better because:
- ✅ One-time setup
- ✅ All future spreadsheets automatically accessible
- ✅ Better organization


