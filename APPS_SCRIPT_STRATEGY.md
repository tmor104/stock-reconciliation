# Apps Script Strategy - What Goes Where?

## Current State

### Apps Script Already Has:
✅ `createStocktake` - Creates spreadsheets (WORKS - runs as you!)
✅ `listStocktakes` - Lists stocktakes
✅ `syncScans` - Writes scans to sheets
✅ `deleteScans` - Deletes scans with audit trail
✅ `loadUserScans` - Loads user's scan history
✅ `getProductDatabase` - Reads products from Master Sheet
✅ `getLocations` - Reads locations from Master Sheet

### Cloudflare Worker Has:
✅ Authentication (login, users)
✅ Product database (reads via service account)
✅ Locations (reads via service account)
✅ Kegs (reads via service account)
✅ Create stocktake (FAILS - service account can't create files)
✅ List stocktakes (reads via service account)
✅ Sync scans (writes via service account)
✅ Variance calculations
✅ Export (.dat files, Excel)

## Recommended Approach: **Hybrid**

### Use Apps Script For:
1. **Creating spreadsheets** (runs as you, uses your storage)
2. **Writing data** (can write to any sheet you own)
3. **Reading data** (can read any sheet you own)

### Use Cloudflare Worker For:
1. **Authentication** (user management)
2. **Variance calculations** (complex logic)
3. **Export** (.dat files, Excel generation)
4. **Reading data** (service accounts CAN read shared files)

## OR: Move Everything to Apps Script?

**Pros:**
- ✅ Simpler - one backend
- ✅ No storage issues
- ✅ Easy to add features
- ✅ You can edit it directly

**Cons:**
- ⚠️ Apps Script has execution time limits (6 minutes)
- ⚠️ Less scalable
- ⚠️ Harder to version control

## Recommendation

**Use Apps Script for file operations, keep Worker for complex logic.**

But if you prefer simplicity, we can move everything to Apps Script!

## Adding New Features to Apps Script

**Yes, you can easily add new features!**

1. Add a new `case` in `doPost()`:
```javascript
case 'myNewFeature':
  return handleMyNewFeature(request);
```

2. Create the handler function:
```javascript
function handleMyNewFeature(request) {
  const { param1, param2 } = request;
  
  // Your code here
  // Access sheets: SpreadsheetApp.openById(sheetId)
  // Access Drive: DriveApp.getFolderById(folderId)
  
  return createResponse(true, 'Success', { result: 'data' });
}
```

3. Deploy and test!

**That's it!** Apps Script is very easy to extend.

