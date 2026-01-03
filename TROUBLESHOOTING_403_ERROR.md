# Troubleshooting the 403 Permission Error

## Current Situation

You're getting a 403 error when trying to create a stocktake. The error occurs when the Cloudflare Worker tries to create a Google Sheet via the Google Sheets API.

## Root Cause Analysis

Based on the warning **"Google Auth Platform not configured yet"**, the issue is most likely that the **OAuth Consent Screen** is not configured in your Google Cloud project.

---

## 🎯 Step-by-Step Fix (Do these in order)

### Step 1: Configure OAuth Consent Screen ⚡ START HERE

Even though you're using a service account (server-to-server), Google now requires the OAuth Consent Screen to be configured:

1. **Go to**: https://console.cloud.google.com/apis/credentials/consent
2. **Select** your project (stocktake-reconciliation)
3. **User Type**:
   - Choose **Internal** if you have Google Workspace
   - Choose **External** if you don't
4. Click **CREATE**
5. **App Information**:
   - App name: `Stock Reconciliation System`
   - User support email: (your email)
   - Developer contact: (your email)
6. Click **SAVE AND CONTINUE**
7. **Scopes**: Click **ADD OR REMOVE SCOPES**
   - Search and add:
     - `.../auth/spreadsheets` (Google Sheets API)
     - `.../auth/drive` (Google Drive API)
   - Click **UPDATE** then **SAVE AND CONTINUE**
8. **Test users** (if External): Add your email
9. Click **SAVE AND CONTINUE** → **BACK TO DASHBOARD**

---

### Step 2: Verify Service Account Exists

1. **Go to**: https://console.cloud.google.com/iam-admin/serviceaccounts
2. **Look for**: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`

**If it exists** ✅:
- Click on it
- Go to **KEYS** tab
- **If you have a key**: Note the creation date
- **If you DON'T have a key**:
  - Click **ADD KEY** → **Create new key** → **JSON** → **CREATE**
  - Download the JSON file (save it somewhere safe!)
  - Proceed to Step 3

**If it doesn't exist** ❌:
- You need to create it first (let me know and I'll help)

---

### Step 3: Set/Update the Service Account Key in Cloudflare

#### Check Current Status First:

```bash
# Navigate to worker directory
cd /home/user/stock-reconciliation/stocktake-system/cloudflare-worker

# Install wrangler if needed
npm install -g wrangler

# Login to Cloudflare
wrangler login

# List current secrets
wrangler secret list
```

**Expected output**:
```
Secret Name
GOOGLE_SERVICE_ACCOUNT_KEY
INITIAL_ADMIN_PASSWORD
```

#### If `GOOGLE_SERVICE_ACCOUNT_KEY` is MISSING or needs updating:

```bash
# Set the secret
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY

# When prompted, paste the ENTIRE JSON content from your service account key file
# It should look like:
# {
#   "type": "service_account",
#   "project_id": "...",
#   "private_key_id": "...",
#   "private_key": "-----BEGIN PRIVATE KEY-----\n...",
#   "client_email": "stocktake-worker@...",
#   ...
# }
```

---

### Step 4: Deploy and Test

```bash
# Deploy the updated worker
wrangler deploy

# Watch logs in real-time
wrangler tail
```

In another terminal, test the auth:

```bash
# First, login to get a token
curl -X POST https://stocktake-reconciliation.tomwmorgan47.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_HASHED_PASSWORD"}'

# Copy the token from the response, then test:
curl -X GET https://stocktake-reconciliation.tomwmorgan47.workers.dev/debug/test-auth \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected success response**:
```json
{
  "success": true,
  "message": "All authentication tests passed!",
  "serviceAccountEmail": "stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com",
  "testSpreadsheetCreated": true,
  "testSpreadsheetDeleted": true
}
```

**If you get an error**, the response will tell you exactly what's wrong!

---

### Step 5: Re-test Stocktake Creation

After Steps 1-4 are complete:

1. Open your app: https://your-app-url.com
2. Login
3. Try creating a stocktake
4. It should now work! 🎉

---

## Common Error Messages from /debug/test-auth

| Error | Meaning | Fix |
|-------|---------|-----|
| `GOOGLE_SERVICE_ACCOUNT_KEY secret is not set` | Secret missing | Do Step 3 |
| `GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON` | Malformed JSON | Re-do Step 3, ensure you paste the ENTIRE JSON |
| `Failed to get access token` | Invalid credentials | Download new key (Step 2), set it (Step 3) |
| `403` with "OAuth Consent Screen not configured" | Missing OAuth setup | Do Step 1 |
| `403` with "API not enabled" | APIs not enabled | Enable APIs (you said these are already enabled) |

---

## Alternative: Use Cloudflare Dashboard (if wrangler doesn't work)

1. Go to: https://dash.cloudflare.com
2. **Workers & Pages** → **stocktake-reconciliation**
3. **Settings** → **Variables and Secrets**
4. Click **Add variable** → Choose **Secret**
5. Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
6. Value: Paste entire JSON from service account key file
7. Click **Save**
8. Click **Deploy** to redeploy with new secret

---

## Still Not Working?

If you've done all the above and still get errors:

1. Check the **wrangler tail** logs while creating a stocktake
2. Run the `/debug/test-auth` endpoint and share the full error response
3. Check Google Cloud Console → **IAM & Admin** → **Service Accounts** → Make sure the service account has these roles:
   - Service Account Token Creator
   - (These are usually set automatically)

---

## Summary Checklist

- [ ] OAuth Consent Screen configured (Step 1)
- [ ] Service account exists and has a key (Step 2)
- [ ] `GOOGLE_SERVICE_ACCOUNT_KEY` secret is set in Cloudflare (Step 3)
- [ ] Worker deployed with new secret (Step 4)
- [ ] `/debug/test-auth` endpoint returns `success: true`
- [ ] Stocktake creation works!

**Once all boxes are checked, your 403 error should be resolved!** ✅
