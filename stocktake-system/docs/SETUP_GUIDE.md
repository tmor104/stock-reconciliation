# Stocktake Reconciliation System - Setup Guide

## Overview
This system reconciles HnL theoretical stock against actual counts, providing variance reports and exporting data back to HnL format.

## System Components

### 1. Frontend (GitHub Pages)
- Static HTML/CSS/JS application
- Hosted on GitHub Pages
- No server-side processing

### 2. Backend (Cloudflare Workers)
- Serverless API handling:
  - HnL Excel parsing
  - Google Sheets integration
  - Variance calculations
  - Export generation

### 3. Data Storage
- **Cloudflare KV**: User credentials, stocktake metadata
- **Google Sheets**: Stocktake data, counts, audit trail

## Prerequisites

1. **GitHub Account** - for hosting frontend
2. **Cloudflare Account** (free tier) - for Workers
3. **Google Cloud Project** - for Sheets API access
4. **Google Drive** - for storing count sheets and barcode mapping

## Step 1: Google Cloud Setup

### 1.1 Create Google Cloud Project
1. Go to https://console.cloud.google.com
2. Create new project: "Stocktake System"
3. Enable APIs:
   - Google Sheets API
   - Google Drive API

### 1.2 Create Service Account
1. Go to "IAM & Admin" → "Service Accounts"
2. Create service account: "stocktake-worker"
3. Download JSON key file
4. Share your Google Drive folder with the service account email

### 1.3 Prepare Barcode Mapping Sheet
1. Create a Google Sheet with two columns:
   - Column A: Barcode
   - Column B: Product (matching HnL description exactly)
2. Share with service account (view access)
3. Copy the Sheet ID from URL:
   `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`

### 1.4 Create Count Sheets Folder
1. Create a Google Drive folder for count sheets
2. Share with service account (view access)
3. Each count sheet should have columns:
   - Barcode
   - Product
   - Quantity
   - Location
   - User
   - Timestamp
   - Stock Level
   - $ Value
   - Synced
   - Status
   - Sync ID

## Step 2: Cloudflare Workers Setup

### 2.1 Install Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 2.2 Configure wrangler.toml
Create `wrangler.toml` in the cloudflare-worker directory:

```toml
name = "stocktake-worker"
main = "index.js"
compatibility_date = "2024-01-01"

[vars]
BARCODE_SHEET_ID = "YOUR_BARCODE_SHEET_ID"
COUNT_SHEETS_FOLDER_ID = "YOUR_DRIVE_FOLDER_ID"

[[kv_namespaces]]
binding = "STOCKTAKE_KV"
id = "YOUR_KV_NAMESPACE_ID"

[env.production]
name = "stocktake-worker"
```

### 2.3 Create KV Namespace
```bash
wrangler kv:namespace create "STOCKTAKE_KV"
# Copy the ID to wrangler.toml
```

### 2.4 Add Google Service Account Credentials
```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
# Paste the entire JSON key file content
```

### 2.5 Set Initial Admin User
```bash
wrangler secret put INITIAL_ADMIN_PASSWORD
# Enter a secure password - this will be hashed
```

Then add this initialization code to create the first admin user:
```javascript
// Run once to create initial admin
const password = env.INITIAL_ADMIN_PASSWORD;
const hashedPassword = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password)
);
const hashArray = Array.from(new Uint8Array(hashedPassword));
const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

await env.STOCKTAKE_KV.put('users', JSON.stringify([
    { username: 'admin', password: hashHex, role: 'admin' }
]));
```

### 2.6 Install Dependencies
```bash
cd cloudflare-worker
npm init -y
npm install itty-router xlsx
```

### 2.7 Deploy Worker
```bash
wrangler deploy
```

After deployment, note your Worker URL (e.g., `https://stocktake-worker.YOUR_ACCOUNT.workers.dev`)

## Step 3: GitHub Pages Setup

### 3.1 Create GitHub Repository
1. Create new repository: "stocktake-system"
2. Upload frontend files to repository
3. Go to Settings → Pages
4. Set source to "main" branch
5. Note your GitHub Pages URL

