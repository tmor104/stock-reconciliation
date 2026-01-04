# Apps Script CORS Fix

## The Problem
Apps Script web apps don't handle OPTIONS preflight requests, causing CORS errors when called from GitHub Pages.

## The Solution
1. **Frontend**: Use `Content-Type: text/plain;charset=utf-8` instead of `application/json`
   - ✅ Already fixed in `api-service.js`

2. **Apps Script Deployment**: Must be deployed correctly
   - Execute as: **Me** (your account)
   - Who has access: **Anyone** (including anonymous)
   - This is CRITICAL - if set to "Only myself", CORS will fail

## Verify Your Deployment

1. Go to: https://script.google.com
2. Open your project
3. Click **Deploy** → **Manage deployments**
4. Click the pencil icon (edit) on your deployment
5. Verify:
   - **Execute as**: Me
   - **Who has access**: Anyone
6. Click **Deploy** (even if no changes, this updates the deployment)

## Test the Deployment

Open this URL in your browser:
```
https://script.google.com/macros/s/AKfycbyRxTKP3KGCiGKhkraeaSz9rxEknGR6mF0LnGQBzMuXp_WfjLf7DtLULC0924ZJcmwQ/exec
```

You should see:
```json
{
  "success": true,
  "message": "Unified Stock System API is running. Use POST requests.",
  "timestamp": "..."
}
```

If you see an error or login prompt, the deployment settings are wrong.

## If Still Not Working

1. **Create a NEW deployment** (don't edit the old one):
   - Deploy → New deployment
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
   - Click Deploy
   - Copy the NEW URL
   - Update `APPS_SCRIPT_URL` in `api-service.js`

2. **Clear browser cache**:
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - Or use incognito/private window

3. **Check GitHub Pages deployment**:
   - Make sure your latest code is pushed to GitHub
   - GitHub Pages may take a few minutes to update

## Why This Works

- `text/plain` prevents preflight OPTIONS requests
- "Anyone" access allows cross-origin requests
- Apps Script automatically adds CORS headers when deployed correctly


