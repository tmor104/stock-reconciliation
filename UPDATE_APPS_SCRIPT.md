# Update Your Deployed Apps Script

## The Error
`TypeError: output.setHeader is not a function (line 494)`

This means your **deployed** Apps Script still has the old code with `setHeader()` calls.

## The Fix

1. **Copy the updated code**:
   - Open: `unified-system/apps-script/AppsScript.gs`
   - Select ALL (Cmd+A / Ctrl+A)
   - Copy (Cmd+C / Ctrl+C)

2. **Paste into Apps Script**:
   - Go to: https://script.google.com
   - Open your project
   - Select ALL in the editor
   - Paste the new code (Cmd+V / Ctrl+V)
   - Click **Save** (💾 icon or Cmd+S / Ctrl+S)

3. **Redeploy** (IMPORTANT):
   - Click **Deploy** → **Manage deployments**
   - Click the pencil icon (edit) on your deployment
   - Click **Deploy** (even if no changes shown)
   - This updates the deployed version with your new code

4. **Verify**:
   - The error should be gone
   - Test by creating a stocktake

## Why This Happened

The local file was updated, but the deployed Apps Script still had the old code. Apps Script doesn't auto-update - you must manually copy and redeploy.

## Quick Checklist

- [ ] Copied code from `unified-system/apps-script/AppsScript.gs`
- [ ] Pasted into Apps Script editor
- [ ] Saved the file
- [ ] Redeployed (Manage deployments → Edit → Deploy)
- [ ] Tested - error should be gone