### 3.2 Update Frontend Configuration
Edit `frontend/app.js` and update:

```javascript
const CONFIG = {
    WORKER_URL: 'https://stocktake-worker.YOUR_ACCOUNT.workers.dev',
    BARCODE_SHEET_ID: 'YOUR_BARCODE_SHEET_ID'
};
```

### 3.3 Commit and Push
```bash
git add .
git commit -m "Configure worker URL"
git push origin main
```

Your site will be live at: `https://YOUR_USERNAME.github.io/stocktake-system`

## Step 4: Additional Required Services

### 4.1 Google Sheets Service
Create `cloudflare-worker/services/google-sheets.js`:

This file handles all Google Sheets operations. Due to length, refer to the included file.

### 4.2 Auth Service
Create `cloudflare-worker/services/auth.js`:

Handles user authentication and management.

### 4.3 Export Service
Create `cloudflare-worker/services/export.js`:

Generates Excel reports and DAT files.

## Usage Workflow

### For Admins:

1. **Start New Stocktake**
   - Login with admin credentials
   - Click "Start New Stocktake"
   - Upload HnL Excel export
   - Select count sheet from dropdown
   - Enter stocktake name
   - System creates new Google Sheet and links everything

2. **Monitor Progress**
   - View variance report in real-time
   - See which items are counted vs. not counted
   - Items without barcodes shown in blue (need manual entry)

3. **Manual Adjustments**
   - Click "Edit" on any item
   - Enter new count with optional reason
   - Saved to audit trail automatically

4. **Finish Stocktake**
   - Click "Finish Current Stocktake"
   - Generates .dat file for HnL import
   - Locks spreadsheet (read-only)
   - Moves to history

### For Users:

1. **Login**
   - Standard users only see variance report
   - Can make manual count adjustments
   - Cannot start/finish stocktakes

2. **View Reports**
   - Filter by category
   - Sort by variance (dollar or quantity)
   - Search for specific products
   - Export to Excel

## DAT File Format

The exported .dat file follows HnL's import format:
```
BARCODE         COUNT
9300857058404   15.5
9421004731898   23.0
```

- Barcode starts at position 1
- Count starts at position 17
- Only items with barcodes and non-zero counts are included

## Troubleshooting

### "Invalid credentials" error
- Check that password is correctly hashed with SHA-256
- Verify KV namespace contains user data

### "Failed to load count sheets"
- Verify Google service account has access to Drive folder
- Check GOOGLE_SERVICE_ACCOUNT_KEY secret is set correctly

### Items not matching between HnL and counts
- Ensure product descriptions match EXACTLY
- Check barcode mapping sheet is up to date
- Verify InvCode or description is being used consistently

### CORS errors
- Verify Cloudflare Worker is deployed and accessible
- Check WORKER_URL in frontend config is correct
- Ensure corsHeaders are included in all responses

## Security Notes

1. **Passwords**: All passwords are SHA-256 hashed before storage
2. **Authentication**: JWT-style tokens used for API access
3. **Google Credentials**: Service account key stored as Cloudflare secret
4. **HTTPS**: All communication over HTTPS (GitHub Pages + Cloudflare)

## Cost Estimate

- **GitHub Pages**: Free
- **Cloudflare Workers**: Free tier (100k requests/day)
- **Cloudflare KV**: Free tier (100k reads/day, 1k writes/day)
- **Google Cloud**: Free tier (sufficient for this use case)

**Total: $0/month** (within free tier limits)

## Support

For issues or questions:
1. Check this documentation
2. Review Cloudflare Worker logs: `wrangler tail`
3. Check browser console for frontend errors
4. Verify Google Sheets access and permissions

## Future Enhancements

Possible improvements:
- Real-time WebSocket updates for multi-user collaboration
- Mobile app for barcode scanning
- Advanced analytics and historical comparisons
- Integration with other inventory systems
- Automated email reports
