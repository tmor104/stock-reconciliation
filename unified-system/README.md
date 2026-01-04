# Unified Stock System

This is the merged system combining the Stock counting app and Stocktake reconciliation system into one unified application.

## Structure

```
unified-system/
├── frontend/
│   ├── index.html          # Main HTML structure
│   ├── styles.css          # Unified styling (to be created)
│   ├── indexeddb-service.js # Heavy IndexedDB usage for offline reliability
│   ├── api-service.js      # Unified API service (Workers + Apps Script)
│   └── app.js              # Main application logic (to be created)
└── apps-script/
    └── AppsScript.gs       # Updated Google Apps Script (creates spreadsheets in folder)
```

## Features

1. **Unified Authentication**: Single login for both counting and reconciliation
2. **Offline-First**: Heavy IndexedDB usage - no data loss on refresh or network issues
3. **Workflow**:
   - Login
   - Select/Create Stocktake
   - Upload Variance Report (optional, can skip)
   - First Counts (using Stock counting interface)
   - Complete First Counts (matches with variance report)
   - Refresh Variance Report (optional, to upload new report)
   - Complete Stocktake (generates .dat file and manual entries list)

4. **Folder Management**: All stocktakes are created in a shared Google Drive folder

## Setup

1. Deploy the Apps Script (`apps-script/AppsScript.gs`) to Google Apps Script
2. Update `STOCKTAKE_FOLDER_ID` in Apps Script with your Google Drive folder ID
3. Deploy the Cloudflare Worker (existing stocktake-reconciliation worker)
4. Update `WORKER_URL` in `api-service.js` if needed
5. Set `APPS_SCRIPT_URL` in the frontend (from Apps Script deployment URL)

## Configuration

### Apps Script
- `MASTER_SHEET_ID`: Your Master Sheet ID
- `STOCKTAKE_FOLDER_ID`: Google Drive folder where stocktakes will be created (leave empty for root)

### Frontend
- `WORKER_URL`: Cloudflare Worker URL for reconciliation
- `APPS_SCRIPT_URL`: Google Apps Script deployment URL (set dynamically)

## Workflow Details

1. **Login**: Authenticates via Cloudflare Workers
2. **Select/Create Stocktake**: 
   - Lists available stocktakes from Google Drive
   - Creates new stocktake in configured folder
3. **Upload Variance Report**: 
   - Optional step
   - Can be skipped and uploaded later
   - Uploads HnL Excel export
4. **First Counts**: 
   - Uses Stock counting interface
   - Barcode scanning
   - Manual entries
   - Keg counting
   - All data saved to IndexedDB immediately
5. **Complete First Counts**: 
   - Matches counts with variance report
   - Calculates variances
6. **Refresh Variance Report**: 
   - Option to upload new variance report
   - Updates calculations
7. **Complete Stocktake**: 
   - Generates .dat file for HnL import
   - Creates manual entries list
   - Locks spreadsheet

## IndexedDB Storage

All data is stored locally in IndexedDB:
- Scans (synced and unsynced)
- Products
- Locations
- Stocktakes
- Variance data
- Manual entries
- Kegs
- App state

This ensures no data loss on refresh or network issues.



