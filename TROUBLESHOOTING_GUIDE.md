# Troubleshooting Guide - Stocktake System

## How The System Works

### Theory of Operation

1. **User Configuration:**
   - User enters Google Drive folder ID or URL in Settings
   - System extracts folder ID and saves to IndexedDB
   - Folder ID is used for all subsequent operations

2. **Listing Stocktakes:**
   - Frontend: `GET /counting/stocktakes?folderId=1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE`
   - Backend: Queries Google Drive API with:
     ```
     Query: 'FOLDER_ID'+in+parents+and+title+contains+'Stocktake -'+and+mimeType='application/vnd.google-apps.spreadsheet'
     ```
   - Google Drive returns list of spreadsheets
   - Backend processes and returns to frontend

3. **Creating Stocktakes:**
   - Frontend: `POST /counting/stocktake/create` with `{name, user, folderId}`
   - Backend: Creates spreadsheet, moves to folder, sets up sheets
   - Returns spreadsheet ID and URL

### Service Account Requirements

**Service Account Email:**
```
stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com
```

**Required Permissions:**
- **Editor** permission on the folder (to create and move files)
- Folder must be shared with service account
- "Notify people" should be unchecked

---

## Common Errors and Solutions

### Error: "Invalid Value (Code: 400)"

**What it means:**
- Google Drive API received an invalid query or folder ID
- Usually means the folder ID format is wrong or folder doesn't exist

**What YOU need to do:**
1. **Verify the folder ID is correct:**
   - Open your Google Drive folder
   - Check the URL: `https://drive.google.com/drive/folders/FOLDER_ID`
   - Copy the `FOLDER_ID` part (should be ~33 characters, alphanumeric with dashes/underscores)
   - Example: `1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE`

2. **Verify the folder exists:**
   - Make sure the folder actually exists in your Google Drive
   - Check you have access to it

3. **Share the folder with service account:**
   - Right-click folder → Share
   - Add: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
   - Permission: **Editor**
   - Uncheck "Notify people"
   - Click Share

4. **Re-enter folder ID in Settings:**
   - Go to Settings on home screen
   - Clear the folder ID field
   - Paste the folder ID again (or the full URL)
   - Click "Save Folder ID"

**What I (the system) do:**
- Validate folder ID format
- Build Google Drive API query
- Handle errors and show helpful messages
- Log errors for debugging

---

### Error: "Permission denied" or 403/404

**What it means:**
- Service account doesn't have access to the folder

**What YOU need to do:**
1. Share the folder with service account (see above)
2. Make sure permission is **Editor** (not just Viewer)
3. Wait 10-30 seconds after sharing
4. Refresh the page

**What I do:**
- Detect permission errors
- Show clear error messages with instructions
- Log errors for debugging

---

### Error: "Unauthorized" or 401

**What it means:**
- Authentication token expired or invalid

**What YOU need to do:**
1. Refresh the page (hard refresh: Cmd+Shift+R)
2. Log in again:
   - Username: `admin`
   - Password: `password`

**What I do:**
- Validate token on page load
- Auto-logout on 401 errors
- Clear expired tokens

---

## Point of Failure Analysis

### Most Likely Failure Points:

1. **Folder ID Format (400 Error)**
   - **Your responsibility:** Verify folder ID is correct
   - **My responsibility:** Validate format, show clear errors
   - **Check:** Folder ID in URL matches what you entered

2. **Folder Not Shared (403/404 Error)**
   - **Your responsibility:** Share folder with service account
   - **My responsibility:** Detect and report permission errors
   - **Check:** Folder sharing settings in Google Drive

3. **Service Account Access**
   - **Your responsibility:** Grant Editor permission
   - **My responsibility:** Use correct service account email
   - **Check:** Service account email in error messages

4. **Token Expiration (401 Error)**
   - **Your responsibility:** Log in again when prompted
   - **My responsibility:** Auto-detect and handle expired tokens
   - **Check:** Token validation on page load

---

## Step-by-Step Fix for "Invalid Value" Error

1. **Open your Google Drive folder:**
   ```
   https://drive.google.com/drive/folders/1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE
   ```

2. **Verify the folder ID in the URL:**
   - Should match: `1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE`
   - Should be ~33 characters
   - Alphanumeric with dashes/underscores only

3. **Share the folder:**
   - Right-click folder → Share
   - Add: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
   - Permission: **Editor**
   - Uncheck "Notify people"
   - Click Share

4. **Update Settings:**
   - Go to Settings on home screen
   - Clear folder ID field
   - Paste folder ID: `1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE`
   - Click "Save Folder ID"

5. **Wait 10-30 seconds** (for Google to propagate permissions)

6. **Refresh the page** and try again

---

## Verification Checklist

- [ ] Folder ID is correct (matches Google Drive URL)
- [ ] Folder exists and is accessible
- [ ] Folder is shared with: `stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`
- [ ] Permission level is **Editor** (not Viewer)
- [ ] "Notify people" is unchecked
- [ ] Waited 10-30 seconds after sharing
- [ ] Folder ID saved in Settings
- [ ] Logged in with valid credentials
- [ ] Hard refreshed page (Cmd+Shift+R)

---

## Debugging Tips

1. **Check browser console (F12):**
   - Look for specific error messages
   - Check network tab for API responses
   - Look for "Drive API Query" logs

2. **Check Cloudflare Worker logs:**
   - Go to Cloudflare Dashboard
   - Workers → stocktake-reconciliation → Logs
   - Look for error messages

3. **Test folder access manually:**
   - Try accessing folder URL directly
   - Verify folder is shared correctly
   - Check folder permissions

---

## Still Not Working?

If you've done all the above and it's still not working:

1. **Check the exact error message** in browser console
2. **Verify service account email** is correct
3. **Try creating a new folder** and sharing that
4. **Check if folder has any special characters** in name
5. **Verify Google Drive API is enabled** in Google Cloud Console

Share the exact error message and I can help debug further!

