# Battle Test Guide - Unified Stock System

## ✅ Deployment Status

- **Cloudflare Worker**: ✅ Deployed
  - URL: `https://stocktake-reconciliation.tomwmorgan47.workers.dev`
  - Status: Live with all counting endpoints
  
- **Frontend**: ✅ Ready
  - Location: `unified-system/frontend/`
  - Local server: Running on `http://localhost:8080`

## 🧪 Test Checklist

### 1. Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should fail)
- [ ] Token stored in IndexedDB
- [ ] Session persists on page refresh

### 2. Folder ID Configuration
- [ ] Prompt appears on first login
- [ ] Folder ID saved to IndexedDB
- [ ] Folder ID used when creating stocktakes

### 3. Home Screen
- [ ] Lists available stocktakes
- [ ] Create new stocktake button works
- [ ] Select existing stocktake works
- [ ] Current stocktake card displays correctly

### 4. Stocktake Creation
- [ ] Creates spreadsheet in configured folder
- [ ] All sheets created (Tally, Raw Scans, Manual, Kegs, Deleted Scans, Metadata)
- [ ] Metadata populated correctly
- [ ] Returns stocktake ID and URL

### 5. Upload Variance Report
- [ ] Modal appears after stocktake creation
- [ ] Can skip upload
- [ ] Can upload HnL Excel file
- [ ] Progress indicator shows
- [ ] Variance data loaded after upload

### 6. Counting Screen - Products & Locations
- [ ] Product database loads from Master Sheet
- [ ] Locations load from Master Sheet
- [ ] Data cached in IndexedDB
- [ ] Works offline (uses cached data)

### 7. Counting Screen - Barcode Scanning
- [ ] Scan barcode → finds product
- [ ] Enter quantity → saves to IndexedDB
- [ ] Scan appears in list immediately
- [ ] Unknown barcode → creates manual entry option
- [ ] Auto-sync after 10 scans (if online)

### 8. Counting Screen - Manual Entries
- [ ] Create manual entry from search
- [ ] Manual entries appear in separate list
- [ ] Can delete manual entries
- [ ] Syncs to "Manual" sheet

### 9. Counting Screen - Keg Counting
- [ ] Keg list loads from Master Sheet
- [ ] Can enter counts for each keg
- [ ] Syncs to "Kegs" sheet
- [ ] Counts reset after sync

### 10. Counting Screen - Search
- [ ] Search by product name
- [ ] Search by barcode
- [ ] Select result → goes to quantity input
- [ ] No results → option to create manual entry

### 11. Counting Screen - Edit/Delete
- [ ] Edit scan quantity
- [ ] Delete scan
- [ ] Changes saved to IndexedDB
- [ ] Marked as unsynced after edit

### 12. Sync Operations
- [ ] Sync button shows unsynced count
- [ ] Manual sync works
- [ ] Auto-sync works (every 10 scans)
- [ ] Sync status updates (synced/unsynced badges)
- [ ] Works offline (queues for later)

### 13. Complete First Counts
- [ ] Syncs all unsynced data first
- [ ] Matches counts with variance report
- [ ] Calculates variances
- [ ] Navigates to reconciliation screen

### 14. Reconciliation Screen
- [ ] Variance status displays
- [ ] Variance table renders
- [ ] Positive/negative variances color-coded
- [ ] Can refresh variance report
- [ ] Can navigate back to counting

### 15. Complete Stocktake
- [ ] Syncs all data first
- [ ] Generates .dat file
- [ ] Generates manual entries list
- [ ] Files download automatically
- [ ] Returns to home screen

### 16. Offline Functionality
- [ ] All data saved to IndexedDB immediately
- [ ] Works without internet connection
- [ ] Queues syncs when offline
- [ ] Syncs when connection restored
- [ ] No data loss on page refresh

### 17. Error Handling
- [ ] Network errors handled gracefully
- [ ] API errors show user-friendly messages
- [ ] Invalid inputs rejected
- [ ] Missing data handled (fallback to cache)

## 🐛 Known Issues to Watch For

1. **Template Literals**: Fixed escaped template literals - verify all work
2. **onclick Handlers**: Some use template literals - verify they work
3. **Variance Data Format**: Ensure API returns correct format
4. **Folder ID**: Verify folder access permissions

## 🚀 Quick Test Commands

### Test Worker Endpoints
```bash
# Test login (will fail with test credentials, but should return JSON error)
curl -X POST https://stocktake-reconciliation.tomwmorgan47.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Test products endpoint (requires auth token)
curl -X GET https://stocktake-reconciliation.tomwmorgan47.workers.dev/counting/products \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Frontend Locally
```bash
cd unified-system/frontend
python3 -m http.server 8080
# Open http://localhost:8080 in browser
```

## 📊 Test Results

Document any issues found during testing:

1. **Issue**: [Description]
   - **Location**: [File/Function]
   - **Steps to Reproduce**: [Steps]
   - **Expected**: [Expected behavior]
   - **Actual**: [Actual behavior]
   - **Fix**: [Fix applied or needed]

## ✅ Success Criteria

- All features from Stock app work
- All features from Stocktake system work
- No Apps Script dependency
- Offline functionality works
- No data loss on refresh
- Beautiful UI matches Stock app style
- Complete workflow works end-to-end



