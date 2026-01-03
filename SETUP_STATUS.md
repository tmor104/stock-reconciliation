# Setup Status - What's Done vs What You Need to Do

## ✅ What I've Done (Auto)

1. **✅ Service Account Key Uploaded**
   - Uploaded the new service account key to Cloudflare Workers
   - Secret `GOOGLE_SERVICE_ACCOUNT_KEY` is now set

2. **✅ Debug Test Endpoint Added**
   - Added `/debug/test-auth` endpoint to Cloudflare Worker
   - Tests service account authentication and API access

3. **✅ Test HTML Page Created**
   - Created `test-auth.html` in the root directory
   - Simple UI to test authentication

4. **✅ Worker Code Updated**
   - All API fixes applied (PATCH request format, error handling, etc.)
   - Observability enabled for logging

## 📋 What You Need to Do (Manual)

### Step 1: Enable APIs in Google Cloud Console ⚠️ REQUIRED

**Google Sheets API:**
- Go to: https://console.cloud.google.com/apis/library/sheets.googleapis.com
- Make sure project `stocktake-reconciliation` is selected at the top
- Click **"ENABLE"** if it's not already enabled
- Should show "API Enabled" ✅

**Google Drive API:**
- Go to: https://console.cloud.google.com/apis/library/drive.googleapis.com
- Click **"ENABLE"** if not already enabled
- Should show "API Enabled" ✅

**⏱️ Wait 1-2 minutes after enabling for changes to propagate**

### Step 2: Deploy Updated Worker ⚠️ REQUIRED

```bash
cd stocktake-system/cloudflare-worker
npx wrangler deploy
```

This deploys the new debug endpoint and all recent fixes.

### Step 3: Test Authentication (Optional but Recommended)

1. Open `test-auth.html` in your browser
   - Right-click the file → "Open with" → Browser
   - OR drag it into your browser

2. Enter credentials:
   - Username: `admin`
   - Password: (your actual admin password)

3. Click "Test Authentication"

4. Check results:
   - ✅ **Green box** = Everything works! You're done!
   - ❌ **Red box** = Read the error message and follow the steps

### Step 4: Verify Folder Sharing (If Still Getting 403 Errors)

1. Open: https://drive.google.com/drive/folders/1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE
2. Click **Share** (top right)
3. Verify `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com` is listed
4. Permission should be **"Editor"** (not "Viewer")
5. If not there, add it with Editor permission

## 🎯 Quick Checklist

- [ ] Enable Google Sheets API
- [ ] Enable Google Drive API
- [ ] Deploy worker (`npx wrangler deploy`)
- [ ] Test with `test-auth.html` (optional)
- [ ] Verify folder sharing (if needed)

## 🐛 Common Issues

### "GOOGLE_SERVICE_ACCOUNT_KEY secret is not set"
- **Fix:** The secret was just uploaded, but you need to deploy the worker for changes to take effect

### "Failed to get access token"
- **Fix:** Check that APIs are enabled (Step 1) and service account key is valid

### "403 PERMISSION_DENIED"
- **Fix:** Verify folder sharing (Step 4) and wait 10-30 seconds for permissions to propagate

### "Invalid Value (400)"
- **Fix:** Usually means folder ID is wrong or query syntax issue (already fixed in code)

## 📞 Next Steps After Setup

Once everything is working:
1. Try creating a stocktake in the app
2. Try listing stocktakes
3. Check Cloudflare Worker logs if issues persist

---

**Last Updated:** After service account key re-upload
