# Quick Setup Verification

## Step 1: Verify Service Account Email

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click on `stocktake-worker`
3. Copy the **Email** address (should be like `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`)
4. **Write it here:** _______________________________

## Step 2: Verify APIs Enabled

1. Go to: https://console.cloud.google.com/apis/library
2. Search "Google Sheets API" → Click it → Should say "Enabled" ✅
3. Search "Google Drive API" → Click it → Should say "Enabled" ✅
4. If not enabled, click "Enable" and wait 1-2 minutes

## Step 3: Verify Cloudflare Secret

Run this command:
```bash
cd stocktake-system/cloudflare-worker
npx wrangler secret list
```

**Should show:** `GOOGLE_SERVICE_ACCOUNT_KEY`

If missing, you need to set it:
```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
# Then paste your entire service account JSON key
```

## Step 4: Verify Folder Sharing

1. Open: https://drive.google.com/drive/folders/1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE
2. Click **Share** (top right)
3. **Is your service account email in the list?**
   - If NO: Click "Add people" → Paste service account email → Set to "Editor" → Uncheck "Notify people" → Share
   - If YES: Check permission is "Editor" (not "Viewer")

## Step 5: Check Cloudflare Worker Logs

1. Go to: https://dash.cloudflare.com
2. Workers → `stocktake-reconciliation` → Logs
3. Try listing stocktakes in the app
4. **What error appears in the logs?** _______________________________

---

## Most Common Issues

### Issue: "Invalid Value (400)"
**Usually means:**
- Folder ID is wrong (but we know it's `1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE`)
- Service account can't access folder (check sharing)
- Query syntax issue (but we've fixed this)

### Issue: "Permission denied (403)"
**Usually means:**
- Folder not shared with service account
- Service account email is wrong
- Permission is "Viewer" instead of "Editor"

### Issue: "Failed to get access token"
**Usually means:**
- Service account key not set in Cloudflare
- Service account key is invalid/expired
- APIs not enabled

---

## What to Share With Me

1. **Service account email:** _______________________________
2. **APIs enabled:** [ ] Yes [ ] No
3. **Cloudflare secret exists:** [ ] Yes [ ] No (run `npx wrangler secret list`)
4. **Folder shared:** [ ] Yes [ ] No
5. **Exact error from Cloudflare logs:** _______________________________

Once I have these, I can tell you exactly what's wrong!



