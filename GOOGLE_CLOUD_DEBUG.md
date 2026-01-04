# Google Cloud Configuration Debug

## Questions to Answer

### 1. Service Account Email
**Question:** What is the EXACT service account email?
- Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
- Find `stocktake-worker`
- Copy the full email address
- **Expected format:** `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
- **Your actual email:** _______________________________

### 2. APIs Enabled
**Question:** Are both APIs enabled?
- Go to: https://console.cloud.google.com/apis/library
- Search for "Google Sheets API" → Should show "Enabled" ✅
- Search for "Google Drive API" → Should show "Enabled" ✅
- **Sheets API:** [ ] Enabled [ ] Not Enabled
- **Drive API:** [ ] Enabled [ ] Not Enabled

### 3. Service Account Key
**Question:** Do you have the service account JSON key file?
- Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
- Click on `stocktake-worker`
- Go to "Keys" tab
- Do you see a key? [ ] Yes [ ] No
- Is it uploaded to Cloudflare? [ ] Yes [ ] No
- **Check:** Run `npx wrangler secret list` - does it show `GOOGLE_SERVICE_ACCOUNT_KEY`?

### 4. Folder Sharing
**Question:** Is the folder actually shared with the service account?
- Open: https://drive.google.com/drive/folders/1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE
- Click "Share" button (top right)
- **Is `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com` in the list?**
  - [ ] Yes, with Editor permission
  - [ ] Yes, with Viewer permission
  - [ ] No, not in the list
- **If not in list:** Add it with Editor permission, uncheck "Notify people"

### 5. Project Name
**Question:** What is your Google Cloud project name?
- Go to: https://console.cloud.google.com
- Check the project name at the top
- **Expected:** `stocktake-reconciliation`
- **Your actual:** _______________________________

### 6. Service Account Permissions
**Question:** Does the service account have any IAM roles assigned?
- Go to: https://console.cloud.google.com/iam-admin/iam
- Search for `stocktake-worker`
- **What roles does it have?** _______________________________
- **Note:** For Drive/Sheets access, you DON'T need IAM roles - just folder sharing

### 7. Test Access Token
**Question:** Can the service account get an access token?
- This is what the code does first
- If this fails, nothing else will work
- **Check Cloudflare Worker logs** for "Failed to get access token" errors

---

## Most Likely Issues

### Issue 1: Service Account Email Mismatch
**Symptom:** Folder is shared with wrong email
**Fix:** 
1. Get exact service account email from Google Cloud Console
2. Share folder with that EXACT email
3. Wait 10-30 seconds

### Issue 2: APIs Not Enabled
**Symptom:** 400/403 errors even with correct sharing
**Fix:**
1. Go to APIs & Services → Library
2. Enable Google Sheets API
3. Enable Google Drive API
4. Wait 1-2 minutes for propagation

### Issue 3: Service Account Key Not Set
**Symptom:** "Failed to get access token" errors
**Fix:**
1. Download service account JSON key
2. Run: `npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY`
3. Paste the entire JSON content
4. Redeploy worker

### Issue 4: Folder Not Actually Shared
**Symptom:** 403/404 errors
**Fix:**
1. Open folder: https://drive.google.com/drive/folders/1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE
2. Click Share
3. Add service account email (get exact email from Google Cloud Console)
4. Set permission to Editor
5. Uncheck "Notify people"
6. Click Share
7. Wait 10-30 seconds

---

## Quick Test

Let's test if the service account can access the folder:

1. **Get service account email:**
   ```bash
   # Check your service account JSON key file
   # Look for "client_email" field
   ```

2. **Verify folder sharing:**
   - Open: https://drive.google.com/drive/folders/1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE
   - Click Share
   - Verify service account email is listed

3. **Check Cloudflare Worker logs:**
   - Go to: https://dash.cloudflare.com
   - Workers → stocktake-reconciliation → Logs
   - Look for errors when listing stocktakes

---

## What I Need From You

Please answer these questions:

1. **Service account email:** _______________________________
2. **APIs enabled:** [ ] Yes [ ] No
3. **Service account key in Cloudflare:** [ ] Yes [ ] No
4. **Folder shared with service account:** [ ] Yes [ ] No
5. **Exact error from Cloudflare Worker logs:** _______________________________

Once I have these answers, I can tell you exactly what's wrong and how to fix it!



