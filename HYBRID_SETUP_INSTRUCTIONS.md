# Hybrid Setup Instructions - Apps Script + Cloudflare Worker

## Overview

**Apps Script** handles:
- ✅ Creating spreadsheets (runs as YOU, uses YOUR storage)
- ✅ Listing stocktakes
- ✅ Syncing scans (writing to sheets)
- ✅ Deleting scans
- ✅ Loading user scans

**Cloudflare Worker** handles:
- ✅ Authentication (login, user management)
- ✅ Reading product database, locations, kegs
- ✅ Variance calculations
- ✅ Export files (.dat, Excel)

## Step 1: Deploy Apps Script

1. Go to: https://script.google.com
2. Click "New Project"
3. Copy the code from `unified-system/apps-script/AppsScript.gs`
4. Paste it into the editor
5. **Update the folder ID** (already set to: `1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE`)
6. Click "Deploy" → "New deployment"
7. Type: "Web app"
8. Execute as: "Me"
9. Who has access: "Anyone"
10. Click "Deploy"
11. **Copy the Web App URL** - you'll need this!

## Step 2: Update Frontend Config

1. Open `unified-system/frontend/api-service.js`
2. Find `CONFIG` object (line ~5)
3. Set `APPS_SCRIPT_URL` to your Web App URL:
```javascript
const CONFIG = {
    WORKER_URL: 'https://stocktake-reconciliation.tomwmorgan47.workers.dev',
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
};
```

## Step 3: Test It!

1. Open your app
2. Login
3. Try creating a stocktake
4. It should work! ✅

## How It Works

### Creating a Stocktake:
1. Frontend calls `apiService.createStocktake()`
2. Goes to **Apps Script** (not Worker)
3. Apps Script creates spreadsheet in YOUR Drive
4. Returns spreadsheet ID

### Syncing Scans:
1. Frontend calls `apiService.syncScans()`
2. Goes to **Apps Script**
3. Apps Script writes to the spreadsheet
4. Updates Tally sheet

### Reading Products:
1. Frontend calls `apiService.getProductDatabase()`
2. Goes to **Cloudflare Worker**
3. Worker uses service account to read Master Sheet
4. Returns products

## Troubleshooting

**Error: "Apps Script URL not configured"**
- Make sure you set `APPS_SCRIPT_URL` in `api-service.js`

**Error: "Script not found"**
- Check the Apps Script URL is correct
- Make sure deployment is set to "Anyone"

**Error: "Permission denied"**
- Make sure Apps Script deployment is set to "Execute as: Me"
- Make sure "Who has access: Anyone"

## Adding New Features

To add a new feature to Apps Script:

1. Add case in `doPost()`:
```javascript
case 'myNewFeature':
  return handleMyNewFeature(request);
```

2. Create handler:
```javascript
function handleMyNewFeature(request) {
  // Your code
  return createResponse(true, 'Success', { data });
}
```

3. Call from frontend:
```javascript
const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'myNewFeature',
    // ... params
  })
});
```

That's it! 🎉

