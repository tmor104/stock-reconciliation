# Service Account Roles - Do You Need Them?

## Short Answer: **NO**

You do **NOT** need to assign IAM roles to your service account for Google Drive/Sheets access.

---

## What You Actually Need

### ✅ Required Steps:

1. **Enable APIs:**
   - Google Sheets API
   - Google Drive API

2. **Create Service Account:**
   - Name: `stocktake-worker`
   - No roles needed at creation time

3. **Share Folders/Files Directly:**
   - Share Google Drive folders with: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
   - Share Google Sheets with the same email
   - Permission level: **Editor** (for folders) or **Viewer** (for read-only sheets)

That's it! No IAM role assignment required.

---

## Why No IAM Roles?

**IAM roles** in Google Cloud are for:
- Managing the service account itself
- Granting permissions to use the service account
- Controlling who can impersonate the service account

**Direct sharing** is for:
- Google Drive/Sheets access
- File/folder permissions
- What the service account can read/write

These are **two separate permission systems**:
- **IAM roles** = Project-level permissions (not needed here)
- **Direct sharing** = File/folder-level permissions (this is what you need)

---

## When Would You Need IAM Roles?

You would only need IAM roles if:
- You want to allow other users/service accounts to impersonate this service account
- You want to grant the service account access to other Google Cloud services (like Cloud Storage, BigQuery, etc.)
- You're using domain-wide delegation (Google Workspace only)

For Google Drive/Sheets API access, **direct sharing is sufficient**.

---

## Common Confusion

**❌ Wrong Approach:**
1. Create service account
2. Go to IAM & Admin → IAM
3. Try to assign roles like "Storage Object Viewer" or "Editor"
4. Wonder why it still doesn't work

**✅ Correct Approach:**
1. Create service account
2. Enable APIs
3. Share folders/files with service account email
4. Done!

---

## Verification

To verify your service account is set up correctly:

1. **Check APIs are enabled:**
   - Go to: https://console.cloud.google.com/apis/library
   - Search for "Google Sheets API" → Should show "Enabled"
   - Search for "Google Drive API" → Should show "Enabled"

2. **Check service account exists:**
   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
   - You should see `stocktake-worker@...`

3. **Check folder is shared:**
   - Open your Google Drive folder
   - Click "Share" button
   - Check if `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com` is in the list
   - Permission should be "Editor" or "Viewer"

If all three are ✅, you're good to go!

---

## Still Having Issues?

If you're still getting permission errors after sharing folders/files:

1. **Wait 10-30 seconds** after sharing (Google needs time to propagate)
2. **Verify the service account email** is exactly correct (no typos)
3. **Check the folder ID** is correct in your settings
4. **Try sharing the folder again** (sometimes permissions don't stick)
5. **Check browser console** for specific error messages

The error "Invalid Value (Code: 400)" is usually a folder ID issue, not a permissions issue.

---

## Summary

- ❌ **Don't assign IAM roles** for Drive/Sheets access
- ✅ **Do share folders/files** with the service account email
- ✅ **Do enable the APIs** (Sheets API, Drive API)
- ✅ **That's all you need!**


