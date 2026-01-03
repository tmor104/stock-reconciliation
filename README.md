# Stock Wizard - Stock Reconciliation System

A hybrid stocktake reconciliation system using **Apps Script** for file operations and **Cloudflare Workers** for authentication and complex logic.

## Architecture

### Apps Script (File Operations)
- ✅ Creates spreadsheets in your Google Drive
- ✅ Lists stocktakes
- ✅ Syncs scans, kegs, and manual entries
- ✅ Deletes scans (with audit trail)
- ✅ Loads user scan history

**Why Apps Script?** It runs as YOU, so it can create files in YOUR Drive using YOUR storage quota. No service account limitations!

### Cloudflare Worker (Backend Logic)
- ✅ User authentication
- ✅ Reading product database, locations, kegs from Master Sheet
- ✅ Variance calculations
- ✅ Export files (.dat, Excel)

## Setup

### 1. Deploy Apps Script

1. Go to https://script.google.com
2. Create new project
3. Copy code from `unified-system/apps-script/AppsScript.gs`
4. Update `STOCKTAKE_FOLDER_ID` with your Google Drive folder ID
5. Deploy → New deployment → Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the Web App URL

### 2. Configure Frontend

Edit `api-service.js`:
```javascript
const CONFIG = {
    WORKER_URL: 'https://stocktake-reconciliation.tomwmorgan47.workers.dev',
    APPS_SCRIPT_URL: 'YOUR_APPS_SCRIPT_WEB_APP_URL',
};
```

### 3. Deploy Cloudflare Worker

```bash
cd stocktake-system/cloudflare-worker
wrangler deploy
```

Set secrets:
```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
wrangler secret put MASTER_SHEET_ID
wrangler secret put INITIAL_ADMIN_PASSWORD
```

## Usage

1. **Login** - Authenticate with username/password
2. **Configure Folder** - Enter Google Drive folder ID in Settings
3. **Create Stocktake** - Creates spreadsheet in your Drive
4. **Upload Variance** - Optional, can upload later
5. **Count** - Barcode scanning, manual entries, keg counting
6. **Sync** - Automatically syncs to Google Sheets
7. **Reconcile** - View variances and complete stocktake

## File Structure

```
├── app.js                    # Main frontend application
├── api-service.js            # API client (Apps Script + Worker)
├── indexeddb-service.js      # Offline storage
├── index.html                # Frontend HTML
├── styles.css                # Styling
├── unified-system/
│   ├── apps-script/
│   │   └── AppsScript.gs     # Apps Script backend
│   └── frontend/             # Alternative frontend (not used)
└── stocktake-system/
    └── cloudflare-worker/    # Worker backend
```

## Key Features

- ✅ **Offline-first** - Works offline, syncs when online
- ✅ **No storage issues** - Files created in your Drive
- ✅ **Real-time sync** - Automatic sync to Google Sheets
- ✅ **Audit trail** - All deletions tracked
- ✅ **Variance calculation** - Automatic variance reports
- ✅ **Export** - Generate .dat files and Excel reports

## Troubleshooting

See `HYBRID_SETUP_INSTRUCTIONS.md` for detailed setup and troubleshooting.

## License

Private project
