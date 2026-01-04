# Apps Script Deployment Checklist

## The Error
"Upstream returned non-JSON (HTML error page)" means Apps Script is returning an HTML error page instead of JSON. This happens when:
1. Code has a syntax error
2. Code throws an uncaught exception
3. Code hasn't been deployed/updated

## Step-by-Step Fix

### 1. Copy the Updated Code
- Open: https://script.google.com
- Open your Apps Script project
- Select ALL code in `Code.gs` (or `AppsScript.gs`)
- Delete it
- Copy the ENTIRE code from `unified-system/apps-script/AppsScript.gs`
- Paste it into Apps Script editor
- Click **Save** (Ctrl+S or Cmd+S)

### 2. Check for Syntax Errors
- Look for red underlines in the editor
- If you see errors, they'll be shown at the bottom
- Fix any syntax errors before proceeding

### 3. Verify Script Properties
- Click **Project Settings** (gear icon)
- Scroll to **Script Properties**
- Verify `API_SECRET` exists with your secret value
- If missing, add it:
  - Property: `API_SECRET`
  - Value: `f471f9ef421ef843df8cd879ab0f43807fbfa150f862c776b8d7f48e742f670f`

### 4. Test the Code (Optional)
- In Apps Script editor, select function `doGet` from dropdown
- Click **Run** (play button)
- Check **Executions** tab for any errors
- Should return: `{"ok":true,"message":"API is running",...}`

### 5. Deploy/Update Web App
- Click **Deploy** → **Manage deployments**
- If you have an existing deployment:
  - Click **Edit** (pencil icon)
  - Click **Deploy**
- If no deployment exists:
  - Click **New deployment**
  - Click gear icon → **Web app**
  - Set:
    - Description: "Stock Wizard API"
    - Execute as: **Me**
    - Who has access: **Anyone**
  - Click **Deploy**
  - Copy the Web App URL (should match your Worker's `APPS_SCRIPT_URL`)

### 6. Verify Deployment URL
Your deployment URL should be:
```
https://script.google.com/macros/s/AKfycbyRxTKP3KGCiGKhkraeaSz9rxEknGR6mF0LnGQBzMuXp_WfjLf7DtLULC0924ZJcmwQ/exec
```

If it's different, update your Worker's `APPS_SCRIPT_URL` or set it as an environment variable.

## Common Issues

### Issue: "Syntax error" in Apps Script
- Check for missing brackets `{}`, parentheses `()`, or semicolons
- Make sure all functions are properly closed
- Check line 684 - should end with `}`

### Issue: "Execution failed"
- Check **Executions** tab in Apps Script
- Look for error messages
- Common causes:
  - Script Properties not set correctly
  - Drive API permissions not granted
  - Master Sheet ID incorrect

### Issue: Still getting HTML error
- Make sure you **saved** the code (not just pasted)
- Make sure you **deployed** (not just saved)
- Check that the deployment URL matches what Worker is calling
- Try creating a new deployment to get a fresh URL

## Quick Test

After deploying, test directly in browser:
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Should return JSON, not HTML.

## Still Not Working?

1. Check Apps Script **Executions** tab for detailed error logs
2. Check Worker logs: `npx wrangler tail`
3. Verify the secret in Script Properties matches Worker secret
4. Try removing the secret temporarily to test without auth

