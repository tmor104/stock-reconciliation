# Implement OAuth 2.0 - Step by Step

## Why OAuth?
Service accounts **cannot own files** - they have no storage quota. For personal Google accounts, we need OAuth 2.0 to create files in YOUR Drive.

## Step 1: Create OAuth 2.0 Credentials

1. Go to: https://console.cloud.google.com/apis/credentials
2. Make sure project `stocktake-reconciliation` is selected
3. Click **"Create Credentials"** → **"OAuth client ID"**
4. If prompted, configure OAuth consent screen:
   - User type: **External**
   - App name: **Stock Wizard**
   - User support email: Your email
   - Developer contact: Your email
   - Click **"Save and Continue"**
   - Scopes: Add `https://www.googleapis.com/auth/drive` and `https://www.googleapis.com/auth/spreadsheets`
   - Click **"Save and Continue"**
   - Test users: Add your email
   - Click **"Save and Continue"**
5. Application type: **Web application**
6. Name: **Stock Wizard Web Client**
7. Authorized JavaScript origins: 
   - `https://tmor104.github.io`
   - `http://localhost:8080` (for local testing)
8. Authorized redirect URIs:
   - `https://tmor104.github.io/stock-reconciliation/`
   - `http://localhost:8080/` (for local testing)
9. Click **"Create"**
10. **Copy the Client ID** - you'll need this

## Step 2: Update Frontend

Add Google Sign-In button to login screen, get OAuth token, send to backend.

## Step 3: Update Backend

Accept OAuth tokens, use them instead of service account for file creation.

## Quick Test

After implementing, files will be created in YOUR Drive using YOUR storage quota.

