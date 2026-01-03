# Fix 403 Permission Denied When Creating Spreadsheet

## The Problem
```
403 PERMISSION_DENIED: "The caller does not have permission"
```

This happens when the service account tries to CREATE a spreadsheet via Google Sheets API.

## Root Causes & Fixes

### 1. ✅ Service Account Key is Invalid/Expired
**Check:**
- Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
- Find: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
- Click "KEYS" tab
- Verify you have a key (JSON format)

**Fix:**
- Delete old key if needed
- Create NEW key: "ADD KEY" → "Create new key" → "JSON"
- Download the JSON file
- Re-upload to Cloudflare: `npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY`
- Deploy: `npx wrangler deploy`

### 2. ✅ APIs Not Enabled
**Check:**
- Google Sheets API: https://console.cloud.google.com/apis/library/sheets.googleapis.com
- Google Drive API: https://console.cloud.google.com/apis/library/drive.googleapis.com
- Both should show "API Enabled" ✅

**Fix:**
- Click "ENABLE" on both if not enabled
- Wait 1-2 minutes for changes to propagate

### 3. ✅ Service Account Needs Domain-Wide Delegation (G Suite/Workspace Only)
**If you're using Google Workspace/G Suite:**
- Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
- Click on your service account
- Go to "Details" tab
- Enable "Domain-wide delegation"
- Add OAuth scopes:
  - `https://www.googleapis.com/auth/spreadsheets`
  - `https://www.googleapis.com/auth/drive`

**If you're using personal Google account:**
- Domain-wide delegation is NOT needed
- Skip this step

### 4. ✅ Service Account Key Format Issue
**Check the key structure:**
```json
{
  "type": "service_account",
  "project_id": "stocktake-reconciliation",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

**Fix:**
- Make sure the entire JSON is copied (including all fields)
- No extra spaces or line breaks
- The `private_key` should have `\n` characters (not actual newlines)

### 5. ✅ Test the Service Account Key Directly
**Create a test script to verify the key works:**

```bash
# Test if the service account can get an access token
curl -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=YOUR_JWT_HERE"
```

If this fails, the key is invalid.

## Quick Checklist

- [ ] Service account key exists and is valid
- [ ] Key is uploaded to Cloudflare (`wrangler secret list` shows it)
- [ ] Google Sheets API is enabled
- [ ] Google Drive API is enabled
- [ ] Service account email is correct: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
- [ ] If using Workspace: Domain-wide delegation is enabled
- [ ] Worker is deployed with latest code

## Most Common Fix

**90% of the time, the issue is:**
1. The service account key was deleted/recreated
2. The new key wasn't uploaded to Cloudflare
3. The worker wasn't redeployed

**Solution:**
```bash
# 1. Get new key from Google Cloud Console
# 2. Upload it
cat ~/Downloads/stocktake-reconciliation-*.json | npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY

# 3. Deploy
npx wrangler deploy
```

## Still Not Working?

Check Cloudflare Worker logs:
1. Go to: https://dash.cloudflare.com
2. Workers & Pages → `stocktake-reconciliation`
3. Click "Logs" tab
4. Try creating a stocktake
5. Look for the exact error message

The logs will show:
- Whether the JWT was created successfully
- Whether the access token was obtained
- The exact Google API error response

