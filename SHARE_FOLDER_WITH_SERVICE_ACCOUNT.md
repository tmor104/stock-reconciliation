# Share Folder with Service Account - REQUIRED

## The Problem
Service accounts **CANNOT** create files in root Google Drive. They MUST create files in a shared folder.

## Solution: Share a Folder

### Step 1: Create or Use Existing Folder
1. Go to: https://drive.google.com
2. Create a new folder OR use an existing one
3. Name it something like "Stocktakes" or "Stocktake Files"

### Step 2: Share Folder with Service Account
1. Right-click on the folder → Click **"Share"**
2. In the "Add people and groups" field, paste:
   ```
   stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com
   ```
3. Set permission to **"Editor"** (from dropdown)
4. **UNCHECK** "Notify people" (service accounts don't have email)
5. Click **"Share"**

### Step 3: Get Folder ID
1. Open the folder in Google Drive
2. Look at the URL - it will be like:
   ```
   https://drive.google.com/drive/folders/1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE
   ```
3. Copy the part after `/folders/` - that's your folder ID
   - Example: `1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE`

### Step 4: Enter Folder ID in App
1. Open your app
2. Go to Settings
3. Paste the folder ID in the "Google Drive Folder ID" field
4. Click "Save Folder ID"

### Step 5: Try Creating Stocktake
Now try creating a stocktake - it should work!

## Important Notes

- The folder MUST be shared with the service account email
- Permission MUST be "Editor" (not "Viewer")
- Wait 10-30 seconds after sharing for permissions to propagate
- The folder ID is the long string in the URL after `/folders/`

## Troubleshooting

**Still getting 403?**
- Double-check the folder is shared with the exact email: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
- Verify permission is "Editor"
- Wait a bit longer (up to 1 minute) for permissions to propagate
- Try refreshing the app

