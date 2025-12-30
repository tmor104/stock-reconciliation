# Google Drive Access Setup Guide

## Problem
The service account needs access to search Google Drive for "Stocktake -" spreadsheets created by the Stock app.

## Solution Options

### Option 1: Create a Shared Folder (RECOMMENDED)

This is the cleanest approach - create a folder, share it with the service account, and have Stock app create spreadsheets there.

#### Step 1: Create Google Drive Folder

1. Go to https://drive.google.com
2. Click "New" → "Folder"
3. Name it: `Stocktake Count Sheets`
4. **Copy the Folder ID from the URL:**
   - URL format: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - The `FOLDER_ID_HERE` is what you need

#### Step 2: Share Folder with Service Account

1. Right-click the folder → "Share"
2. Paste your service account email:
   - Format: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
   - (Or check your `wrangler.toml` / service account JSON for the exact email)
3. **Permission:** "Viewer" (read-only is fine)
4. Uncheck "Notify people" (service account doesn't need email)
5. Click "Share"

#### Step 3: Update wrangler.toml

Edit `stocktake-system/cloudflare-worker/wrangler.toml`:

```toml
COUNT_SHEETS_FOLDER_ID = "YOUR_FOLDER_ID_HERE"  # Paste the folder ID from Step 1
```

#### Step 4: Update Stock App (Optional but Recommended)

If you can modify the Stock app, have it create spreadsheets in this folder. Otherwise, you can manually move spreadsheets there, or use Option 2.

---

### Option 2: Share Individual Spreadsheets

If you can't use a folder, share each spreadsheet individually:

1. When Stock app creates a new spreadsheet, open it
2. Click "Share" (top right)
3. Paste service account email: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
4. Permission: "Viewer"
5. Uncheck "Notify people"
6. Click "Share"

**Note:** You'll need to do this for each new stocktake spreadsheet.

---

### Option 3: Domain-Wide Delegation (Advanced - Google Workspace Only)

If you have Google Workspace, you can use domain-wide delegation to give the service account broader access. This is more complex and usually not necessary.

---

## Verify Access

After setting up, test by:

1. Refresh the stocktake system home page
2. Check if count sheets appear
3. If you still see errors, check the browser console for the specific Google API error

## Troubleshooting

### "Failed to list count sheets" Error

**Check:**
1. ✅ Google Drive API is enabled in Google Cloud Console
2. ✅ Service account email is correct (check your service account JSON)
3. ✅ Folder/spreadsheet is shared with service account
4. ✅ Service account has "Viewer" or higher permission

### "Permission denied" Error

**Fix:**
- Make sure you shared the folder/spreadsheet with the **service account email**, not your personal email
- Service account email format: `stocktake-worker@YOUR-PROJECT-ID.iam.gserviceaccount.com`

### "API not enabled" Error

**Fix:**
1. Go to https://console.cloud.google.com/apis/library
2. Search "Google Drive API"
3. Click it → Click "Enable"
4. Wait 1-2 minutes, then try again

---

## Recommended Setup

**Best approach:** Use Option 1 (Shared Folder)

1. Create folder: `Stocktake Count Sheets`
2. Share with service account
3. Set `COUNT_SHEETS_FOLDER_ID` in `wrangler.toml`
4. Update Stock app to create spreadsheets in this folder (or manually move them)

This way:
- ✅ All stocktake spreadsheets are in one place
- ✅ Service account has access to all of them automatically
- ✅ Easy to manage and organize
- ✅ No need to share each spreadsheet individually

---

## Quick Checklist

- [ ] Google Drive API enabled in Google Cloud
- [ ] Google Sheets API enabled in Google Cloud
- [ ] Service account created
- [ ] Folder created (or individual spreadsheets)
- [ ] Folder/spreadsheets shared with service account email
- [ ] `COUNT_SHEETS_FOLDER_ID` set in `wrangler.toml` (if using folder)
- [ ] Worker redeployed after updating `wrangler.toml`

