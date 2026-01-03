# Fix Storage Quota Exceeded Error

## The Real Problem
**Error**: "The user's Drive storage quota has been exceeded."

This is NOT a permissions issue - your Google Drive is full!

## Solutions

### Option 1: Free Up Space in Google Drive (Easiest)
1. Go to: https://drive.google.com
2. Check your storage: Click your profile picture → "Storage"
3. Delete old files or move them to trash
4. Empty trash: https://drive.google.com/drive/trash
5. Wait a few minutes, then try creating a stocktake again

### Option 2: Upgrade Google Drive Storage
1. Go to: https://one.google.com/storage
2. Upgrade to a plan with more storage
3. This will give you more space for spreadsheets

### Option 3: Use Google Workspace Shared Drive (If Available)
If you have Google Workspace, you can use a Shared Drive instead:
- Shared Drives have separate storage quotas
- Service accounts can create files in Shared Drives
- This won't count against your personal Drive storage

## Verify Fix
After freeing up space, test again:
https://stocktake-reconciliation.tomwmorgan47.workers.dev/debug/test-folder-access?folderId=1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE

The `canCreateInFolder` should be `true` if storage is available.

## Why This Happened
- Service accounts create files in their own Drive (which counts against your quota)
- Even though files are moved to your folder, they're created in service account's Drive first
- If your Drive is full, the CREATE step fails with storage quota error

