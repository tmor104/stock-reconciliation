# Grant IAM Role to Service Account

## The Issue
Even with APIs enabled, service accounts need IAM roles to create files.

## Solution: Grant Editor Role

### Step 1: Go to IAM & Admin
1. Go to: https://console.cloud.google.com/iam-admin/iam
2. Make sure project `stocktake-reconciliation` is selected at the top

### Step 2: Grant Role to Service Account
1. Click **"GRANT ACCESS"** button (top of the page)
2. In "New principals" field, paste: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
3. In "Select a role" dropdown, search for and select: **"Editor"**
   - This gives full access to create and manage resources
4. Click **"SAVE"**

### Step 3: Wait and Test
1. Wait 1-2 minutes for changes to propagate
2. Try creating a stocktake again in your app

## Alternative: Use Service Account User Role
If "Editor" doesn't work, try:
- Role: **"Service Account User"**
- This allows the service account to act on behalf of users

## Still Not Working?
If it still fails after granting the role, the issue might be:
- Organization policies blocking service account file creation
- Need to create files in a shared folder instead of root Drive
- Service account needs to be added as a user to your Google Workspace domain

