# Code Consistency Fixes

## Issues Found and Fixed

### 1. Missing `supportsAllDrives` Parameter

**Problem:** Service accounts require `supportsAllDrives=true` for all Google Drive API v3 requests, but it was only added to `counting-service.js`.

**Files Fixed:**
- ✅ `google-sheets-v2.js` - `listSheetsInFolder()` method
- ✅ `index.js` - File name retrieval fallback
- ✅ `counting-service.js` - `createStocktake()` move file operation

**Changes:**
- Added `supportsAllDrives=true` to all Drive API GET requests
- Added `includeItemsFromAllDrives=true` to all Drive API file listing queries
- Added `supportsAllDrives=true` to PATCH requests (file moves)

### 2. Query Syntax Consistency

**Problem:** Inconsistent query syntax and URL parameter formatting.

**Fixed:**
- ✅ Standardized to `parents in 'FOLDER_ID'` format (not `'FOLDER_ID' in parents`)
- ✅ Standardized `orderBy` to use spaces: `modifiedTime desc` (not `modifiedTime+desc`)

### 3. Folder ID Cleaning

**Problem:** Folder ID cleaning was inconsistent across files.

**Fixed:**
- ✅ Added folder ID cleaning in `counting-service.js` move file operation
- ✅ Consistent cleaning pattern: `folderId.trim().replace(/[^a-zA-Z0-9_-]/g, '')`

## All Google Drive API Calls Now Include:

1. **File Listing Queries:**
   - `supportsAllDrives=true`
   - `includeItemsFromAllDrives=true`
   - Query format: `parents in 'FOLDER_ID'`

2. **File Metadata Requests:**
   - `supportsAllDrives=true`

3. **File Move Operations:**
   - `supportsAllDrives=true`
   - Cleaned folder ID

## Files Modified:

1. `stocktake-system/cloudflare-worker/services/google-sheets-v2.js`
   - `listSheetsInFolder()` - Added supportsAllDrives parameters

2. `stocktake-system/cloudflare-worker/index.js`
   - File name retrieval - Added supportsAllDrives parameter

3. `stocktake-system/cloudflare-worker/services/counting-service.js`
   - `createStocktake()` - Added supportsAllDrives and folder ID cleaning
   - `listStocktakes()` - Already had supportsAllDrives (no change needed)

## Verification:

All Google Drive API v3 calls now consistently:
- ✅ Include `supportsAllDrives=true` for service account access
- ✅ Use correct query syntax: `parents in 'FOLDER_ID'`
- ✅ Clean folder IDs before use
- ✅ Use consistent URL parameter formatting


