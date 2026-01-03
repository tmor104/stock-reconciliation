# Check Billing and Project Restrictions

## The Problem
Service account gets 403 when trying to CREATE spreadsheets. This happens even before moving files.

## Possible Causes

### 1. Billing Not Enabled (MOST LIKELY)
Google Cloud projects need billing enabled for service accounts to create files.

**Check:**
1. Go to: https://console.cloud.google.com/billing
2. Check if project `stocktake-reconciliation` has billing enabled
3. If not, you need to:
   - Add a payment method
   - Link it to the project
   - Note: Free tier should work, but billing account must exist

### 2. Organization Policies
If this is an organization account, there might be policies blocking service accounts.

**Check:**
1. Go to: https://console.cloud.google.com/iam-admin/org-policies
2. Look for policies related to:
   - Service account file creation
   - Drive API restrictions
   - Domain restrictions

### 3. Project Quotas
The project might have hit quotas or restrictions.

**Check:**
1. Go to: https://console.cloud.google.com/apis/api/sheets.googleapis.com/quotas
2. Check if there are any quota limits or restrictions

### 4. Service Account Permissions
The service account might need specific IAM roles.

**Try:**
1. Go to: https://console.cloud.google.com/iam-admin/iam
2. Find: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
3. Grant role: **"Service Account User"** or **"Editor"**

## Quick Test

Try creating a spreadsheet manually using the service account:
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click on your service account
3. Try using "Grant Access" to see if there are any restrictions

## Alternative: Use OAuth Instead of Service Account

If service accounts continue to fail, we might need to switch to OAuth 2.0 user authentication instead. This would require users to authorize the app, but it would work around service account restrictions.

