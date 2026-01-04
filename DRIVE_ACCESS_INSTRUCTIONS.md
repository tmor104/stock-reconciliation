# Google Drive Access - Step by Step

## Your Service Account Email
```
stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com
```

## Option 1: Share Each Spreadsheet (Quick - 2 minutes per spreadsheet)

For each "Stocktake -" spreadsheet:

1. Open the spreadsheet in Google Sheets
2. Click **"Share"** (top right button)
3. Paste: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
4. Set permission to **"Viewer"**
5. **Uncheck** "Notify people"
6. Click **"Share"**

**Note:** You'll need to do this for each new stocktake spreadsheet the Stock app creates.

---

## Option 2: Use a Shared Folder (Better - One-time setup)

### Step 1: Create Folder

1. Go to https://drive.google.com
2. Click **"New"** → **"Folder"**
3. Name it: `Stocktake Count Sheets`
4. **Copy the Folder ID from the URL:**
   - After creating, the URL will be: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Copy everything after `/folders/` - that's your Folder ID

### Step 2: Share Folder with Service Account

1. Right-click the folder → **"Share"**
2. Paste: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
3. Permission: **"Viewer"**
4. **Uncheck** "Notify people"
5. Click **"Share"**

### Step 3: Move Existing Spreadsheets (Optional)

If you have existing "Stocktake -" spreadsheets:
- Drag them into the folder you just created
- They'll automatically be accessible to the service account

### Step 4: Update wrangler.toml

Edit `stocktake-system/cloudflare-worker/wrangler.toml`:

```toml
COUNT_SHEETS_FOLDER_ID = "YOUR_FOLDER_ID_HERE"  # Paste the folder ID from Step 1
```

### Step 5: Redeploy Worker

```bash
cd stocktake-system/cloudflare-worker
npx wrangler deploy
```

### Step 6: Future Spreadsheets

**Option A:** If you can modify the Stock app:
- Update it to create spreadsheets in this folder

**Option B:** If you can't modify Stock app:
- Manually move new spreadsheets into the folder, OR
- Share each new spreadsheet individually (like Option 1)

---

## Which Option Should You Use?

- **Option 1:** If you only have a few spreadsheets and don't mind sharing each one
- **Option 2:** If you want a cleaner setup and have many spreadsheets

**Recommendation:** Use Option 2 (folder) - it's a one-time setup and easier to manage.

---

## Verify It Works

After sharing (either option):

1. Refresh the stocktake system home page
2. Count sheets should appear in the list
3. If you still see errors, check the browser console (F12) for the specific error message

---

## Troubleshooting

### Still Getting 500 Error?

1. **Check Google Drive API is enabled:**
   - Go to: https://console.cloud.google.com/apis/library
   - Search "Google Drive API"
   - Make sure it says "Enabled"

2. **Verify service account email is correct:**
   - Check your service account JSON file
   - Or check Google Cloud Console

3. **Check sharing:**
   - Make sure you shared with the **service account email**, not your personal email
   - Service account email ends with `.iam.gserviceaccount.com`

4. **Check permissions:**
   - Service account needs at least "Viewer" access
   - "Commenter" or "Editor" also works

---

## Quick Checklist

- [ ] Google Drive API enabled ✅ (you said you did this)
- [ ] Service account email: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
- [ ] Shared folder OR shared individual spreadsheets
- [ ] If using folder: Updated `COUNT_SHEETS_FOLDER_ID` in `wrangler.toml`
- [ ] If using folder: Redeployed worker (`npx wrangler deploy`)



